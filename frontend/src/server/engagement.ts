import { engagementCountrySchema, engagementHeader, sessionIdSchema } from '@exitslide/contracts'
import type { WorkerContext } from './backend'

type EdgeRequest = Request & { cf?: { country?: string; botManagement?: { verifiedBot?: boolean } } }

function navigationAttribution(request: EdgeRequest) {
  const { headers } = request
  const mode = headers.get('Sec-Fetch-Mode')
  const destination = headers.get('Sec-Fetch-Dest')
  if (request.method !== 'GET' || (mode && mode !== 'navigate') ||
    (destination && destination !== 'document') || request.cf?.botManagement?.verifiedBot ||
    /prefetch|prerender|preview/i.test([headers.get('Sec-Purpose'), headers.get('Purpose'), headers.get('X-Purpose'), headers.get('X-Moz')].join(' ')) ||
    /bot\b|crawler|spider|facebookexternalhit|whatsapp|slack-imgproxy/i.test(headers.get('User-Agent') ?? '')) {
    return undefined
  }
  return engagementCountrySchema.safeParse(request.cf?.country).data ?? 'unknown'
}

export function publicSessionVisit(request: Request) {
  const path = new URL(request.url).pathname
  const id = sessionIdSchema.safeParse(/^\/s\/([^/]+)\/?$/.exec(path)?.[1]).data
  const attribution = id && navigationAttribution(request)
  return id && attribution ? { id, attribution } : undefined
}

export async function slideRedirect(request: Request, backend: WorkerContext['backend']) {
  const path = new URL(request.url).pathname
  const match = /^\/s\/([^/]+)\/slides\/?$/.exec(path)
  if (!match) return

  const headers = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' }
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method not allowed.', { status: 405, headers: { ...headers, Allow: 'GET, HEAD' } })
  }
  const body = (message: string) => request.method === 'HEAD' ? null : message
  const id = sessionIdSchema.safeParse(match[1]).data
  if (!id) return new Response(body('Session unavailable.'), { status: 404, headers })

  try {
    const attribution = navigationAttribution(request)
    const response = await backend.fetch(new Request('https://exitslide-backend/public/sessions/' + id + '/slides', {
      redirect: 'manual',
      headers: attribution ? { [engagementHeader]: attribution } : undefined,
    }))
    const location = response.headers.get('Location')
    if (response.status === 302 && location) {
      return new Response(null, { status: 302, headers: { ...headers, Location: location } })
    }
    if (response.status === 404) return new Response(body('Session unavailable.'), { status: 404, headers })
  } catch {
    // Keep service-binding failures out of public responses.
  }
  return new Response(body('Slides are temporarily unavailable. Try again.'), { status: 503, headers })
}
