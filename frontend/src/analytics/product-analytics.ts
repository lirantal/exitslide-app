import type { CaptureResult, PostHog } from 'posthog-js'

export const analyticsConsentKey = 'exitslide:product-analytics:v1'

const events = [
  'dashboard_viewed', 'session_create_started', 'session_detail_viewed',
  'session_created', 'session_updated', 'session_deleted', 'session_link_copied',
] as const
type ProductEvent = typeof events[number]

// Public ingestion token, intended to ship in browser bundles. Never use a phx_ key here.
const token = (import.meta.env.VITE_POSTHOG_PROJECT_TOKEN as string | undefined)
  ?? 'phc_BabZ2VTdXpANyJB3NwmskZ2zdGJ69LQzbGMtSrKiiuwx'
export const analyticsConfigured = Boolean(token?.startsWith('phc_'))
  && import.meta.env.MODE !== 'pr-preview'
  && (!import.meta.env.DEV || import.meta.env.VITE_POSTHOG_ENABLED === 'true')

let client: PostHog | undefined
let active = false
let generation = 0

export function hasAnalyticsConsent() {
  try {
    return window.localStorage.getItem(analyticsConsentKey) === 'accepted'
  } catch {
    return false
  }
}

export function saveAnalyticsConsent(accepted: boolean) {
  try {
    window.localStorage.setItem(analyticsConsentKey, accepted ? 'accepted' : 'declined')
    return true
  } catch {
    return false
  }
}

function dashboardScreen() {
  const path = window.location.pathname.replace(/\/$/, '')
  if (path === '/dashboard') return 'dashboard'
  if (path === '/dashboard/new') return 'session_create'
  if (/^\/dashboard\/[^/]+$/.test(path)) return 'session_detail'
  return undefined
}

// The SDK adds URLs, referrers and initial properties even to manual captures.
// Allow only protocol/pseudonymous identity fields and our fixed screen names.
export function filterProductEvent(event: CaptureResult | null): CaptureResult | null {
  const screen = dashboardScreen()
  if (!event || !active || !hasAnalyticsConsent() || !screen
    || !events.includes(event.event as ProductEvent)) return null
  const allowed = [
    'token', 'distinct_id', '$device_id', '$session_id', '$window_id',
    '$lib', '$lib_version', '$is_identified', '$process_person_profile',
  ]
  const properties = Object.fromEntries(
    Object.entries(event.properties).filter(([key]) => allowed.includes(key)),
  )
  properties.screen = screen
  properties.$geoip_disable = true
  return { uuid: event.uuid, event: event.event, timestamp: event.timestamp, properties }
}

export async function startProductAnalytics() {
  const attempt = ++generation
  if (!analyticsConfigured || !hasAnalyticsConsent() || !dashboardScreen()) return
  try {
    // No PostHog code, requests, or analytics storage before explicit consent.
    const { default: posthog } = await import('posthog-js/no-external')
    if (attempt !== generation || !hasAnalyticsConsent() || !dashboardScreen()) return
    if (!client) {
      posthog.init(token!, {
        api_host: 'https://eu.i.posthog.com',
        ui_host: 'https://eu.posthog.com',
        defaults: '2026-08-30',
        persistence: 'localStorage',
        cross_subdomain_cookie: false,
        opt_out_capturing_by_default: true,
        opt_out_persistence_by_default: true,
        person_profiles: 'never',
        autocapture: false,
        capture_pageview: false,
        capture_pageleave: false,
        capture_dead_clicks: false,
        rageclick: false,
        capture_exceptions: false,
        capture_heatmaps: false,
        capture_performance: false,
        disable_session_recording: true,
        disable_surveys: true,
        disable_conversations: true,
        disable_product_tours: true,
        disable_external_dependency_loading: true,
        advanced_disable_flags: true,
        advanced_disable_toolbar_metrics: true,
        save_campaign_params: false,
        save_referrer: false,
        ip: false,
        request_batching: false,
        before_send: filterProductEvent,
      })
      client = posthog
    }
    active = true
    client.opt_in_capturing()
  } catch {
    // A blocked or unavailable analytics SDK must not break the dashboard.
    active = false
  }
}

export function suspendProductAnalytics() {
  active = false
  generation++
}

export function revokeProductAnalytics() {
  suspendProductAnalytics()
  client?.opt_out_capturing()
}

export function clearAnalyticsOnSignOut() {
  revokeProductAnalytics()
  try {
    window.localStorage.removeItem(analyticsConsentKey)
  } catch { /* Unavailable storage already prevents consent. */ }
}

export function captureProductEvent(event: ProductEvent) {
  if (active && hasAnalyticsConsent() && dashboardScreen()) client?.capture(event)
}
