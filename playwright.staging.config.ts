import { defineConfig } from '@playwright/test'

const origin = new URL(process.env.EXITSLIDE_STAGING_URL || 'https://exitslide-frontend-staging.brain-labs.workers.dev')
if (origin.protocol !== 'https:' ||
    !/^exitslide-frontend-staging\.[a-z0-9-]+\.workers\.dev$/.test(origin.hostname) ||
    origin.href !== origin.origin + '/') {
  throw new Error('EXITSLIDE_STAGING_URL must be the HTTPS origin of the ExitSlide staging Worker.')
}

const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE

export default defineConfig({
  testDir: './frontend/e2e-staging',
  timeout: 180_000,
  retries: 0,
  workers: 1,
  use: {
    baseURL: origin.origin,
    browserName: 'chromium',
    launchOptions: executablePath ? { executablePath } : {},
    screenshot: 'off',
    trace: 'off',
    video: 'off',
  },
})
