import { sessionIdSchema } from '@exitslide/contracts'
import { createFileRoute, Link } from '@tanstack/react-router'
import { buttonVariants } from '../components/ui/button'
import { listSessions } from '../server/sessions'

export const Route = createFileRoute('/dashboard/')({
  validateSearch: (search: Record<string, unknown>): { cursor?: string } => {
    const cursor = sessionIdSchema.safeParse(search.cursor).data
    return cursor ? { cursor } : {}
  },
  loaderDeps: ({ search }) => ({ cursor: search.cursor }),
  loader: ({ deps }) => listSessions({ data: deps.cursor }),
  component: SessionList,
})

function SessionList() {
  const page = Route.useLoaderData()
  const { cursor } = Route.useSearch()

  return (
    <section className="grid gap-5 sm:gap-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Speaker dashboard</h1>
          <p className="mt-1 text-slate-600">Manage session links and see audience feedback.</p>
        </div>
        <Link to="/dashboard/new" className={buttonVariants({ className: 'min-h-11 w-full sm:w-auto' })}>New Session</Link>
      </div>
      <section className="surface overflow-hidden" aria-labelledby="sessions-heading">
        <h2 id="sessions-heading" className="border-b border-border px-4 py-3.5 text-lg font-semibold sm:px-6">Sessions</h2>
        {!page.ok ? <p role="alert" className="p-4 text-red-700 sm:p-6">{page.message}</p>
          : page.data.items.length === 0 ? <p className="p-4 text-slate-600 sm:p-6">You haven’t created a Session yet.</p>
          : (
            <ul className="divide-y divide-border">
              {page.data.items.map(session => (
                <li key={session.id} className="relative grid gap-1 px-4 py-4 hover:bg-accent sm:grid-cols-[1fr_auto] sm:items-center sm:gap-4 sm:px-6">
                  <Link to="/dashboard/$sessionId" params={{ sessionId: session.id }} search={{}}
                    className="app-link font-semibold [overflow-wrap:anywhere] after:absolute after:inset-0">
                    {session.title}
                  </Link>
                  <time dateTime={session.createdAt} className="text-sm text-slate-600">{sessionDate.format(new Date(session.createdAt))}</time>
                </li>
              ))}
            </ul>
          )}
      </section>
      {(cursor || (page.ok && page.data.nextCursor)) && (
        <nav className="flex flex-wrap gap-3" aria-label="Session pages">
          {cursor && <Link to="/dashboard" search={{}} className={buttonVariants({ variant: 'outline' })}>Newest Sessions</Link>}
          {page.ok && page.data.nextCursor && (
            <Link to="/dashboard" search={{ cursor: page.data.nextCursor }}
              className={buttonVariants({ variant: 'outline' })}>Older Sessions</Link>
          )}
        </nav>
      )}
    </section>
  )
}

const sessionDate = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeZone: 'UTC' })
