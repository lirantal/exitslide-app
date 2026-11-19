import { readFile } from 'node:fs/promises'
import { Miniflare, convertV4MiniflareOptions } from 'miniflare'
import { afterAll, beforeAll } from 'vitest'

export function integrationDatabase() {
  let runtime: Miniflare
  let database: D1Database

  beforeAll(async () => {
    runtime = new Miniflare(convertV4MiniflareOptions({
      modules: true,
      script: 'export default { fetch() { return new Response("OK") } }',
      compatibilityDate: '2026-11-19',
      d1Databases: ['DB'],
    }))
    database = await runtime.getD1Database('DB') as unknown as D1Database
    const migration = await readFile(new URL('../drizzle/0000_init.sql', import.meta.url), 'utf8')
    await database.batch(migration.split('--> statement-breakpoint')
      .map(statement => statement.trim()).filter(Boolean).map(statement => database.prepare(statement)))
  }, 20000)

  afterAll(async () => runtime?.dispose())
  return () => database
}
