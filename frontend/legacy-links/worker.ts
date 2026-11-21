const productionOrigin = 'https://exitslide-frontend.brain-labs.workers.dev'
const headers = { 'Cache-Control': 'no-store' }

export default {
  fetch(request: Request) {
    const { pathname, search } = new URL(request.url)
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response(null, { status: 405, headers: { ...headers, Allow: 'GET, HEAD' } })
    }

    if (pathname === '/auth/callback') return new Response(null, { status: 404, headers })

    const location = pathname.startsWith('/s/') ? productionOrigin + pathname + search : productionOrigin + '/'
    return new Response(null, { status: 307, headers: { ...headers, Location: location } })
  },
}
