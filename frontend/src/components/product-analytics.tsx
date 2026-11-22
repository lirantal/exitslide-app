import { useRouterState } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import {
  analyticsConfigured, analyticsPreferenceKey, captureProductEvent, isProductAnalyticsEnabled,
  revokeProductAnalytics, saveAnalyticsPreference, startProductAnalytics, suspendProductAnalytics,
} from '../analytics/product-analytics'

export function ProductAnalytics() {
  const pathname = useRouterState({ select: state => state.location.pathname })
  const [enabled, setEnabled] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setEnabled(isProductAnalyticsEnabled())
    setReady(true)
    function sync(event: StorageEvent) {
      if (event.key === analyticsPreferenceKey || event.key === null) {
        if (!isProductAnalyticsEnabled()) revokeProductAnalytics()
        setEnabled(isProductAnalyticsEnabled())
      }
    }
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener('storage', sync)
      suspendProductAnalytics()
    }
  }, [])

  useEffect(() => {
    if (!ready || !enabled) {
      revokeProductAnalytics()
      return
    }
    let cancelled = false
    void startProductAnalytics().then(() => {
      if (cancelled) return
      captureProductEvent(pathname.replace(/\/$/, '') === '/dashboard' ? 'dashboard_viewed'
        : pathname === '/dashboard/new' ? 'session_create_started' : 'session_detail_viewed')
    })
    return () => {
      cancelled = true
      suspendProductAnalytics()
    }
  }, [ready, enabled, pathname])

  if (!analyticsConfigured) return null

  return (
    <details className="text-sm text-slate-600">
      <summary className="cursor-pointer">Privacy preferences</summary>
      <div className="mt-3 grid gap-2">
        <p id="product-analytics-description">
          Product analytics is on by default to help us improve ExitSlide by sending dashboard actions and a random browser
          identifier to PostHog in the EU. We don’t send Session titles, slide links, form contents, or
          session recordings. Your choice and, when enabled, the identifier are stored in this browser.
          Turn off anytime to stop collection and remove the analytics identifier. Previously sent events remain.
        </p>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={enabled} disabled={!ready}
            aria-describedby="product-analytics-description"
            onChange={event => {
              const enabled = event.target.checked
              if (!enabled) revokeProductAnalytics()
              if (saveAnalyticsPreference(enabled)) setEnabled(enabled)
            }} />
          Product analytics
        </label>
      </div>
    </details>
  )
}
