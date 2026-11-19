import { defineConfig } from 'cf/config'

export function backendWorker(mode: string | undefined) {
  return {
    name: mode === 'staging' ? 'exitslide-backend-staging' : 'exitslide-backend',
    entrypoint: 'src/index.ts',
    compatibilityDate: '2026-11-19',
    workersDev: false,
    previewUrls: false,
  }
}

export default defineConfig(({ mode }) => ({ worker: backendWorker(mode) }))
