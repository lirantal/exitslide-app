import { actorHeader, engagementHeader, sessionSchema } from '@exitslide/contracts'
import { expect, test, vi } from 'vitest'
import app from '../src/index'
import { integrationDatabase } from './d1'

const database = integrationDatabase()
const owner = 'user_speaker'
const deck = 'https://example.com/slides'
const actor = { [actorHeader]: owner }

async function create() {
  const response = await app.request('/sessions', {
    method: 'POST', headers: { ...actor, 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Engagement test', slideUrl: deck }),
  }, { DB: database() })
  return sessionSchema.parse(await response.json()).id
}

const publicPath = (id: string) => '/public/sessions/' + id
const reportPath = (id: string) => '/sessions/' + id + '/engagement'
const read = (path: string, headers?: HeadersInit, DB = database()) => app.request(path, { headers }, { DB })

test('counts individual navigations and reports scoped totals, UTC days and known countries', async () => {
  const id = await create()
  const other = await create()
  const path = publicPath(id)
  await read(path) // Internal data reads carry no navigation attribution.
  await read(path, { [engagementHeader]: 'US' })
  for (const country of ['IL', 'XX']) {
    const response = await read(path + '/slides', { [engagementHeader]: country })
    expect(response.status).toBe(302)
    expect(response.headers.get('Location')).toBe(deck)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
  }
  await read(publicPath(other), { [engagementHeader]: 'IL' })
  expect((await read(publicPath(crypto.randomUUID()), { [engagementHeader]: 'US' })).status).toBe(404)
  const events = await database().prepare('SELECT * FROM engagement_events WHERE session_id = ?').bind(id).all<{
    id: string; type: string; created_at: string; country: string | null
  }>()
  expect(events.results).toHaveLength(3)
  expect(new Set(events.results.map(event => event.id)).size).toBe(3)
  expect(events.results.every(event => new Date(event.created_at).toISOString() === event.created_at)).toBe(true)
  expect(events.results).toEqual(expect.arrayContaining([
    expect.objectContaining({ type: 'visit', country: 'US' }),
    expect.objectContaining({ type: 'slide_click', country: 'IL' }),
    expect.objectContaining({ type: 'slide_click', country: null }),
  ]))
  await database().batch([
    database().prepare("UPDATE engagement_events SET created_at = '2026-11-19T00:00:00.000Z' WHERE session_id = ? AND type = 'visit'").bind(id),
    database().prepare("UPDATE engagement_events SET created_at = '2026-11-20T23:59:59.999Z' WHERE session_id = ? AND type = 'slide_click'").bind(id),
  ])
  const report = reportPath(id)
  expect((await read(report)).status).toBe(401)
  expect((await read(report, { [actorHeader]: 'user_other' })).status).toBe(404)
  expect((await read(report + '?from=2026-11-21&to=2026-11-20', actor)).status).toBe(422)
  expect((await read(report + '?from=2026-02-30', actor)).status).toBe(422)
  const all = await read(report, actor)
  expect(all.headers.get('Cache-Control')).toBe('no-store')
  expect(await all.json()).toEqual({
    totals: { visits: 1, slideClicks: 2 },
    days: [
      { date: '2026-11-20', visits: 0, slideClicks: 2 },
      { date: '2026-11-19', visits: 1, slideClicks: 0 },
    ],
    countries: [{ country: 'IL', visits: 0, slideClicks: 1 }, { country: 'US', visits: 1, slideClicks: 0 }],
  })
  expect(await (await read(report + '?from=2026-11-20&to=2026-11-20', actor)).json()).toEqual({
    totals: { visits: 0, slideClicks: 2 },
    days: [{ date: '2026-11-20', visits: 0, slideClicks: 2 }],
    countries: [{ country: 'IL', visits: 0, slideClicks: 1 }],
  })
})

test('slides and page data stay accessible when writes fail and stop working after retirement', async () => {
  const id = await create()
  const path = publicPath(id)
  const db = database()
  const failed = {
    prepare: (query: string) => {
      if (query.includes('INSERT INTO engagement_events')) throw new Error('Write failed')
      return db.prepare(query)
    },
  } as D1Database
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  try {
    const headers = { [engagementHeader]: 'US' }
    expect((await read(path, headers, failed)).status).toBe(200)
    const response = await read(path + '/slides', headers, failed)
    expect(response.status).toBe(302)
    expect(response.headers.get('Location')).toBe(deck)
    expect(warn).toHaveBeenCalledTimes(2)
  } finally {
    warn.mockRestore()
  }
  await read(path, { [engagementHeader]: 'US' })
  await app.request('/sessions/' + id, { method: 'DELETE', headers: actor }, { DB: db })
  expect((await read(path + '/slides', { [engagementHeader]: 'US' })).status).toBe(404)
  expect((await read(reportPath(id), actor)).status).toBe(404)
  expect(await db.prepare('SELECT id FROM engagement_events WHERE session_id = ?').bind(id).first()).toBeNull()
})
