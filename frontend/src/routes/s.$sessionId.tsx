import { sessionIdSchema } from '@exitslide/contracts'
import { createFileRoute, Link, notFound, useRouter } from '@tanstack/react-router'
import { RatingForm } from '../components/rating-form'
import { Button, buttonVariants } from '../components/ui/button'
import { Wordmark } from '../components/wordmark'
import { loadPublicSession } from '../server/public-sessions'
import type { ReactNode } from 'react'
import { WebAnalytics } from '../components/web-analytics'

export const Route = createFileRoute('/s/$sessionId')({
  head: () => ({ meta: [{ title: 'Session slides and feedback | ExitSlide' }] }),
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
    <AttendeeScreen>
      <section className="surface grid gap-4 p-5 sm:p-7">
        <h1 className="text-2xl font-semibold">Couldn’t load the Session</h1>
        <p role="alert" className="text-slate-600">{result.message}</p>
        <div><Button variant="outline" onClick={() => void router.invalidate()}>Try again</Button></div>
      </section>
    </AttendeeScreen>
  )

  return (
    <AttendeeScreen>
      <section className="surface overflow-hidden">
        <div className="slide-cover min-h-40 items-end px-5 py-7 sm:min-h-52 sm:p-8">
          <h1 className="max-w-[20ch] text-[clamp(1.9rem,5vw,2.8rem)] leading-[1.08] font-bold tracking-tight text-balance [overflow-wrap:anywhere]">
            {result.data.title}
          </h1>
          <span aria-hidden="true" className="slide-cover-art" />
        </div>
        <div className="p-4 sm:p-5">
          <a href={'/s/' + sessionId + '/slides'} target="_blank" rel="noopener noreferrer"
            aria-label="Get slides (opens in a new tab)"
            className={buttonVariants({ className: 'min-h-12 w-full' })}>Get slides</a>
        </div>
      </section>
      <RatingForm key={sessionId} sessionId={sessionId} />
    </AttendeeScreen>
  )
}

function UnavailableSession() {
  return (
    <AttendeeScreen>
      <section className="surface grid justify-items-start gap-4 p-5 sm:p-7">
        <h1 className="text-2xl font-semibold">This Session is unavailable</h1>
        <p className="text-slate-600">The speaker may have retired the link, or the URL may be incorrect.</p>
        <Link to="/" search={{}} className="app-link">Go to ExitSlide</Link>
      </section>
    </AttendeeScreen>
  )
}

function AttendeeScreen({ children }: { children: ReactNode }) {
  return (
    <>
      <WebAnalytics />
      <header className="app-bar">
        <div className="app-bar-content mx-auto max-w-lg px-4 sm:px-5">
          <Wordmark />
        </div>
      </header>
      <main className="mx-auto grid w-full max-w-lg gap-4 px-4 py-5 sm:gap-5 sm:px-5 sm:py-10">
        {children}
      </main>
    </>
  )
}
