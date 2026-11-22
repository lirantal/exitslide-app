import { expect, test } from '@playwright/test'

test('loads the public-page analytics module once and excludes the dashboard', async ({ page, baseURL, browser }) => {
  let loads = 0
  await page.route('https://static.cloudflareinsights.com/beacon.min.js', async route => {
    loads++
    // Execute a stub instead of sending test pageviews to the real Cloudflare site.
    await route.fulfill({ contentType: 'text/javascript', body: 'console.info("Web Analytics test stub loaded")' })
  })
  const home = await page.goto('/')
  expect(home?.headers()['referrer-policy']).toBe('strict-origin')
  await expect.poll(() => loads).toBe(1)
  const beacon = page.locator('#exitslide-web-analytics')
  await expect(beacon).toHaveAttribute('type', 'module')
  await expect(beacon).toHaveAttribute('data-cf-beacon', JSON.stringify({
    token: '00000000000000000000000000000000', spa: false,
  }))
  expect(await page.context().cookies()).toEqual([])
  expect(await page.evaluate(() => ({ local: Object.keys(localStorage), session: Object.keys(sessionStorage) })))
    .toEqual({ local: [], session: [] })

  await page.context().addCookies([{ name: 'exitslide-test-user', value: 'user_second', url: baseURL! }])
  await page.goto('/dashboard')
  await expect(page.getByRole('heading', { name: 'Speaker dashboard' })).toBeVisible()
  await expect(beacon).toHaveCount(0)
  expect(loads).toBe(1)
  await page.getByRole('link', { name: 'New Session' }).click()
  await page.getByLabel('Session title').fill('Traffic analytics test')
  await page.getByLabel('Slide URL').fill('https://example.com/traffic-test')
  await page.getByRole('button', { name: 'Publish Session' }).click()
  await expect(page.getByRole('heading', { name: 'Traffic analytics test' })).toBeVisible()
  const publicUrl = await page.getByLabel('Public Session link').inputValue()
  const attendee = await browser.newPage()
  let attendeeLoads = 0
  try {
    await attendee.route('https://static.cloudflareinsights.com/beacon.min.js', async route => {
      attendeeLoads++
      await route.fulfill({ contentType: 'text/javascript', body: '' })
    })
    await attendee.goto(publicUrl)
    await expect.poll(() => attendeeLoads).toBe(1)
    await expect(attendee.locator('#exitslide-web-analytics')).toHaveCount(1)
    // A rerender of the rating form must not inject a second copy.
    const rating = attendee.getByRole('radio', { name: '4 stars' })
    await expect(rating).toBeEnabled()
    await rating.press('Space')
    expect(attendeeLoads).toBe(1)
    expect(await attendee.context().cookies()).toEqual([])
    expect(await attendee.evaluate(() => Object.keys(localStorage))).toEqual([])
  } finally {
    await attendee.context().close()
    page.once('dialog', dialog => dialog.accept())
    await page.getByRole('button', { name: 'Delete Session' }).click()
  }
})
