import { bindings, defineConfig } from 'cf/config'

export default defineConfig(({ mode }) => {
  const staging = mode === 'staging'

  return {
    worker: {
      name: staging ? 'exitslide-frontend-staging' : 'exitslide-frontend',
      entrypoint: 'src/worker.ts',
      compatibilityDate: '2026-11-19',
      compatibilityFlags: ['nodejs_compat'],
      workersDev: staging,
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
          namespace: staging ? '584231905' : '584231906',
          simple: { limit: 300, period: 60 },
        }),
        BACKEND: bindings.worker({
          worker: staging ? 'exitslide-backend-staging' : 'exitslide-backend',
        }),
      },
    },
  }
})
