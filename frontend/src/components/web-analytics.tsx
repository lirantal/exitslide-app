import { useEffect } from 'react'
import { isPublicTrafficPage, webAnalyticsEnabled, webAnalyticsHost, webAnalyticsToken } from '../analytics/web-analytics'

export function WebAnalytics() {
  useEffect(() => {
    if (!webAnalyticsEnabled || window.location.hostname !== webAnalyticsHost
      || !isPublicTrafficPage(window.location.pathname)
      || document.getElementById('exitslide-web-analytics')) return

    const script = document.createElement('script')
    script.id = 'exitslide-web-analytics'
    script.type = 'module'
    script.src = 'https://static.cloudflareinsights.com/beacon.min.js'
    script.dataset.cfBeacon = JSON.stringify({ token: webAnalyticsToken, spa: false })
    script.referrerPolicy = 'strict-origin-when-cross-origin'
    document.body.appendChild(script)
    // Keep one beacon for this document. Removing its tag cannot undo vendor listeners.
    // SPA measurement is disabled so it cannot follow navigation into private routes.
  }, [])
  return null
}
