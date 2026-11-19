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
    <section className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">Speaker dashboard</h1>
        <Link to="/dashboard/new" className={buttonVariants()}>New Session</Link>
      </div>
      {!page.ok ? <p role="alert" className="text-red-700">{page.message}</p>
        : page.data.items.length === 0 ? <p className="text-slate-600">You haven’t created a Session yet.</p>
        : (
          <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
            {page.data.items.map(session => (
              <li key={session.id}>
                <Link to="/dashboard/$sessionId" params={{ sessionId: session.id }} search={{}}
                  className="block break-words px-4 py-3 font-medium hover:underline">
                  {session.title}
                </Link>
              </li>
            ))}
          </ul>
        )}
      <nav className="flex flex-wrap gap-3" aria-label="Session pages">
        {cursor && <Link to="/dashboard" search={{}} className={buttonVariants({ variant: 'outline' })}>Newest Sessions</Link>}
        {page.ok && page.data.nextCursor && (
          <Link to="/dashboard" search={{ cursor: page.data.nextCursor }}
            className={buttonVariants({ variant: 'outline' })}>Older Sessions</Link>
        )}
      </nav>
    </section>
  )
}
