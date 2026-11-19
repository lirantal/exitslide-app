import { backendHealthSchema } from '@exitslide/contracts'
import { expect, test } from 'vitest'
import app from './index'

test('the internal Worker reports its own health', async () => {
  const response = await app.request('/healthz')

  expect(response.status).toBe(200)
  expect(backendHealthSchema.parse(await response.json())).toEqual({
    service: 'exitslide-backend',
    status: 'ok',
  })
})

test('paths outside the scaffold endpoint return 404', async () => {
  expect((await app.request('/auth/callback')).status).toBe(404)
})
