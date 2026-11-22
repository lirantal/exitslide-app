import { actorHeader, analyticsEnabledHeader, analyticsDistinctIdHeader, analyticsSessionIdHeader, sessionPageSchema, sessionSchema } from '@exitslide/contracts'
import { expect, test, vi } from 'vitest'
import { requestBackend } from './backend'

test('builds a private request from the trusted actor and explicit operation', async () => {
  const input = { title: 'Practical D1', slideUrl: 'https://example.com/slides' }
  const created = { ...input, id: crypto.randomUUID(), createdAt: new Date().toISOString() }
  const fetch = vi.fn(async (request: Request) => {
    expect(request.url).toBe('https://exitslide-backend/sessions')
    expect(request.method).toBe('POST')
    expect(request.headers.get(actorHeader)).toBe('user_speaker')
    expect(request.headers.has('Authorization')).toBe(false)
    expect(request.headers.has('Cookie')).toBe(false)
    expect(await request.json()).toEqual(input)
    return Response.json(created, { status: 201 })
  })

  expect(await requestBackend({ fetch }, '/sessions', sessionSchema, {
    method: 'POST', owner: 'user_speaker', body: input,
  })).toEqual({ ok: true, data: created })
  expect(fetch).toHaveBeenCalledTimes(1)
})

test('distinguishes an empty dashboard from unavailable storage and invalid payloads', async () => {
  const empty = { items: [], nextCursor: null }
  const mocked = vi.fn().mockResolvedValueOnce(Response.json(empty))
    .mockResolvedValueOnce(Response.json({ message: 'Storage is temporarily unavailable.' }, { status: 503 }))
    .mockResolvedValueOnce(Response.json({ items: [{ title: 'corrupt' }] }))
  const list = () => requestBackend({ fetch: mocked }, '/sessions', sessionPageSchema, { owner: 'user_speaker' })

  expect(await list()).toEqual({ ok: true, data: empty })
  expect(await list()).toEqual({ ok: false, status: 503, message: 'Storage is temporarily unavailable.' })
  expect(await list()).toMatchObject({ ok: false, status: 503 })
})

test('forwards attribution separately from business data and suppresses IDs for opt-outs', async () => {
  const distinctId = crypto.randomUUID()
  const sessionId = crypto.randomUUID()
  const requests: Request[] = []
  const backend = { fetch: async (request: Request) => {
    requests.push(request)
    return new Response(null, { status: 204 })
  } }
  for (const enabled of [true, false]) await requestBackend(backend, '/sessions/' + crypto.randomUUID(), { parse: () => null }, {
    method: 'DELETE', owner: 'user_speaker', analytics: { enabled, distinctId, sessionId },
  })
  expect(requests[0].headers.get(analyticsEnabledHeader)).toBe('1')
  expect(requests[0].headers.get(analyticsDistinctIdHeader)).toBe(distinctId)
  expect(requests[0].headers.get(analyticsSessionIdHeader)).toBe(sessionId)
  expect(requests[1].headers.get(analyticsEnabledHeader)).toBe('0')
  expect(requests[1].headers.has(analyticsDistinctIdHeader)).toBe(false)
  expect(requests[1].headers.has(analyticsSessionIdHeader)).toBe(false)
  expect(requests.every(request => request.headers.get(actorHeader) === 'user_speaker')).toBe(true)
})
