import { createFileRoute } from '@tanstack/react-router'
import { getSignInUrl } from '@workos/authkit-tanstack-react-start'

export const Route = createFileRoute('/sign-in')({
  server: {
    handlers: {
      GET: async () => new Response(null, {
        status: 307,
        headers: {
          Location: await getSignInUrl({ data: { returnPathname: '/dashboard' } }),
          'Cache-Control': 'no-store',
        },
      }),
    },
  },
})
