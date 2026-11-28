import { backendHealthSchema } from '@exitslide/contracts'
import type { WorkerContext } from './server/backend'
import handler from '@tanstack/react-start/server-entry'
import { publicSessionVisit, slideRedirect } from './server/engagement'

interface Env {
  BACKEND: WorkerContext['backend']
  RATING_RATE_LIMIT: WorkerContext['ratingLimiter']
  WORKOS_CLIENT_ID?: string
  WORKOS_REDIRECT_URI?: string
  WORKOS_COOKIE_PASSWORD?: string
}

const noStore = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'strict-origin' }

export default {
  async fetch(request: Request, env: Env) {
    if (request.method === 'GET' && new URL(request.url).pathname === '/healthz') {
      try {
        const probe = new Request('https://exitslide-backend/healthz')
        const response = await env.BACKEND.fetch(probe)
        if (response.ok) {
          return Response.json(backendHealthSchema.parse(await response.json()), { headers: noStore })
        }
      } catch {
        console.error('backend_health_unavailable')
      }

      return Response.json({ status: 'unavailable' }, { status: 503, headers: noStore })
    }

    const slides = await slideRedirect(request, env.BACKEND)
    if (slides) return slides

    if (!env.WORKOS_CLIENT_ID || !env.WORKOS_REDIRECT_URI || !env.WORKOS_COOKIE_PASSWORD) {
      return new Response('Authentication is unavailable.', {
        status: 503,
        headers: { ...noStore, 'Content-Type': 'text/plain; charset=utf-8' },
      })
    }

    const response = await handler.fetch(request, { context: {
      backend: env.BACKEND,
      ratingLimiter: env.RATING_RATE_LIMIT,
      publicSessionVisit: publicSessionVisit(request),
    } })
    const headers = new Headers(response.headers)
    headers.set('Cache-Control', 'no-store')
    headers.set('Referrer-Policy', 'strict-origin')

    return new Response(response.body, {
      headers,
      status: response.status,
      statusText: response.statusText,
    })
  },
}
