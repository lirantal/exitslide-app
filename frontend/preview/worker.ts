import handler from '@tanstack/react-start/server-entry'
import { createFixtures, dataCookie, isSpeaker, previewCookie, speakerCookie } from './fixtures'
import { publicSessionVisit, slideRedirect } from '../src/server/engagement'

const responseHeaders = {
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex, nofollow',
}

function changeSpeaker(location: string, speaker: string, reset = false) {
  const headers = new Headers({ ...responseHeaders, Location: location })
  headers.append('Set-Cookie', previewCookie(speakerCookie, isSpeaker(speaker) ? speaker : '', isSpeaker(speaker) ? undefined : 0))
  if (reset) headers.append('Set-Cookie', previewCookie(dataCookie, '', 0))
  return new Response(null, { status: 303, headers })
}

export default {
  async fetch(request: Request) {
    const url = new URL(request.url)
    if (request.method === 'GET' && url.pathname === '/healthz') {
      return Response.json({ service: 'exitslide-pr-preview', status: 'ok' }, { headers: responseHeaders })
    }
    if (request.method === 'GET' && (url.pathname === '/sign-in' || url.pathname === '/sign-up')) {
      return changeSpeaker('/dashboard', 'user_first')
    }
    if (request.method === 'POST' && url.pathname === '/__preview/speaker') {
      if (request.headers.get('Origin') !== url.origin) {
        return new Response('Forbidden', { status: 403, headers: responseHeaders })
      }
      const speaker = (await request.formData()).get('speaker')
      if (isSpeaker(speaker)) return changeSpeaker('/dashboard', speaker)
      if (speaker === 'reset') return changeSpeaker('/', '', true)
      const referrer = request.headers.get('Referer')
      const previous = referrer && URL.canParse(referrer) ? new URL(referrer) : null
      const publicPath = previous?.origin === url.origin && previous.pathname.startsWith('/s/') ? previous.pathname : '/'
      return changeSpeaker(publicPath, '')
    }

    const fixtures = createFixtures(request)
    const response = await slideRedirect(request, fixtures) ?? await handler.fetch(request, { context: {
      backend: fixtures,
      ratingLimiter: { limit: async () => ({ success: true }) },
      publicSessionVisit: publicSessionVisit(request),
    } })
    const headers = new Headers(response.headers)
    for (const [name, value] of Object.entries(responseHeaders)) headers.set(name, value)
    if (fixtures.cookie) headers.append('Set-Cookie', fixtures.cookie)
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
  },
}
