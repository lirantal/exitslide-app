import { createFileRoute } from '@tanstack/react-router'
import { sampleSessionId } from '../../preview/fixtures'
import { Wordmark } from '../components/wordmark'
import { buttonVariants } from '../components/ui/button'

export const Route = createFileRoute('/')({
  validateSearch: (search: Record<string, unknown>) =>
    search.auth === 'failed' ? { auth: 'failed' as const } : {},
  component: Home,
})

function Home() {
  const { auth } = Route.useSearch()

  return (
    <>
      <header className="app-bar">
        <div className="page-width app-bar-content">
          <Wordmark />
          <nav aria-label="Speaker account">
            <a className={buttonVariants({ variant: 'outline' })} href="/sign-in">Sign in</a>
          </nav>
        </div>
      </header>
      <main className="page-width grid items-center gap-9 py-10 sm:py-16 md:grid-cols-2 lg:min-h-[min(43rem,85svh)] lg:gap-16">
        <div className="grid justify-items-start gap-5">
          <h1 className="max-w-[13ch] text-[clamp(2.6rem,6vw,5rem)] leading-[1.02] font-bold tracking-[-0.06em]">
            Give your talk a <span className="text-primary">good exit.</span>
          </h1>
          <p className="max-w-[34ch] text-lg leading-relaxed text-pretty text-slate-600">
            Share your slides and collect quick audience feedback from a single session link.
          </p>
          {auth === 'failed' && <p role="alert" className="text-sm text-red-700">Sign-in could not be completed. Try again.</p>}
          <a className={buttonVariants({ className: 'min-h-12' })} href="/sign-up">Create account</a>
        </div>
        <figure className="demo-stage">
          <div className="demo-window" aria-hidden="true">
            <div className="flex items-center border-b border-border px-4 py-3">
              <Wordmark />
            </div>
            <div className="grid gap-3 p-3 sm:p-4">
              <div className="slide-cover rounded-xl px-4 py-5 text-xl font-semibold tracking-tight sm:px-5">
                <span className="max-w-[16ch] self-center">Making the web work for everyone</span>
                <span aria-hidden="true" className="slide-cover-art" />
              </div>
              <div className="rounded-lg bg-primary px-3 py-2 text-center text-sm font-medium text-primary-foreground">Get slides</div>
              <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 border-t border-border pt-3 text-sm">
                <span>Rate this Session</span>
                <span className="text-xl tracking-wide text-amber-700">★★★★★</span>
              </div>
            </div>
          </div>
          <figcaption className="text-center text-sm font-medium text-slate-700">
            {import.meta.env.MODE === 'pr-preview'
              ? <a href={'/s/' + sampleSessionId} className="app-link">Open attendee preview</a>
              : 'Attendee view'}
          </figcaption>
        </figure>
      </main>
    </>
  )
}
