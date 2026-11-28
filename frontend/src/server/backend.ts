import {
  actorHeader, apiErrorSchema, analyticsContextSchema, analyticsEnabledHeader,
  analyticsDistinctIdHeader, analyticsSessionIdHeader, type AnalyticsContext,
  engagementHeader,
} from '@exitslide/contracts'

export interface WorkerContext {
  backend: { fetch(request: Request): Promise<Response> }
  ratingLimiter: { limit(options: { key: string }): Promise<{ success: boolean }> }
  publicSessionVisit?: { id: string; attribution: string }
}

type BackendOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  owner?: string
  body?: unknown
  analytics?: AnalyticsContext
  engagement?: string
}

export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; message: string }

export async function requestBackend<T>(
  backend: WorkerContext['backend'],
  path: string,
  schema: { parse(value: unknown): T },
  { method = 'GET', owner, body, analytics, engagement }: BackendOptions = {},
): Promise<Result<T>> {
  const headers = new Headers()
  if (owner) headers.set(actorHeader, owner)
  if (engagement) headers.set(engagementHeader, engagement)
  if (body !== undefined) headers.set('Content-Type', 'application/json')
  if (analytics) {
    const attribution = analyticsContextSchema.parse(analytics)
    headers.set(analyticsEnabledHeader, attribution.enabled ? '1' : '0')
    if (attribution.enabled && attribution.distinctId) headers.set(analyticsDistinctIdHeader, attribution.distinctId)
    if (attribution.enabled && attribution.sessionId) headers.set(analyticsSessionIdHeader, attribution.sessionId)
  }

  try {
    const result = await backend.fetch(new Request('https://exitslide-backend' + path, {
      method, headers, body: body === undefined ? undefined : JSON.stringify(body),
    }))
    if (result.status === 204) return { ok: true, data: schema.parse(null) }
    const payload: unknown = await result.json()
    if (result.ok) return { ok: true, data: schema.parse(payload) }

    return { ok: false, status: result.status, message: apiErrorSchema.parse(payload).message }
  } catch {
    return { ok: false, status: 503, message: 'The service is temporarily unavailable. Try again.' }
  }
}
