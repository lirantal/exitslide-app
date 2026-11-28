import { engagementDateSchema, engagementRangeSchema, sessionIdSchema, type EngagementRange, type EngagementReport } from '@exitslide/contracts'
import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useRef, useState } from 'react'
import { SessionForm } from '../components/session-form'
import { Button, buttonVariants } from '../components/ui/button'
import { deleteSession, listRatings, loadEngagement, loadSession, updateSession } from '../server/sessions'
import { EngagementReportPanel } from '../components/engagement-report'
import type { Result } from '../server/backend'
import { captureProductEvent, serverAnalyticsContext } from '../analytics/product-analytics'

export const Route = createFileRoute('/dashboard/$sessionId')({
  head: () => ({ meta: [{ title: 'Session details | ExitSlide' }] }),
  validateSearch: (search: Record<string, unknown>): EngagementRange & { cursor?: string } => ({
    cursor: sessionIdSchema.safeParse(search.cursor).data,
    from: engagementDateSchema.safeParse(search.from).data,
    to: engagementDateSchema.safeParse(search.to).data,
  }),
  loaderDeps: ({ search }) => search,
  loader: async ({ params, deps }) => {
    const id = sessionIdSchema.safeParse(params.sessionId)
    if (!id.success) return null
    const range = engagementRangeSchema.safeParse({ from: deps.from, to: deps.to })
    const [details, feedback, engagement] = await Promise.all([
      loadSession({ data: id.data }), listRatings({ data: { id: id.data, cursor: deps.cursor } }),
      range.success
        ? loadEngagement({ data: { id: id.data, range: range.data } })
        : { ok: false, status: 422, message: 'Choose an end date on or after the start date.' } satisfies Result<EngagementReport>,
    ])
    return { details, feedback, engagement }
  },
  component: SessionDetail,
})

function SessionDetail() {
  const data = Route.useLoaderData()
  const { cursor, from, to } = Route.useSearch()
  const router = useRouter()
  const update = useServerFn(updateSession)
  const retire = useServerFn(deleteSession)
  const publicLink = useRef<HTMLInputElement>(null)
  const [copyMessage, setCopyMessage] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  if (!data) return <p role="alert">Session unavailable.</p>
  if (!data.details.ok) return <p role="alert">{data.details.message}</p>
  const { session, publicUrl } = data.details.data
  const feedback = data.feedback

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(publicUrl)
      captureProductEvent('session_link_copied')
      setCopyMessage('Link copied.')
    } catch {
      publicLink.current?.focus()
      publicLink.current?.select()
      setCopyMessage('Copy the selected link.')
    }
  }

  async function deleteLink() {
    if (deleting || !window.confirm('Delete this Session? Its public link will stop working and its ratings and engagement data will be removed.')) return
    setDeleting(true)
    setDeleteError('')
    try {
      const result = await retire({ data: { id: session.id, analytics: serverAnalyticsContext() } })
      if (!result.ok) {
        setDeleteError(result.message)
        return
      }
      await router.navigate({ to: '/dashboard', search: {} })
      await router.invalidate()
    } catch {
      setDeleteError('Couldn’t delete the Session. Try again.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <section className="grid gap-5 sm:gap-6">
      <div className="grid justify-items-start gap-3">
        <Link to="/dashboard" search={{}} className="app-link text-sm">All sessions</Link>
        <h1 className="text-3xl font-bold tracking-tight [overflow-wrap:anywhere] sm:text-4xl">{session.title}</h1>
      </div>
      <div className="grid items-start gap-4 md:grid-cols-2 md:gap-5">
        <section className="surface grid gap-4 p-4 sm:p-6" aria-labelledby="share-heading">
          <h2 id="share-heading" className="text-xl font-semibold tracking-tight">Share session</h2>
          <div className="grid gap-1.5">
            <label htmlFor="session-link" className="text-sm font-medium">Public Session link</label>
            <input id="session-link" type="url" readOnly ref={publicLink} value={publicUrl} />
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Button onClick={copyLink} className="min-h-11">Copy link</Button>
            <a href={publicUrl} className="app-link inline-flex min-h-11 items-center text-sm">Open Session page</a>
          </div>
          {copyMessage && <p role="status" className="text-sm text-slate-600">{copyMessage}</p>}
        </section>
        <section className="surface grid gap-4 p-4 sm:p-6" aria-labelledby="feedback-heading">
          <h2 id="feedback-heading" className="text-xl font-semibold tracking-tight">Feedback</h2>
          {!feedback.ok ? <p role="alert" className="text-red-700">{feedback.message}</p>
            : feedback.data.items.length === 0 ? (
              <div className="grid gap-1 rounded-xl bg-slate-50 p-4">
                <p className="font-medium">No feedback yet.</p>
                <p className="text-sm text-slate-600">Ratings will appear here as attendees submit them.</p>
              </div>
            ) : (
              <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                {feedback.data.items.map(item => (
                  <li key={item.submissionId} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-3">
                    <span className="flex items-center gap-1.5 font-medium">
                      <span aria-hidden="true" className="text-amber-700">★</span>
                      <span>{item.score} out of 5</span>
                    </span>
                    <time dateTime={item.createdAt} className="text-sm text-slate-600">
                      {formatRatingDate(item.createdAt)}
                    </time>
                  </li>
                ))}
              </ul>
            )}
          {(cursor || (feedback.ok && feedback.data.nextCursor)) && (
            <nav className="flex flex-wrap gap-3" aria-label="Feedback pages">
              {cursor && <Link to="/dashboard/$sessionId" params={{ sessionId: session.id }} search={{ from, to }}
                className={buttonVariants({ variant: 'outline' })}>Newest ratings</Link>}
              {feedback.ok && feedback.data.nextCursor && (
                <Link to="/dashboard/$sessionId" params={{ sessionId: session.id }} search={{ from, to, cursor: feedback.data.nextCursor }}
                  className={buttonVariants({ variant: 'outline' })}>Older ratings</Link>
              )}
            </nav>
          )}
        </section>
      </div>
      <EngagementReportPanel report={data.engagement} range={{ from, to }} path={'/dashboard/' + session.id} cursor={cursor} />
      <details className="surface max-w-2xl p-4 sm:px-6">
        <summary className="cursor-pointer rounded-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">Edit Session</summary>
        <div className="mt-4">
          <SessionForm key={session.id} initial={session} label="Save changes" onSave={async input => {
            const result = await update({ data: { ...input, id: session.id, analytics: serverAnalyticsContext() } })
            if (!result.ok) return result.message
            await router.invalidate()
          }} />
        </div>
      </details>
      <div className="border-t border-border pt-4">
        <Button variant="outline" disabled={deleting} className="text-red-700" onClick={deleteLink}>
          {deleting ? 'Deleting…' : 'Delete Session'}
        </Button>
        {deleteError && <p role="alert" className="mt-2 text-sm text-red-700">{deleteError}</p>}
      </div>
    </section>
  )
}

const dateFormat = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' })
function formatRatingDate(value: string) {
  return dateFormat.format(new Date(value)) + ' UTC'
}
