import { defineConfig } from '@playwright/test'

const origin = new URL(process.env.EXITSLIDE_LIVE_URL || 'https://exitslide-frontend.brain-labs.workers.dev')
if (origin.protocol !== 'https:' ||
    !/^exitslide-frontend\.[a-z0-9-]+\.workers\.dev$/.test(origin.hostname) ||
    origin.href !== origin.origin + '/') {
  throw new Error('EXITSLIDE_LIVE_URL must be the HTTPS origin of the ExitSlide live Worker.')
}

const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE

export default defineConfig({
  testDir: './frontend/e2e-live',
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
