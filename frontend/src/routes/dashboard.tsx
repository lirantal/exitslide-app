import { createFileRoute, Link, Outlet, redirect } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { getAuth } from '@workos/authkit-tanstack-react-start'
import { Button } from '../components/ui/button'
import { Wordmark } from '../components/wordmark'
import { ProductAnalytics } from '../components/product-analytics'
import { clearAnalyticsOnSignOut } from '../analytics/product-analytics'

const isSignedIn = createServerFn({ method: 'GET' }).handler(async () => {
  const { user } = await getAuth()
  return Boolean(user)
})

export const Route = createFileRoute('/dashboard')({
  head: () => ({ meta: [{ title: 'Speaker dashboard | ExitSlide' }] }),
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
      <header className="app-bar">
        <div className="page-width app-bar-content">
          <Link to="/dashboard" search={{}} className="rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
            <Wordmark />
          </Link>
          <form action="/sign-out" method="post" onSubmit={clearAnalyticsOnSignOut}>
            <Button type="submit" variant="outline">Sign out</Button>
          </form>
        </div>
      </header>
      <main className="page-width py-6 sm:py-10">
        <Outlet />
      </main>
      <footer className="page-width pb-6">
        <ProductAnalytics />
      </footer>
    </>
  )
}
