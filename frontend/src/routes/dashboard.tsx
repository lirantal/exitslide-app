import { createFileRoute, redirect } from '@tanstack/react-router'
import { createServerFn, useServerFn } from '@tanstack/react-start'
import { getAuth, signOut } from '@workos/authkit-tanstack-react-start'
import { useState } from 'react'
import { Button } from '../components/ui/button'

const isSignedIn = createServerFn({ method: 'GET' }).handler(async () => {
  const { user } = await getAuth()
  return Boolean(user)
})

export const Route = createFileRoute('/dashboard')({
  beforeLoad: async () => {
    if (!(await isSignedIn())) {
      throw redirect({ href: '/sign-in' })
    }
  },
  headers: () => ({ 'Cache-Control': 'no-store' }),
  component: Dashboard,
})

function Dashboard() {
  const endSession = useServerFn(signOut)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState(false)

  async function onSignOut() {
    setPending(true)
    setError(false)

    try {
      await endSession()
    } catch {
      setError(true)
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight">Speaker dashboard</h1>
      <div>
        <Button type="button" variant="outline" disabled={pending} onClick={onSignOut}>
          {pending ? 'Signing out…' : 'Sign out'}
        </Button>
        {error && <p role="alert" className="mt-3 text-sm text-red-700">Couldn’t sign out. Try again.</p>}
      </div>
    </>
  )
}
