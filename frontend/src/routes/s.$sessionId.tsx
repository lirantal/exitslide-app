import { sessionIdSchema } from '@exitslide/contracts'
import { createFileRoute, Link, notFound, useRouter } from '@tanstack/react-router'
import { RatingForm } from '../components/rating-form'
import { Button, buttonVariants } from '../components/ui/button'
import { loadPublicSession } from '../server/public-sessions'

export const Route = createFileRoute('/s/$sessionId')({
  staleTime: 0,
  preloadStaleTime: 0,
  loader: {
    staleReloadMode: 'blocking',
    handler: async ({ params }) => {
      const parsed = sessionIdSchema.safeParse(params.sessionId)
      if (!parsed.success) throw notFound()
      const result = await loadPublicSession({ data: parsed.data })
      if (!result.ok && result.status === 404) throw notFound()
      return result
    },
  },
  component: PublicSessionPage,
  notFoundComponent: UnavailableSession,
})

function PublicSessionPage() {
  const result = Route.useLoaderData()
  const { sessionId } = Route.useParams()
  const router = useRouter()
  if (!result.ok) return (
    <section className="grid gap-4">
      <h1 className="text-2xl font-semibold">Couldn’t load the Session</h1>
      <p role="alert" className="text-slate-600">{result.message}</p>
      <div><Button variant="outline" onClick={() => void router.invalidate()}>Try again</Button></div>
    </section>
  )

  return (
    <section className="mx-auto w-full max-w-lg space-y-6">
      <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 sm:p-8">
        <h1 className="break-words text-3xl font-semibold tracking-tight sm:text-4xl">{result.data.title}</h1>
        <a href={result.data.slideUrl} target="_blank" rel="noopener noreferrer"
          aria-label="Get slides (opens in a new tab)" className={buttonVariants()}>Get slides</a>
      </div>
      <RatingForm key={sessionId} sessionId={sessionId} />
    </section>
  )
}

function UnavailableSession() {
  return (
    <section className="grid gap-4">
      <h1 className="text-2xl font-semibold">This Session is unavailable</h1>
      <p className="text-slate-600">The speaker may have retired the link, or the URL may be incorrect.</p>
      <Link to="/" search={{}} className="text-sm font-medium underline">Go to ExitSlide</Link>
    </section>
  )
}
