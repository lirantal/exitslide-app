import { redirect } from '@tanstack/react-router'
import { createMiddleware, createServerFn } from '@tanstack/react-start'

export const authkitMiddleware = () => createMiddleware().server(({ next }) => next())

export const getAuth = createServerFn({ method: 'GET' }).handler(async () => {
  const { getCookie } = await import('@tanstack/react-start/server')
  const actor = getCookie('exitslide-test-user')
  return { user: actor === 'user_first' || actor === 'user_second' ? { id: actor } : null }
})

export const getSignInUrl = async () => '/'
export const getSignUpUrl = async () => '/'
export function handleCallbackRoute() {
  return () => new Response(null, { status: 303, headers: { Location: '/dashboard' } })
}

export async function signOut(): Promise<never> {
  throw redirect({
    href: '/',
    headers: { 'Set-Cookie': 'exitslide-test-user=; Path=/; Max-Age=0; HttpOnly' },
  })
}
