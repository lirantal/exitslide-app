import { defineConfig } from 'cf/config'

export default defineConfig({
  worker: {
    name: 'exitslide-frontend-staging',
    entrypoint: 'worker.ts',
    compatibilityDate: '2026-11-19',
    workersDev: true,
    previewUrls: false,
    observability: { enabled: false },
  },
})
