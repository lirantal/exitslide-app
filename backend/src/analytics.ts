import {
  analyticsEnabledHeader, analyticsDistinctIdHeader, analyticsSessionIdHeader, sessionIdSchema,
} from '@exitslide/contracts'
import { PostHog } from 'posthog-node'

export type AnalyticsBindings = { POSTHOG_PROJECT_TOKEN?: string }
type ServerEvent = 'session_created' | 'session_updated' | 'session_deleted' | 'rating_submitted'
type AnalyticsRequest = {
  env: AnalyticsBindings
  req: { header(name: string): string | undefined }
  readonly executionCtx: { waitUntil(promise: Promise<unknown>): void }
}

async function opaqueId(input: string) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('exitslide:analytics:v1:' + input))
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('')
}

export function recordProductEvent(
  context: AnalyticsRequest,
  event: ServerEvent,
  subject: { owner: string } | { ratingId: string; score: number },
) {
  const token = context.env.POSTHOG_PROJECT_TOKEN
  if (!token?.startsWith('phc_') || context.req.header(analyticsEnabledHeader) !== '1') return
  try {
    // Without a Worker lifetime extension, skip telemetry rather than risk request failures.
    const execution = context.executionCtx
    const distinctId = sessionIdSchema.safeParse(context.req.header(analyticsDistinctIdHeader)).data
    const sessionId = sessionIdSchema.safeParse(context.req.header(analyticsSessionIdHeader)).data
    execution.waitUntil((async () => {
      const client = new PostHog(token, {
        host: 'https://eu.i.posthog.com', flushAt: 1, flushInterval: 0,
        requestTimeout: 1500, captureMaxRetries: 1, disableGeoip: true,
        enableExceptionAutocapture: false, enableLocalEvaluation: false,
      })
      try {
        const id = 'owner' in subject
          ? distinctId ?? 'speaker:' + await opaqueId(subject.owner)
          : 'rating:' + await opaqueId(subject.ratingId)
        await client.captureImmediate({
          distinctId: id, event,
          properties: {
            source: 'backend', $process_person_profile: false, $geoip_disable: true,
            ...('owner' in subject && sessionId ? { $session_id: sessionId } : {}),
            ...('score' in subject ? { score: subject.score } : {}),
          },
        })
      } finally {
        await client.shutdown()
      }
    })().catch(() => {
      // No raw provider errors, request data, or credentials in logs.
      console.warn('product_analytics_delivery_failed')
    }))
  } catch {
    // Missing execution context or scheduling must never fail the business operation.
  }
}
