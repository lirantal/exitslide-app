import { defineConfig } from '@playwright/test'

const origin = new URL(process.env.EXITSLIDE_LIVE_URL || 'https://app.exitslide.top')
const isExitSlideHost = origin.hostname === 'app.exitslide.top'
  || /^exitslide-frontend\.[a-z0-9-]+\.workers\.dev$/.test(origin.hostname)
if (origin.protocol !== 'https:' ||
    !isExitSlideHost ||
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
