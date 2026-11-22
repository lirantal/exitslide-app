import { afterEach, expect, test, vi } from 'vitest'
import { isPublicTrafficPage } from './web-analytics'

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules() })

test('allows public document paths and excludes auth, dashboard, API and unknown paths', () => {
  expect(isPublicTrafficPage('/')).toBe(true)
  expect(isPublicTrafficPage('/s/12345678-1234-4234-8234-123456789012')).toBe(true)
  for (const path of ['/dashboard', '/dashboard/new', '/auth/callback', '/sign-in', '/sign-up', '/sign-out', '/healthz', '/_serverFn/test', '/s/invalid', '/unknown']) {
    expect(isPublicTrafficPage(path)).toBe(false)
  }
})

test('only release builds or explicit local testing enable the beacon; previews always disable it', async () => {
  for (const [mode, override, enabled] of [
    ['development', '', false], ['production', '', false], ['release', '', true],
    ['development', 'true', true], ['pr-preview', 'true', false], ['release', 'false', false],
  ] as const) {
    vi.resetModules()
    vi.stubEnv('MODE', mode)
    vi.stubEnv('VITE_CLOUDFLARE_WEB_ANALYTICS_ENABLED', override)
    expect((await import('./web-analytics')).webAnalyticsEnabled).toBe(enabled)
  }
})
