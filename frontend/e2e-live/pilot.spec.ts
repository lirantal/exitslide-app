import { randomUUID } from 'node:crypto'
import { expect, test, type Page } from '@playwright/test'
import { attachLiveNetwork } from './live-network'
import { smokeWorkOS, type TestSpeaker } from './workos'

async function signIn(page: Page, origin: string, speaker: TestSpeaker) {
  await attachLiveNetwork(page, origin)
  await page.goto(origin + '/sign-in')
  const hosted = new URL(page.url())
  if (hosted.protocol !== 'https:' || !hosted.hostname.endsWith('.authkit.app')) {
    throw new Error('Expected the WorkOS hosted sign-in page.')
  }
  const next = page.getByRole('button', { name: /^(continue(?: with email| with password)?|sign in|log in)\s*$/i }).first()
  await page.locator('input[type=email]').fill(speaker.email)
  const password = page.locator('input[type=password]')
  if (!await password.isVisible()) await next.click()
  await password.fill(speaker.password)
  await next.click()
  await page.waitForURL(url => url.origin === origin && url.pathname === '/dashboard')
  await expect(page.getByRole('heading', { name: 'Speaker dashboard' })).toBeVisible()
}

function isSignIn(origin: string, url: URL) {
  return (url.origin === origin && url.pathname === '/sign-in') || url.hostname.endsWith('.authkit.app')
}

