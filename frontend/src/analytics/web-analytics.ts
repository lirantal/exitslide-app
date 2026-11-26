// Public Cloudflare Web Analytics site token; this is not an API credential.
export const webAnalyticsToken = import.meta.env.VITE_CLOUDFLARE_WEB_ANALYTICS_TOKEN
  ?? 'd6fa5eaedb3c4c619cf2dba17abdb3ca'
export const webAnalyticsHost = import.meta.env.VITE_CLOUDFLARE_WEB_ANALYTICS_HOST
  ?? 'app.exitslide.top'
export const webAnalyticsEnabled = import.meta.env.MODE !== 'pr-preview'
  && (import.meta.env.VITE_CLOUDFLARE_WEB_ANALYTICS_ENABLED === 'true'
    || (import.meta.env.MODE === 'release' && import.meta.env.VITE_CLOUDFLARE_WEB_ANALYTICS_ENABLED !== 'false'))

export function isPublicTrafficPage(pathname: string) {
  return pathname === '/' || /^\/s\/[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}\/?$/i.test(pathname)
}
