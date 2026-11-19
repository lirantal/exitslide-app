import { env } from 'node:process'
import { bindings, defineConfig } from 'cf/config'

export function backendWorker(mode: string | undefined) {
  return {
    name: mode === 'staging' ? 'exitslide-backend-staging' : 'exitslide-backend',
    entrypoint: 'src/index.ts',
    compatibilityDate: '2026-11-19',
    workersDev: false,
    previewUrls: false,
    env: {
      DB: bindings.d1(mode === 'staging'
        ? { name: 'exitslide-staging', id: env.EXITSLIDE_D1_ID }
        : { name: 'exitslide-local', id: '00000000-0000-4000-8000-000000000001' }),
    },
  }
}

export default defineConfig(({ mode }) => ({ worker: backendWorker(mode) }))
