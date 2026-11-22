import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { SessionForm } from '../components/session-form'
import { createSession } from '../server/sessions'
import { serverAnalyticsContext } from '../analytics/product-analytics'

export const Route = createFileRoute('/dashboard/new')({ component: NewSession })

function NewSession() {
  const create = useServerFn(createSession)
  const router = useRouter()

  return (
    <section className="grid max-w-2xl justify-items-start gap-5">
      <Link to="/dashboard" search={{}} className="app-link text-sm">All sessions</Link>
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">New Session</h1>
      <div className="surface grid w-full gap-5 p-4 sm:p-6">
        <p className="text-slate-600">Add a title and a slide URL to create a link you can share with your audience.</p>
        <SessionForm label="Publish Session" onSave={async input => {
          const result = await create({ data: { ...input, analytics: serverAnalyticsContext() } })
          if (!result.ok) return result.message
          await router.invalidate()
          await router.navigate({ to: '/dashboard/$sessionId', params: { sessionId: result.data.id }, search: {} })
        }} />
      </div>
    </section>
  )
}
