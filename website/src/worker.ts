type Environment = {
  ASSETS: { fetch(request: Request): Promise<Response> }
}

export default {
  fetch(request: Request, env: Environment): Promise<Response> | Response {
    const url = new URL(request.url)
    if (url.hostname === 'www.exitslide.top') {
      url.protocol = 'https:'
      url.hostname = 'exitslide.top'
      url.port = ''
      return Response.redirect(url, 308)
    }

    return env.ASSETS.fetch(request)
  },
}
