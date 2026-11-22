import { afterEach, beforeEach, expect, test, vi } from 'vitest'
const sdk = {
  init: vi.fn(),
  opt_in_capturing: vi.fn(),
  opt_out_capturing: vi.fn(),
  capture: vi.fn(),
}
const sdkImported = vi.fn()

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  vi.stubEnv('MODE', 'production')
  vi.stubEnv('DEV', false)
  vi.stubEnv('VITE_POSTHOG_PROJECT_TOKEN', 'phc_test')
  const storage = new Map<string, string>()
  vi.stubGlobal('window', {
    location: { pathname: '/dashboard/new' },
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    },
  })
  vi.doMock('posthog-js/no-external', () => {
    sdkImported()
    return { default: sdk }
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

test('does not load or call PostHog before consent, after rejection, or on public pages', async () => {
  const analytics = await import('./product-analytics')
  await analytics.startProductAnalytics()
  analytics.captureProductEvent('session_created')
  analytics.saveAnalyticsConsent(false)
  await analytics.startProductAnalytics()
  analytics.saveAnalyticsConsent(true)
  window.location.pathname = '/s/private-session-id'
  await analytics.startProductAnalytics()
  expect(sdkImported).not.toHaveBeenCalled()
  expect(sdk.capture).not.toHaveBeenCalled()
})

test('only sends allowed events with anonymous protocol fields and a fixed screen', async () => {
  const analytics = await import('./product-analytics')
  analytics.saveAnalyticsConsent(true)
  await analytics.startProductAnalytics()
  expect(sdk.init).toHaveBeenCalledWith('phc_test', expect.objectContaining({
    api_host: 'https://eu.i.posthog.com', person_profiles: 'never',
    autocapture: false, disable_session_recording: true, advanced_disable_flags: true,
  }))
  expect(sdk.opt_in_capturing).toHaveBeenCalledOnce()
  const filtered = analytics.filterProductEvent({
    uuid: 'test-event',
    $set_once: { $initial_current_url: 'private' },
    $set: { email: 'private@example.com' },
    event: 'session_created',
    properties: {
      token: 'phc_test', distinct_id: 'random-browser-id', $lib: 'web',
      $current_url: 'https://example.com/dashboard/secret?token=private',
      $referrer: 'https://example.com/auth/callback?code=private',
      $set_once: { $initial_current_url: 'private' },
      title: 'Private talk', slideUrl: 'https://private.example', user_id: 'user_first',
    },
  })
  expect(filtered?.properties).toEqual({
    token: 'phc_test', distinct_id: 'random-browser-id', $lib: 'web',
    screen: 'session_create', $geoip_disable: true,
  })
  expect(filtered).not.toHaveProperty('$set_once')
  expect(filtered).not.toHaveProperty('$set')
  expect(analytics.filterProductEvent({ uuid: 'test-event', event: '$autocapture', properties: {} })).toBeNull()
  window.location.pathname = '/dashboard/private-session-id'
  expect(analytics.filterProductEvent({ uuid: 'test-event', event: 'session_detail_viewed', properties: {} })?.properties.screen)
    .toBe('session_detail')
})

test('stops new captures on withdrawal, public navigation and sign-out', async () => {
  const analytics = await import('./product-analytics')
  analytics.saveAnalyticsConsent(true)
  await analytics.startProductAnalytics()
  analytics.captureProductEvent('session_created')
  expect(sdk.capture).toHaveBeenCalledOnce()
  window.location.pathname = '/'
  analytics.captureProductEvent('session_updated')
  expect(analytics.filterProductEvent({ uuid: 'test-event', event: 'session_created', properties: {} })).toBeNull()
  window.location.pathname = '/dashboard'
  analytics.saveAnalyticsConsent(false)
  analytics.revokeProductAnalytics()
  analytics.captureProductEvent('session_deleted')
  expect(sdk.capture).toHaveBeenCalledOnce()
  expect(sdk.opt_out_capturing).toHaveBeenCalledOnce()
  analytics.saveAnalyticsConsent(true)
  analytics.clearAnalyticsOnSignOut()
  expect(analytics.hasAnalyticsConsent()).toBe(false)
})

test('does not initialize when consent is withdrawn while the SDK import is pending', async () => {
  const analytics = await import('./product-analytics')
  analytics.saveAnalyticsConsent(true)
  const starting = analytics.startProductAnalytics()
  analytics.saveAnalyticsConsent(false)
  analytics.revokeProductAnalytics()
  await starting
  expect(sdk.init).not.toHaveBeenCalled()
})

test('fixture previews and ordinary local development never initialize PostHog', async () => {
  vi.stubEnv('MODE', 'pr-preview')
  let analytics = await import('./product-analytics')
  analytics.saveAnalyticsConsent(true)
  await analytics.startProductAnalytics()
  expect(analytics.analyticsConfigured).toBe(false)
  vi.resetModules()
  vi.stubEnv('MODE', 'development')
  vi.stubEnv('DEV', true)
  analytics = await import('./product-analytics')
  await analytics.startProductAnalytics()
  expect(analytics.analyticsConfigured).toBe(false)
  expect(sdkImported).not.toHaveBeenCalled()
})

test('unavailable browser storage fails closed', async () => {
  const analytics = await import('./product-analytics')
  window.localStorage.getItem = () => { throw new Error('Blocked') }
  window.localStorage.setItem = () => { throw new Error('Blocked') }
  expect(analytics.saveAnalyticsConsent(true)).toBe(false)
  await analytics.startProductAnalytics()
  expect(sdkImported).not.toHaveBeenCalled()
})
