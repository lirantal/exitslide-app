import { defineConfig } from '@playwright/test'

const baseURL = 'http://127.0.0.1:3156'
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE

export default defineConfig({
  testDir: './frontend/preview',
  testMatch: 'preview.spec.ts',
  use: {
    baseURL,
    launchOptions: executablePath ? { executablePath } : {},
  },
  webServer: {
    command: 'pnpm --filter @exitslide/frontend exec vite preview --mode pr-preview --host 127.0.0.1 --port 3156 --strictPort',
    url: baseURL + '/healthz',
    reuseExistingServer: false,
  },
})
