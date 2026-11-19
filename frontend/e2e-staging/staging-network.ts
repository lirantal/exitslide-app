import type { Page } from '@playwright/test'

// The remote Codex browser may lack the managed proxy CA present in Node.
// Forward through Node's verified TLS connection and preserve separate cookie headers.
export async function attachStagingNetwork(page: Page, origin: string) {
  if (process.env.EXITSLIDE_SMOKE_NODE_PROXY !== '1') return

  const cdp = await page.context().newCDPSession(page)
  const hosts = [origin + '/*', 'https://api.workos.com/*', 'https://*.workos.com/*',
    'https://*.authkit.app/*', 'https://*.authkit.net/*']
  await cdp.send('Fetch.enable', {
    patterns: hosts.map(urlPattern => ({ urlPattern })),
  })
  cdp.on('Fetch.requestPaused', async ({ requestId, request }) => {
    try {
      const headers = new Headers(request.headers)
      for (const name of ['host', 'connection', 'content-length', 'accept-encoding']) headers.delete(name)
      const body = request.postDataEntries?.length
        ? Buffer.concat(request.postDataEntries.map(part => Buffer.from(part.bytes ?? '', 'base64')))
        : request.postData
      const result = await fetch(request.url, {
        method: request.method, headers, body, redirect: 'manual', signal: AbortSignal.timeout(20_000),
      })
      const responseHeaders = [...result.headers]
        .filter(([name]) => !['content-encoding', 'content-length', 'transfer-encoding', 'set-cookie'].includes(name))
        .map(([name, value]) => ({ name, value }))
      responseHeaders.push(...result.headers.getSetCookie().map(value => ({ name: 'set-cookie', value })))
      await cdp.send('Fetch.fulfillRequest', {
        requestId, responseCode: result.status, responseHeaders,
        body: Buffer.from(await result.arrayBuffer()).toString('base64'),
      })
    } catch {
      await cdp.send('Fetch.failRequest', { requestId, errorReason: 'Failed' }).catch(() => {})
    }
  })
}
