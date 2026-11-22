import { fileURLToPath } from 'node:url'
import { defineConfig, mergeConfig } from 'vite'
import frontendConfig from '../vite.config.ts'

// The integration suite uses fixture identities with the real local backend.
export default defineConfig(config => mergeConfig(frontendConfig(config), {
  envDir: process.env.EXITSLIDE_E2E_ENV_DIR,
  define: {
    'import.meta.env.VITE_POSTHOG_PROJECT_TOKEN': JSON.stringify('phc_e2e_only'),
    'import.meta.env.VITE_POSTHOG_ENABLED': JSON.stringify('true'),
    'import.meta.env.VITE_CLOUDFLARE_WEB_ANALYTICS_ENABLED': JSON.stringify('true'),
    'import.meta.env.VITE_CLOUDFLARE_WEB_ANALYTICS_HOST': JSON.stringify('127.0.0.1'),
    'import.meta.env.VITE_CLOUDFLARE_WEB_ANALYTICS_TOKEN': JSON.stringify('00000000000000000000000000000000'),
  },
  resolve: {
    alias: {
      '@workos/authkit-tanstack-react-start': fileURLToPath(new URL('./auth-fixture.ts', import.meta.url)),
    },
  },
}))
