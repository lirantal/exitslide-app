import { gunzipSync } from 'node:zlib'
import { expect, test } from '@playwright/test'

test.use({ userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36' })

test('PostHog starts by default in the dashboard, sends sanitized actions, and respects opt-out', async ({ page, baseURL }) => {
  // Exercise the production bot filter with a normal-browser environment.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false })
    // Playwright's headless shell also advertises HeadlessChrome via client hints.
    Object.defineProperty(navigator, 'userAgentData', { get: () => ({
      brands: [{ brand: 'Chromium', version: '142' }], mobile: false, platform: 'Linux',
    }) })
  })
  const requests: string[] = []
  const captured: Array<{ event: string; properties: Record<string, unknown> }> = []
  await page.route('https://*.posthog.com/**', async route => {
    const request = route.request()
    requests.push(request.url())
    if (request.url().includes('/e/')) {
      const bytes = request.postDataBuffer()!
      const body = bytes[0] === 0x1f && bytes[1] === 0x8b ? gunzipSync(bytes).toString() : bytes.toString()
      const json = new URL(request.url()).searchParams.get('compression') === 'base64'
        ? Buffer.from(body.startsWith('data=') ? new URLSearchParams(body).get('data')! : body, 'base64').toString()
        : body
      const data = JSON.parse(json)
      captured.push(...(data.batch ?? (Array.isArray(data) ? data : [data])))
    }
    await route.fulfill({ contentType: 'application/json', body: '{"status":1}' })
  })

  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Sign in', exact: true })).toBeVisible()
  expect(requests).toEqual([])
  expect(await page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('ph_')))).toEqual([])

  await page.context().addCookies([{ name: 'exitslide-test-user', value: 'user_second', url: baseURL! }])
  await page.goto('/dashboard')
  await expect.poll(() => captured.some(event => event.event === 'dashboard_viewed')).toBe(true)
  await page.getByText('Privacy preferences', { exact: true }).click()
  const preference = page.getByRole('checkbox', { name: 'Product analytics', exact: true })
  await expect(preference).toBeEnabled()
  await expect(preference).toBeChecked()
  expect(await page.evaluate(() => localStorage.getItem('exitslide:product-analytics:v1'))).toBeNull()
  await page.getByRole('link', { name: 'New Session' }).click()
  await expect(page.getByRole('heading', { name: 'New Session' })).toBeVisible()
  await expect.poll(() => ({ requests, captured })).toMatchObject({
    captured: expect.arrayContaining([expect.objectContaining({ event: 'session_create_started' })]),
  })
  await page.getByLabel('Session title').fill('Secret analytics test title')
  await page.getByLabel('Slide URL').fill('https://example.com/private-deck?secret=123')
  await page.getByRole('button', { name: 'Publish Session' }).click()
  await expect(page.getByRole('heading', { name: 'Secret analytics test title' })).toBeVisible()
  await expect.poll(() => captured.some(event => event.event === 'session_detail_viewed')).toBe(true)
  expect(captured.some(event => ['session_created', 'session_updated', 'session_deleted'].includes(event.event))).toBe(false)
  expect(captured.every(event => event.properties.source === 'browser')).toBe(true)
  const serialized = JSON.stringify(captured)
  expect(serialized).not.toContain('Secret analytics test title')
  expect(serialized).not.toContain('private-deck')
  expect(serialized).not.toContain('user_second')
  expect(serialized).not.toContain('/dashboard/')
  expect(serialized).not.toContain('$current_url')
  expect(serialized).not.toContain('$set_once')
  expect(captured.every(event => event.properties.token === 'phc_e2e_only')).toBe(true)
  expect(requests.every(url => new URL(url).origin === 'https://eu.i.posthog.com'
    && new URL(url).pathname.endsWith('/e/'))).toBe(true)
  expect((await page.context().cookies()).filter(cookie => cookie.name.startsWith('ph_'))).toEqual([])

  await preference.uncheck()
  const count = requests.length
  await page.getByRole('link', { name: 'ExitSlide', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Speaker dashboard' })).toBeVisible()
  expect(requests).toHaveLength(count)
  expect(await page.evaluate(() => Object.keys(localStorage).filter(key => /^ph_.*_posthog$/.test(key)))).toEqual([])
  await page.reload()
  await page.getByText('Privacy preferences', { exact: true }).click()
  await expect(preference).not.toBeChecked()
  expect(requests).toHaveLength(count)

  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page.getByRole('link', { name: 'Sign in', exact: true })).toBeVisible()
  await page.context().addCookies([{ name: 'exitslide-test-user', value: 'user_second', url: baseURL! }])
  await page.goto('/dashboard')
  await page.getByText('Privacy preferences', { exact: true }).click()
  await expect(preference).toBeEnabled()
  await expect(preference).not.toBeChecked()
  expect(requests).toHaveLength(count)

  // Even a previously accepted browser sends no PostHog requests on public pages.
  await page.evaluate(() => localStorage.setItem('exitslide:product-analytics:v1', 'accepted'))
  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Sign in', exact: true })).toBeVisible()
  expect(requests).toHaveLength(count)
})
