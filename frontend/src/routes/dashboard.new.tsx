import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { SessionForm } from '../components/session-form'
import { createSession } from '../server/sessions'
import { serverAnalyticsContext } from '../analytics/product-analytics'

export const Route = createFileRoute('/dashboard/new')({ component: NewSession })

function NewSession() {
  const create = useServerFn(createSession)
  const router = useRouter()

  return (
    <section className="grid gap-4">
      <h1 className="text-3xl font-semibold tracking-tight">New Session</h1>
      <SessionForm label="Publish Session" onSave={async input => {
        const result = await create({ data: { ...input, analytics: serverAnalyticsContext() } })
        if (!result.ok) return result.message
        await router.invalidate()
        await router.navigate({ to: '/dashboard/$sessionId', params: { sessionId: result.data.id }, search: {} })
      }} />
    </section>
  )
}
