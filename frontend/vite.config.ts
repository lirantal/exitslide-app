import { fileURLToPath } from 'node:url'
import { cloudflare } from '@cloudflare/vite-plugin'
import tailwindcss from '@tailwindcss/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { backendWorker } from '../backend/cloudflare.config.ts'

export default defineConfig(({ mode }) => ({
  server: { port: 3000, strictPort: true },
  plugins: [
    cloudflare({
      viteEnvironment: { name: 'ssr' },
      auxiliaryWorkers: [{
        config: {
          ...backendWorker(mode),
          entrypoint: fileURLToPath(new URL('../backend/src/index.ts', import.meta.url)),
        },
        devOnly: true,
      }],
    }),
    tanstackStart(),
    react(),
    tailwindcss(),
  ],
}))
