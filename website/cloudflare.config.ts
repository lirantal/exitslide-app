import { bindings, defineConfig } from 'cf/config'

export default defineConfig(({ isPreview, mode }) => {
  if ((mode === 'pr-preview') !== Boolean(isPreview)) {
    throw new Error('Build Worker Previews in pr-preview mode with Cloudflare Preview build output.')
  }

  return {
    worker: {
      name: 'exitslide-website',
      entrypoint: 'src/worker.ts',
      compatibilityDate: '2026-11-19',
      workersDev: false,
      previewUrls: mode === 'release' || mode === 'preview-bootstrap',
      domains: mode === 'release' ? ['exitslide.top', 'www.exitslide.top'] : undefined,
      assets: {
        runWorkerFirst: true,
      },
      env: {
        ASSETS: bindings.assets(),
      },
    },
  }
})
