import { sessionIdSchema } from '@exitslide/contracts'
import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useRef, useState } from 'react'
import { SessionForm } from '../components/session-form'
import { Button, buttonVariants } from '../components/ui/button'
import { deleteSession, listRatings, loadSession, updateSession } from '../server/sessions'
import { captureProductEvent, serverAnalyticsContext } from '../analytics/product-analytics'

export const Route = createFileRoute('/dashboard/$sessionId')({
  validateSearch: (search: Record<string, unknown>): { cursor?: string } => {
    const cursor = sessionIdSchema.safeParse(search.cursor).data
    return cursor ? { cursor } : {}
  },
  loaderDeps: ({ search }) => ({ cursor: search.cursor }),
  loader: async ({ params, deps }) => {
    const id = sessionIdSchema.safeParse(params.sessionId)
    if (!id.success) return null
    const [details, feedback] = await Promise.all([
      loadSession({ data: id.data }), listRatings({ data: { id: id.data, cursor: deps.cursor } }),
    ])
    return { details, feedback }
  },
  component: SessionDetail,
})

function SessionDetail() {
  const data = Route.useLoaderData()
  const { cursor } = Route.useSearch()
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
    if (deleting || !window.confirm('Delete this Session? Its public link will stop working and its ratings will be removed.')) return
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
    <section className="grid gap-6">
      <h1 className="break-words text-3xl font-semibold tracking-tight">{session.title}</h1>
      <div className="grid gap-2">
        <label htmlFor="session-link" className="text-sm font-medium">Public Session link</label>
        <input id="session-link" type="url" readOnly ref={publicLink} value={publicUrl} />
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" onClick={copyLink}>Copy link</Button>
          <a href={publicUrl} className="text-sm font-medium underline">Open Session page</a>
          {copyMessage && <span role="status" className="text-sm text-slate-600">{copyMessage}</span>}
        </div>
      </div>
      <details className="rounded-xl border border-slate-200 bg-white p-4">
        <summary className="cursor-pointer font-medium">Edit Session</summary>
        <div className="mt-4">
          <SessionForm key={session.id} initial={session} label="Save changes" onSave={async input => {
            const result = await update({ data: { ...input, id: session.id, analytics: serverAnalyticsContext() } })
            if (!result.ok) return result.message
            await router.invalidate()
          }} />
        </div>
      </details>
      <section className="grid gap-3" aria-labelledby="feedback-heading">
        <h2 id="feedback-heading" className="text-xl font-semibold">Feedback</h2>
        {!feedback.ok ? <p role="alert" className="text-red-700">{feedback.message}</p>
          : feedback.data.items.length === 0 ? <p className="text-slate-600">No feedback yet.</p>
          : (
            <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
              {feedback.data.items.map(item => (
                <li key={item.submissionId} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                  <span className="font-medium">{item.score} out of 5</span>
                  <time dateTime={item.createdAt} className="text-sm text-slate-600">
                    {formatRatingDate(item.createdAt)}
                  </time>
                </li>
              ))}
            </ul>
          )}
        <nav className="flex flex-wrap gap-3" aria-label="Feedback pages">
          {cursor && <Link to="/dashboard/$sessionId" params={{ sessionId: session.id }} search={{}}
            className={buttonVariants({ variant: 'outline' })}>Newest ratings</Link>}
          {feedback.ok && feedback.data.nextCursor && (
            <Link to="/dashboard/$sessionId" params={{ sessionId: session.id }} search={{ cursor: feedback.data.nextCursor }}
              className={buttonVariants({ variant: 'outline' })}>Older ratings</Link>
          )}
        </nav>
      </section>
      <div>
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
