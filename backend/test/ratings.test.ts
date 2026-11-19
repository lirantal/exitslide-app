import { actorHeader, ratingPageSchema, sessionSchema } from '@exitslide/contracts'
import { expect, test } from 'vitest'
import app from '../src/index'
import { integrationDatabase } from './d1'

const database = integrationDatabase()
const owner = 'user_speaker'
const slides = 'https://example.com/slides'
const fetchRoute = (path: string, method = 'GET', input?: unknown, actor?: string) =>
  app.request(path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(actor ? { [actorHeader]: actor } : {}) },
    body: input === undefined ? undefined : JSON.stringify(input),
  }, { DB: database() })

async function create() {
  const response = await fetchRoute('/sessions', 'POST', { title: 'Practical Feedback', slideUrl: slides }, owner)
  return sessionSchema.parse(await response.json()).id
}
const publicPath = (id: string) => '/public/sessions/' + id
const privateRatings = (id: string) => '/sessions/' + id + '/ratings'
const submit = (id: string, score: number, submissionId = crypto.randomUUID()) =>
  fetchRoute(publicPath(id) + '/ratings', 'POST', { score, submissionId })

test('public lookup shows only the current title and slide URL', async () => {
  const id = await create()
  await submit(id, 3)
  const response = await fetchRoute(publicPath(id))
  expect(response.headers.get('Cache-Control')).toBe('no-store')
  expect(await response.json()).toEqual({ title: 'Practical Feedback', slideUrl: slides })
  expect((await fetchRoute(publicPath(crypto.randomUUID()))).status).toBe(404)
  expect((await fetchRoute(privateRatings(id), 'GET', undefined, 'user_other')).status).toBe(404)
})

test('validates score bounds and returns privately ordered, scoped pages', async () => {
  const id = await create()
  const other = await create()
  for (const score of [0, 6, 3.5]) expect((await submit(id, score)).status).toBe(422)
  expect((await fetchRoute(publicPath(id) + '/ratings', 'POST', { score: 5, extra: 'x'.repeat(300) })).status).toBe(413)
  expect((await submit(id, 1)).status).toBe(200)
  expect((await submit(id, 5)).status).toBe(200)
  const ids = Array.from({ length: 20 }, () => crypto.randomUUID()).sort().reverse()
  await database().batch(ids.map(submissionId => database().prepare('INSERT INTO ratings VALUES (?, ?, 3, ?)')
    .bind(id, submissionId, '2024-06-01T00:00:00.000Z')))
  const path = privateRatings(id)
  const first = ratingPageSchema.parse(await (await fetchRoute(path, 'GET', undefined, owner)).json())
  const second = ratingPageSchema.parse(await (await fetchRoute(path + '?cursor=' + first.nextCursor, 'GET', undefined, owner)).json())
  expect(first.items.slice(2).map(item => item.submissionId)).toEqual(ids.slice(0, 18))
  expect(second.items.map(item => item.submissionId)).toEqual(ids.slice(18))
  expect((await fetchRoute(privateRatings(other) + '?cursor=' + first.nextCursor, 'GET', undefined, owner)).status).toBe(422)
})

test('concurrent retries save one rating, and a conflicting score cannot replace it', async () => {
  const id = await create()
  const token = crypto.randomUUID()
  const results = await Promise.all([submit(id, 4, token), submit(id, 4, token), submit(id, 4, token)])
  expect(results.map(response => response.status)).toEqual([200, 200, 200])
  expect((await submit(id, 5, token)).status).toBe(409)
  const page = ratingPageSchema.parse(await (await fetchRoute(privateRatings(id), 'GET', undefined, owner)).json())
  expect(page.items).toMatchObject([{ score: 4, submissionId: token }])
})

test('retiring while a rating is submitted leaves no public page or ratings', async () => {
  const id = await create()
  const [write, deletion] = await Promise.all([
    submit(id, 3), fetchRoute('/sessions/' + id, 'DELETE', undefined, owner),
  ])
  expect([200, 404]).toContain(write.status)
  expect(deletion.status).toBe(204)
  expect((await submit(id, 3)).status).toBe(404)
  expect((await fetchRoute(publicPath(id))).status).toBe(404)
  expect(await database().prepare('SELECT score FROM ratings WHERE session_id = ?').bind(id).first()).toBeNull()
})
