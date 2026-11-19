import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { parseEnv } from 'node:util'

export type TestSpeaker = { id: string; email: string; password: string }

export function stagingWorkOS() {
  let key = process.env.EXITSLIDE_WORKOS_STAGING_API_KEY
  if (!key) {
    try {
      key = parseEnv(readFileSync(new URL('../../.env', import.meta.url), 'utf8'))
        .EXITSLIDE_WORKOS_STAGING_API_KEY
    } catch {
      // CI supplies the key as an environment variable.
    }
  }
  if (!key?.startsWith('sk_test_')) {
    throw new Error('Set EXITSLIDE_WORKOS_STAGING_API_KEY to a WorkOS staging key.')
  }

  async function request(method: 'POST' | 'DELETE', path: string, body?: object) {
    const response = await fetch('https://api.workos.com/user_management/users' + path, {
      method,
      headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      redirect: 'error',
      signal: AbortSignal.timeout(15_000),
    })
    if (!response.ok) throw new Error(`WorkOS ${method} returned HTTP ${response.status}.`)
    return response
  }

  return {
    async createSpeaker(): Promise<TestSpeaker> {
      // A reserved domain avoids sending email to a real address or matching the example.com SSO connection.
      const email = 'exitslide-qa-' + randomUUID() + '@example.net'
      const password = randomUUID() + '-Qa7!'
      const response = await request('POST', '', {
        email, password, email_verified: true, first_name: 'ExitSlide', last_name: 'Staging QA',
      })
      const { id } = await response.json() as { id?: string }
      if (!id || !/^user_[A-Za-z0-9]+$/.test(id)) throw new Error('No test speaker ID returned.')
      return { id, email, password }
    },
    async deleteSpeaker(id: string) {
      await request('DELETE', '/' + encodeURIComponent(id))
    },
  }
}
