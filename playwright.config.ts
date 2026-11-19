import { defineConfig } from '@playwright/test'

const baseURL = 'http://127.0.0.1:3100'
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE

export default defineConfig({
  testDir: './frontend/e2e',
  timeout: 45000,
  use: {
    baseURL,
    browserName: 'chromium',
    launchOptions: executablePath ? { executablePath } : {},
  },
  webServer: {
    command: 'node frontend/e2e/serve.mjs',
    url: baseURL + '/healthz',
    timeout: 90000,
    reuseExistingServer: false,
  },
})
