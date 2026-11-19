import { createFileRoute } from '@tanstack/react-router'
import { getSignUpUrl } from '@workos/authkit-tanstack-react-start'

export const Route = createFileRoute('/sign-up')({
  server: {
    handlers: {
      GET: async () => new Response(null, {
        status: 307,
        headers: {
          Location: await getSignUpUrl({ data: { returnPathname: '/dashboard' } }),
          'Cache-Control': 'no-store',
        },
      }),
    },
  },
})
