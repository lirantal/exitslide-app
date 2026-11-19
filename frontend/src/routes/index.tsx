import { createFileRoute } from '@tanstack/react-router'
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
      <h1 className="text-4xl font-semibold tracking-tight">ExitSlide</h1>
      <p className="text-base text-slate-600">Share your slides and collect feedback after your session.</p>
      {auth === 'failed' && <p role="alert" className="text-sm text-red-700">Sign-in could not be completed. Try again.</p>}
      <nav aria-label="Speaker account" className="flex flex-wrap gap-3">
        <a className={buttonVariants()} href="/sign-in">Sign in</a>
        <a className={buttonVariants({ variant: 'outline' })} href="/sign-up">Create account</a>
      </nav>
    </>
  )
}
