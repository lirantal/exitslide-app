import { actorHeader, sessionPageSchema, sessionSchema } from '@exitslide/contracts'
import { expect, test, vi } from 'vitest'
import app from '../src/index'
import { integrationDatabase } from './d1'

const database = integrationDatabase()
const path = '/sessions'
const host = 'https://example.com/slides'
const request = (url: string, owner?: string, method = 'GET', payload?: unknown) =>
  app.request(url, {
    method,
    headers: owner ? { [actorHeader]: owner, 'Content-Type': 'application/json' } : {},
    body: payload === undefined ? undefined : JSON.stringify(payload),
  }, { DB: database() })

async function create(owner: string) {
  const response = await request(path, owner, 'POST', { title: '  Practical D1  ', slideUrl: host })
  expect(response.status).toBe(201)
  return sessionSchema.parse(await response.json())
}

test('requires an authenticated owner and returns an empty owner list', async () => {
  expect((await request(path)).status).toBe(401)
  expect(await (await request(path, 'user_new')).json()).toEqual({ items: [], nextCursor: null })
})

test('validates inputs, trims the title, and lets the owner open the Session', async () => {
  for (const slideUrl of ['http://example.com/', 'https://u:p@example.com/', 'javascript:alert(1)', 'https:/example.com']) {
    const response = await request(path, 'user_valid', 'POST', { title: 'Slides', slideUrl })
    expect(response.status).toBe(422)
  }
  expect((await request(path, 'user_valid', 'POST', { title: ' ', slideUrl: host })).status).toBe(422)
  const session = await create('user_valid')
  expect(session.title).toBe('Practical D1')
  expect(await (await request(path + '/' + session.id, 'user_valid')).json()).toEqual(session)
})

test('scopes reads and mutations to the owner and keeps the same ID and ratings on edit', async () => {
  const session = await create('user_owner')
  const url = path + '/' + session.id
  await database().prepare('INSERT INTO ratings VALUES (?, ?, ?, ?)').bind(session.id, crypto.randomUUID(), 4, session.createdAt).run()
  const payload = { title: 'Updated', slideUrl: 'https://example.com/updated' }
  expect((await request(url, 'user_other')).status).toBe(404)
  expect((await request(url, 'user_other', 'PATCH', payload)).status).toBe(404)
  expect((await request(url, 'user_other', 'DELETE')).status).toBe(404)

  const edited = await request(url, 'user_owner', 'PATCH', payload)
  expect(await edited.json()).toEqual({ ...session, ...payload })
  expect(await database().prepare('SELECT score FROM ratings WHERE session_id = ?').bind(session.id).first('score')).toBe(4)

  expect((await request(url, 'user_owner', 'DELETE')).status).toBe(204)
  expect((await request(url, 'user_owner')).status).toBe(404)
  expect(await database().prepare('SELECT score FROM ratings WHERE session_id = ?').bind(session.id).first()).toBeNull()
  expect(await database().prepare('SELECT id FROM session_links WHERE id = ?').bind(session.id).first('id')).toBe(session.id)
  const uuid = vi.spyOn(crypto, 'randomUUID').mockReturnValueOnce(session.id as ReturnType<typeof crypto.randomUUID>)
  try {
    expect((await request(path, 'user_owner', 'POST', payload)).status).toBe(503)
    expect((await request(url, 'user_owner')).status).toBe(404)
  } finally {
    uuid.mockRestore()
  }
})

test('pages deterministically over timestamps shared by multiple Sessions', async () => {
  const owner = 'user_paging'
  const timestamp = '2025-06-01T12:00:00.000Z'
  const ids = Array.from({ length: 21 }, () => crypto.randomUUID()).sort().reverse()
  await database().batch(ids.flatMap(id => [
    database().prepare('INSERT INTO session_links VALUES (?)').bind(id),
    database().prepare('INSERT INTO sessions VALUES (?, ?, ?, ?, ?)').bind(id, owner, 'Session', host, timestamp),
  ]))
  const first = sessionPageSchema.parse(await (await request(path, owner)).json())
  expect(first.items.map(item => item.id)).toEqual(ids.slice(0, 20))
  const next = path + '?cursor=' + first.nextCursor
  expect((await request(next, 'user_other')).status).toBe(422)
  const last = sessionPageSchema.parse(await (await request(next, owner)).json())
  expect(last.items.map(item => item.id)).toEqual(ids.slice(20))
  expect(last.nextCursor).toBeNull()
})
