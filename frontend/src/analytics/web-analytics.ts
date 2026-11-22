// Public Cloudflare Web Analytics site token; this is not an API credential.
export const webAnalyticsToken = import.meta.env.VITE_CLOUDFLARE_WEB_ANALYTICS_TOKEN
  ?? '0b79fa3f4c1f40fcbb9a98fc69cfa76c'
export const webAnalyticsHost = import.meta.env.VITE_CLOUDFLARE_WEB_ANALYTICS_HOST
  ?? 'exitslide-frontend.brain-labs.workers.dev'
export const webAnalyticsEnabled = import.meta.env.MODE !== 'pr-preview'
  && (import.meta.env.VITE_CLOUDFLARE_WEB_ANALYTICS_ENABLED === 'true'
    || (import.meta.env.MODE === 'release' && import.meta.env.VITE_CLOUDFLARE_WEB_ANALYTICS_ENABLED !== 'false'))

export function isPublicTrafficPage(pathname: string) {
  return pathname === '/' || /^\/s\/[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}\/?$/i.test(pathname)
}
