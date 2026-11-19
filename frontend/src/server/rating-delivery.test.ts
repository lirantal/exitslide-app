import { actorHeader } from '@exitslide/contracts'
import { expect, test, vi } from 'vitest'
import { sendRating } from './rating-delivery'

test('a throttled rating never reaches the backend', async () => {
  const fetch = vi.fn()
  const limit = vi.fn().mockResolvedValue({ success: false })
  const id = crypto.randomUUID()
  const response = await sendRating({ backend: { fetch }, ratingLimiter: { limit } }, id, '198.51.100.1',
    { score: 3, submissionId: crypto.randomUUID() })

  expect(limit).toHaveBeenCalledWith({ key: id + ':198.51.100.1' })
  expect(response).toMatchObject({ ok: false, status: 429 })
  expect(fetch).not.toHaveBeenCalled()
})

test('forwards an anonymous rating and preserves the same score and token when retried', async () => {
  const id = crypto.randomUUID()
  const input = { score: 4, submissionId: crypto.randomUUID() }
  const fetch = vi.fn(async (request: Request) => {
    expect(request.method).toBe('POST')
    expect(request.headers.has(actorHeader)).toBe(false)
    expect(request.headers.has('CF-Connecting-IP')).toBe(false)
    expect(await request.json()).toEqual(input)
    return Response.json({ status: 'saved' })
  }).mockRejectedValueOnce(new TypeError('network error'))
  const context = { backend: { fetch }, ratingLimiter: { limit: vi.fn().mockResolvedValue({ success: true }) } }

  expect(await sendRating(context, id, '198.51.100.1', input)).toMatchObject({ ok: false, status: 503 })
  expect(await sendRating(context, id, '198.51.100.1', input)).toMatchObject({ ok: true })
  expect(fetch).toHaveBeenCalledTimes(2)
})
