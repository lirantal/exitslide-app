import { actorHeader, analyticsEnabledHeader, analyticsDistinctIdHeader, analyticsSessionIdHeader } from '@exitslide/contracts'
import { beforeEach, expect, test, vi } from 'vitest'
import app from '../src/index'
import { integrationDatabase } from './d1'

const { capture, shutdown, initialize } = vi.hoisted(() => ({
  capture: vi.fn().mockResolvedValue(undefined), shutdown: vi.fn().mockResolvedValue(undefined), initialize: vi.fn(),
}))
vi.mock('posthog-node', () => ({
  PostHog: class {
    constructor(token: string, options: unknown) { initialize(token, options) }
    captureImmediate = capture
    shutdown = shutdown
  },
}))

const database = integrationDatabase()
const owner = 'user_analytics'
const browserId = '12345678-1234-4234-8234-123456789012'
const browserSessionId = '12345678-1234-4234-8234-123456789013'
const input = { title: 'Private title', slideUrl: 'https://private.example/deck?secret=123' }
let pending: Promise<unknown>[]

beforeEach(() => { vi.clearAllMocks(); pending = [] })

async function request(path: string, method = 'GET', body?: unknown, headers: Record<string, string> = {}, token = 'phc_test_server') {
  return app.fetch(new Request('https://internal' + path, {
    method,
    headers: { 'Content-Type': 'application/json', [actorHeader]: owner, [analyticsEnabledHeader]: '1', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  }), { DB: database(), POSTHOG_PROJECT_TOKEN: token }, {
    waitUntil: (promise: Promise<unknown>) => pending.push(promise),
    passThroughOnException() {}, props: {},
  })
}

async function created() {
  return (await (await request('/sessions', 'POST', input)).json() as { id: string }).id
}

test('records committed mutations on the backend and links validated browser attribution', async () => {
  const attribution = { [analyticsDistinctIdHeader]: browserId, [analyticsSessionIdHeader]: browserSessionId }
  const response = await request('/sessions', 'POST', input, attribution)
  expect(response.status).toBe(201)
  const { id } = await response.json() as { id: string }
  expect((await request('/sessions/' + id, 'PATCH', input, attribution)).status).toBe(200)
  expect((await request('/sessions/' + id, 'DELETE', undefined, attribution)).status).toBe(204)
  await Promise.all(pending)
  expect(capture.mock.calls.map(([event]) => event.event)).toEqual(['session_created', 'session_updated', 'session_deleted'])
  for (const [event] of capture.mock.calls) expect(event).toMatchObject({
    distinctId: browserId, properties: {
      source: 'backend', $session_id: browserSessionId, $process_person_profile: false, $geoip_disable: true,
    },
  })
  const sent = JSON.stringify(capture.mock.calls)
  for (const sensitive of [id, input.title, input.slideUrl, owner]) expect(sent).not.toContain(sensitive)
  expect(shutdown).toHaveBeenCalledTimes(3)
  expect(initialize).toHaveBeenCalledWith('phc_test_server', expect.objectContaining({
    host: 'https://eu.i.posthog.com', flushInterval: 0, disableGeoip: true,
  }))
})

test('does not count invalid, unauthorized, missing, opted-out, or unconfigured mutations', async () => {
  expect((await request('/sessions', 'POST', { ...input, title: '' })).status).toBe(422)
  expect((await request('/sessions', 'POST', input, { [actorHeader]: '' })).status).toBe(401)
  expect((await request('/sessions/' + crypto.randomUUID(), 'PATCH', input)).status).toBe(404)
  expect((await request('/sessions', 'POST', input, { [analyticsEnabledHeader]: '0' })).status).toBe(201)
  expect((await request('/sessions', 'POST', input, { [analyticsEnabledHeader]: '' })).status).toBe(201)
  expect((await request('/sessions', 'POST', input, {}, '')).status).toBe(201)
  await Promise.all(pending)
  expect(capture).not.toHaveBeenCalled()
})

test('rating retries emit one success event, with a submission-scoped identity and bounded score', async () => {
  const id = await created()
  await Promise.all(pending)
  capture.mockClear()
  const rating = { score: 4, submissionId: crypto.randomUUID() }
  const responses = await Promise.all(Array.from({ length: 3 }, () => request('/public/sessions/' + id + '/ratings', 'POST', rating)))
  expect(responses.map(result => result.status)).toEqual([200, 200, 200])
  expect((await request('/public/sessions/' + id + '/ratings', 'POST', { ...rating, score: 5 })).status).toBe(409)
  await Promise.all(pending)
  expect(capture).toHaveBeenCalledOnce()
  expect(capture).toHaveBeenCalledWith({
    distinctId: expect.stringMatching(/^rating:[a-f0-9]{64}$/), event: 'rating_submitted',
    properties: { source: 'backend', score: 4, $process_person_profile: false, $geoip_disable: true },
  })
  expect(JSON.stringify(capture.mock.calls)).not.toContain(id)
  expect(JSON.stringify(capture.mock.calls)).not.toContain(rating.submissionId)
})

test('fallback attribution is pseudonymous and forged analytics IDs never grant ownership', async () => {
  const id = await created()
  expect((await request('/sessions/' + id, 'DELETE', undefined, {
    [actorHeader]: 'user_other', [analyticsDistinctIdHeader]: browserId,
  })).status).toBe(404)
  expect((await request('/sessions/' + id, 'PATCH', input, {
    [analyticsDistinctIdHeader]: 'user_private\tidentifier', [analyticsSessionIdHeader]: 'not-a-uuid',
  })).status).toBe(200)
  await Promise.all(pending)
  expect(capture).toHaveBeenCalledTimes(2)
  const [first, second] = capture.mock.calls.map(([event]) => event)
  expect(first.distinctId).toMatch(/^speaker:[a-f0-9]{64}$/)
  expect(second.distinctId).toBe(first.distinctId)
  expect(second.properties).not.toHaveProperty('$session_id')
})

test('PostHog failures do not change a successful business response', async () => {
  capture.mockRejectedValueOnce(new Error('Provider unavailable'))
  const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})
  try {
    expect((await request('/sessions', 'POST', input)).status).toBe(201)
    await Promise.all(pending)
    expect(shutdown).toHaveBeenCalledOnce()
    expect(warning).toHaveBeenCalledWith('product_analytics_delivery_failed')
  } finally { warning.mockRestore() }
})