test('live WorkOS speakers can publish, view private feedback, retire, and sign out', async ({ browser, baseURL }) => {
  if (!baseURL) throw new Error('Specify the ExitSlide live origin.')
  const origin = baseURL
  const health = await fetch(origin + '/healthz', { redirect: 'error', signal: AbortSignal.timeout(10_000) })
  expect(health.status).toBe(200)
  expect(await health.json()).toMatchObject({ service: 'exitslide-backend', status: 'ok' })
  const workos = smokeWorkOS()
  const speakers: TestSpeaker[] = []
  const title = 'ExitSlide smoke ' + randomUUID()
  const owner = await browser.newPage()
  const observer = await browser.newPage()
  const attendee = await browser.newPage({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true })
  const pages = [owner, observer, attendee]
  for (const page of pages) {
    // Keep automated traffic out of the public Web Analytics dataset.
    await page.route('https://static.cloudflareinsights.com/**', route => route.abort())
    await page.route('https://cloudflareinsights.com/**', route => route.abort())
    // Production smoke exercises business flows without populating product analytics.
    await page.addInitScript(() => localStorage.setItem('exitslide:product-analytics:v1', 'declined'))
    page.setDefaultTimeout(12_000)
    page.setDefaultNavigationTimeout(20_000)
  }

  let step = 'provision smoke speakers'
  let sessionMayExist = false
  const failures: string[] = []
  try {
    speakers.push(await workos.createSpeaker())
    speakers.push(await workos.createSpeaker())
    step = 'real hosted sign-in for each test speaker'
    await signIn(owner, origin, speakers[0])
    await signIn(observer, origin, speakers[1])

    step = 'publish a Session from the owner dashboard'
    await owner.getByRole('link', { name: 'New Session' }).click()
    await owner.getByLabel('Session title').fill(title)
    await owner.getByLabel('Slide URL').fill('https://example.com/slides')
    sessionMayExist = true
    await owner.getByRole('button', { name: 'Publish Session' }).click()
    await expect(owner.getByRole('heading', { name: title })).toBeVisible()
    const privateUrl = owner.url()
    const publicUrl = await owner.getByLabel('Public Session link').inputValue()
    const publicPage = new URL(publicUrl)
    expect(publicPage.origin).toBe(origin)
    expect(publicPage.pathname).toMatch(/^\/s\/[0-9a-f-]+$/)

    step = 'open slides and submit anonymous feedback'
    await attachLiveNetwork(attendee, origin)
    await attendee.goto(publicUrl)
    await expect(attendee.getByRole('link', { name: /Get slides/ })).toHaveAttribute('href', 'https://example.com/slides')
    await expect(attendee.getByRole('button', { name: 'Submit rating' })).toBeDisabled()
    const fourStars = attendee.getByRole('radio', { name: '4 stars' })
    await expect(fourStars).toBeEnabled()
    await fourStars.press('Space')
    await attendee.getByRole('button', { name: 'Submit rating' }).click()
    await expect(attendee.getByRole('status')).toHaveText('Thanks for your feedback.')

    step = 'enforce private feedback across WorkOS speakers'
    await owner.reload()
    await expect(owner.getByText('4 out of 5')).toHaveCount(1)
    await observer.goto(privateUrl)
    await expect(observer.getByRole('alert')).toHaveText('Session unavailable.')
    await observer.goto(publicUrl)
    await expect(observer.getByRole('link', { name: /Get slides/ })).toBeVisible()

    step = 'edit the Session while keeping its link and rating'
    await owner.getByText('Edit Session', { exact: true }).click()
    await owner.getByLabel('Slide URL').fill('https://example.com/updated')
    await owner.getByRole('button', { name: 'Save changes' }).click()
    await expect(owner.getByRole('status')).toHaveText('Changes saved.')
    await expect(owner.getByLabel('Public Session link')).toHaveValue(publicUrl)
    await expect(owner.getByText('4 out of 5')).toHaveCount(1)
    await attendee.reload()
    await expect(attendee.getByRole('link', { name: /Get slides/ })).toHaveAttribute('href', 'https://example.com/updated')

    step = 'retire the link and reject feedback from a stale page'
    owner.once('dialog', dialog => dialog.accept())
    await owner.getByRole('button', { name: 'Delete Session' }).click()
    await expect(owner.getByText('You haven’t created a Session yet.')).toBeVisible()
    sessionMayExist = false
    await expect(fourStars).toBeEnabled()
    await fourStars.press('Space')
    await attendee.getByRole('button', { name: 'Submit rating' }).click()
    await expect(attendee.getByRole('alert')).toHaveText('Session unavailable.')
    expect((await attendee.reload())?.status()).toBe(404)

    step = 'sign out once and return from WorkOS to the live homepage'
    const logout = owner.waitForResponse(response => {
      const url = new URL(response.url())
      return url.hostname === 'api.workos.com' && url.pathname === '/user_management/sessions/logout'
    }, { timeout: 15_000 })
    const [provider] = await Promise.all([logout, owner.getByRole('button', { name: 'Sign out' }).click()])
    expect(provider.status()).toBe(302)
    await owner.waitForURL(url => url.origin === origin && url.pathname === '/', { timeout: 15_000 })
    await expect(owner.getByRole('link', { name: 'Sign in', exact: true })).toBeVisible()
    await owner.goto(origin + '/dashboard', { waitUntil: 'commit' })
    await owner.waitForURL(url => isSignIn(origin, url))
  } catch {
    // OAuth callback URLs and temporary credentials can appear in Playwright action errors.
    failures.push('Live smoke failed while trying to ' + step + '.')
  } finally {
    let canRemoveOwner = true
    if (sessionMayExist) {
      try {
        await owner.goto(origin + '/dashboard')
        await expect(owner.getByRole('heading', { name: 'Speaker dashboard' })).toBeVisible()
        const link = owner.getByRole('link', { name: title, exact: true })
        if (await link.count()) {
          await link.click()
          owner.once('dialog', dialog => dialog.accept())
          await owner.getByRole('button', { name: 'Delete Session' }).click()
          await expect(owner.getByText('You haven’t created a Session yet.')).toBeVisible()
        }
      } catch {
        canRemoveOwner = false
        failures.push('Could not retire the temporary Session. Its test owner was kept for cleanup.')
      }
    }
    const removable = canRemoveOwner ? speakers : speakers.slice(1)
    const cleanup = await Promise.allSettled(removable.map(speaker => workos.deleteSpeaker(speaker.id)))
    if (cleanup.some(result => result.status === 'rejected')) failures.push('Could not remove all temporary WorkOS speakers.')
    await Promise.allSettled(pages.map(page => page.context().close()))
  }

  if (failures.length) throw new Error(failures.join(' '))
})
