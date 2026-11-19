import { fileURLToPath } from 'node:url'
import { defineConfig, mergeConfig } from 'vite'
import frontendConfig from '../vite.config.ts'

// Only the Playwright server loads this config. Production and staging use the real SDK.
export default defineConfig(config => mergeConfig(frontendConfig(config), {
  envDir: process.env.EXITSLIDE_E2E_ENV_DIR,
  resolve: {
    alias: {
      '@workos/authkit-tanstack-react-start': fileURLToPath(new URL('./auth-fixture.ts', import.meta.url)),
    },
  },
}))
