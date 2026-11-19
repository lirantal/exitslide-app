import { HeadContent, Outlet, Scripts, createRootRoute } from '@tanstack/react-router'
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
        <main className="mx-auto grid min-h-svh max-w-md content-center gap-6 px-6 py-12">
          <Outlet />
        </main>
        <Scripts />
      </body>
    </html>
  )
}
