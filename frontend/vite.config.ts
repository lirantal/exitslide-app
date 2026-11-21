import { fileURLToPath } from 'node:url'
import { cloudflare } from '@cloudflare/vite-plugin'
import tailwindcss from '@tailwindcss/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { backendWorker } from '../backend/cloudflare.config.ts'

export default defineConfig({
  server: { port: 3000, strictPort: true },
  plugins: [
    cloudflare({
      viteEnvironment: { name: 'ssr' },
      persistState: process.env.EXITSLIDE_LOCAL_STATE
        ? { path: process.env.EXITSLIDE_LOCAL_STATE }
        : undefined,
      auxiliaryWorkers: [{
        config: {
          ...backendWorker(undefined),
          entrypoint: fileURLToPath(new URL('../backend/src/index.ts', import.meta.url)),
        },
        devOnly: true,
      }],
    }),
    tanstackStart(),
    react(),
    tailwindcss(),
  ],
})
