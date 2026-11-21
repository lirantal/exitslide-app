import { expect, test } from '@playwright/test'

test('fixture Session changes stay in the reviewer browser', async ({ page, browser }) => {
  await page.goto('/')
  await expect(page.getByRole('complementary', { name: 'Preview controls' })).toBeVisible()
  await page.getByRole('button', { name: 'Speaker 1' }).click()
  await page.getByRole('link', { name: 'New Session' }).click()
  await page.getByLabel('Session title').fill('Browser-only Session')
  await page.getByLabel('Slide URL').fill('https://example.com/deck')
  await page.getByRole('button', { name: 'Publish Session' }).click()
  await expect(page.getByRole('heading', { name: 'Browser-only Session' })).toBeVisible()
  const shared = await page.getByLabel('Public Session link').inputValue()
  const privateUrl = page.url()

  const otherBrowser = await browser.newPage()
  try {
    expect((await otherBrowser.goto(shared))?.status()).toBe(404)
  } finally {
    await otherBrowser.close()
  }

  await page.getByRole('button', { name: 'Speaker 2' }).click()
  await page.goto(privateUrl)
  await expect(page.getByRole('alert')).toHaveText('Session unavailable.')
  await page.goto(shared)
  await page.getByRole('button', { name: 'Attend as guest' }).click()
  await expect(page.getByRole('heading', { name: 'Browser-only Session' })).toBeVisible()
  await page.getByRole('radio', { name: '4 stars' }).press('Space')
  await page.getByRole('button', { name: 'Submit rating' }).click()
  await expect(page.getByRole('status')).toHaveText('Thanks for your feedback.')

  await page.getByRole('button', { name: 'Speaker 1' }).click()
  await page.goto(privateUrl)
  await expect(page.getByText('4 out of 5')).toHaveCount(1)
  await page.getByRole('button', { name: 'Reset samples' }).click()
  expect((await page.goto(shared))?.status()).toBe(404)
})
