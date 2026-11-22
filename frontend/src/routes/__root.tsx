import { HeadContent, Outlet, Scripts, createRootRoute } from '@tanstack/react-router'
import { sampleSessionId } from '../../preview/fixtures'
import stylesheet from '../styles.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'ExitSlide' },
    ],
    links: [{ rel: 'stylesheet', href: stylesheet }],
  }),
  component: Root,
})

function Root() {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <div className="min-h-svh">
          <Outlet />
          {import.meta.env.MODE === 'pr-preview' && (
            <aside aria-label="Preview controls" className="page-width grid gap-2 border-t border-border py-4 text-sm">
              <p className="text-slate-700">PR preview · Sample data stays in this browser.</p>
              <a className="underline" href={'/s/' + sampleSessionId}>Open sample Session</a>
              <form action="/__preview/speaker" method="post" className="flex flex-wrap gap-x-4 gap-y-2">
                <button className="underline" name="speaker" value="user_first">Speaker 1</button>
                <button className="underline" name="speaker" value="user_second">Speaker 2</button>
                <button className="underline" name="speaker" value="attendee">Attend as guest</button>
                <button className="underline" name="speaker" value="reset">Reset samples</button>
              </form>
            </aside>
          )}
        </div>
        <Scripts />
      </body>
    </html>
  )
}
