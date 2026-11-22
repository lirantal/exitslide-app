import { createFileRoute, Link, Outlet, redirect } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { getAuth } from '@workos/authkit-tanstack-react-start'
import { Button } from '../components/ui/button'
import { ProductAnalytics } from '../components/product-analytics'
import { clearAnalyticsOnSignOut } from '../analytics/product-analytics'

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
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <Link to="/dashboard" search={{}} className="text-lg font-semibold focus-visible:outline-2">ExitSlide</Link>
        <form action="/sign-out" method="post" onSubmit={clearAnalyticsOnSignOut}>
          <Button type="submit" variant="outline">Sign out</Button>
        </form>
      </header>
      <Outlet />
      <ProductAnalytics />
    </>
  )
}
