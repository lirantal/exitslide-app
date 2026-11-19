import { createFileRoute, redirect } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { getAuth } from '@workos/authkit-tanstack-react-start'
import { Button } from '../components/ui/button'

const isSignedIn = createServerFn({ method: 'GET' }).handler(async () => {
  const { user } = await getAuth()
  return Boolean(user)
})

export const Route = createFileRoute('/dashboard')({
  beforeLoad: async () => {
    if (!(await isSignedIn())) {
      throw redirect({ href: '/sign-in' })
    }
  },
  headers: () => ({ 'Cache-Control': 'no-store' }),
  component: Dashboard,
})

function Dashboard() {
  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight">Speaker dashboard</h1>
      <form action="/sign-out" method="post">
        <Button type="submit" variant="outline">Sign out</Button>
      </form>
    </>
  )
}
