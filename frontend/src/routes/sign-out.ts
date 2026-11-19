import { createFileRoute, isRedirect } from '@tanstack/react-router'
import { signOut } from '@workos/authkit-tanstack-react-start'

export const Route = createFileRoute('/sign-out')({
  server: {
    handlers: { POST: ({ request }) => handleSignOut(request) },
  },
})

export async function handleSignOut(request: Request): Promise<Response> {
  if (request.headers.get('Origin') !== new URL(request.url).origin) {
    return new Response('Forbidden', { status: 403 })
  }

  try {
    return await signOut()
  } catch (error) {
    if (!isRedirect(error)) throw error

    const headers = new Headers(error.headers)
    if (!headers.has('Location')) headers.set('Location', '/')

    // A document redirect preserves AuthKit's cookie headers and follows with GET.
    return new Response(null, { status: 303, headers })
  }
}
