import { redirect } from '@tanstack/react-router'
import { signOut } from '@workos/authkit-tanstack-react-start'
import { beforeEach, expect, test, vi } from 'vitest'
import { handleSignOut } from './routes/sign-out'

vi.mock('@workos/authkit-tanstack-react-start', () => ({ signOut: vi.fn() }))

const origin = 'https://exitslide.example'
const workOSSignOut = vi.mocked(signOut)

function signOutRequest(requestOrigin?: string) {
  return new Request(`${origin}/sign-out`, {
    method: 'POST',
    headers: requestOrigin ? { Origin: requestOrigin } : {},
  })
}

beforeEach(() => workOSSignOut.mockReset())

test('the first authenticated POST clears the cookie and navigates to WorkOS with GET', async () => {
  const destination = 'https://api.workos.com/user_management/sessions/logout'
  const clearedCookie = 'wos-session=; Path=/; Max-Age=0; HttpOnly; Secure'
  workOSSignOut.mockRejectedValueOnce(redirect({
    href: destination,
    headers: { 'Set-Cookie': clearedCookie },
  }))

  const response = await handleSignOut(signOutRequest(origin))

  expect(response.status).toBe(303)
  expect(response.headers.get('Location')).toBe(destination)
  expect(response.headers.getSetCookie()).toEqual([clearedCookie])
  expect(workOSSignOut).toHaveBeenCalledTimes(1)
})

test('an already signed-out session returns to the homepage', async () => {
  workOSSignOut.mockRejectedValueOnce(redirect({ to: '/' }))

  const response = await handleSignOut(signOutRequest(origin))

  expect(response.status).toBe(303)
  expect(response.headers.get('Location')).toBe('/')
})

test.each([undefined, 'https://other.example'])('rejects an untrusted origin (%s)', async (requestOrigin) => {
  const response = await handleSignOut(signOutRequest(requestOrigin))

  expect(response.status).toBe(403)
  expect(workOSSignOut).not.toHaveBeenCalled()
})
