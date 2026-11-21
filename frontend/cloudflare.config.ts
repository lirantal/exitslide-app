import { bindings, defineConfig } from 'cf/config'

export default defineConfig(({ mode }) => {
  if (mode === 'pr-preview') {
    return {
      worker: {
        name: 'exitslide-pr-preview',
        entrypoint: 'preview/worker.ts',
        compatibilityDate: '2026-11-19',
        compatibilityFlags: ['nodejs_compat'],
        workersDev: false,
        observability: { enabled: false },
      },
    }
  }
  const release = mode === 'release'

  return {
    worker: {
      name: 'exitslide-frontend',
      entrypoint: 'src/worker.ts',
      compatibilityDate: '2026-11-19',
      compatibilityFlags: ['nodejs_compat'],
      workersDev: release,
      previewUrls: false,
      observability: {
        enabled: false,
        logs: { enabled: false, invocationLogs: false },
        traces: { enabled: false },
      },
      env: {
        WORKOS_CLIENT_ID: bindings.secret(),
        WORKOS_REDIRECT_URI: bindings.secret(),
        WORKOS_COOKIE_PASSWORD: bindings.secret(),
        RATING_RATE_LIMIT: bindings.rateLimit({
          namespace: release ? '584231905' : '584231906',
          simple: { limit: 300, period: 60 },
        }),
        BACKEND: bindings.worker({
          worker: 'exitslide-backend',
        }),
      },
    },
  }
})
