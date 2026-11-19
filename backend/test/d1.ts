import { readFile, readdir } from 'node:fs/promises'
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
    const directory = new URL('../drizzle/', import.meta.url)
    const files = (await readdir(directory)).filter(name => name.endsWith('.sql')).sort()
    for (const file of files) {
      const migration = await readFile(new URL(file, directory), 'utf8')
      await database.batch(migration.split('--> statement-breakpoint')
        .map(statement => statement.trim()).filter(Boolean).map(statement => database.prepare(statement)))
    }
  }, 20000)

  afterAll(async () => runtime?.dispose())
  return () => database
}
