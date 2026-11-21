import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: { include: ['{backend,frontend,packages}/**/*.test.{ts,tsx}'] },
})
