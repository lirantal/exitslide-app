import { env } from 'node:process'
import { bindings, defineConfig } from 'cf/config'

const localDatabaseId = '00000000-0000-4000-8000-000000000001'

export function backendWorker(mode: string | undefined) {
  const release = mode === 'release'
  const databaseId = release ? env.EXITSLIDE_D1_ID : localDatabaseId
  if (!databaseId || (release && (databaseId === localDatabaseId ||
    !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(databaseId)))) {
    throw new Error('Set EXITSLIDE_D1_ID to the production D1 database UUID for the release build.')
  }

  return {
    name: 'exitslide-backend',
    entrypoint: 'src/index.ts',
    compatibilityDate: '2026-11-19',
    workersDev: false,
    previewUrls: false,
    env: {
      DB: bindings.d1({ name: release ? 'exitslide' : 'exitslide-local', id: databaseId }),
      ...(release ? { POSTHOG_PROJECT_TOKEN: bindings.secret() } : {}),
    },
  }
}

export default defineConfig(({ mode }) => ({ worker: backendWorker(mode) }))
