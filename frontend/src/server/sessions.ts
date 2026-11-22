import { analyticsContextSchema, deleteSessionInputSchema, ratingPageSchema, sessionIdSchema, sessionInputSchema, sessionPageSchema, sessionSchema } from '@exitslide/contracts'
import { redirect } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { getAuth } from '@workos/authkit-tanstack-react-start'
import { requestBackend } from './backend'

async function requireOwner() {
  const { user } = await getAuth()
  if (!user) throw redirect({ href: '/sign-in' })
  return user.id
}

const sessionPath = (id: string) => '/sessions/' + id
const withCursor = (path: string, cursor?: string) => cursor ? path + '?cursor=' + cursor : path

export const listSessions = createServerFn({ method: 'GET' })
  .validator((value: unknown) => sessionIdSchema.optional().parse(value))
  .handler(async ({ data, context }) =>
    requestBackend(context.backend, withCursor('/sessions', data), sessionPageSchema, { owner: await requireOwner() }),
  )

export const loadSession = createServerFn({ method: 'GET' })
  .validator((value: unknown) => sessionIdSchema.parse(value))
  .handler(async ({ data, context }) => {
    const owner = await requireOwner()
    const session = await requestBackend(context.backend, sessionPath(data), sessionSchema, { owner })
    if (!session.ok) return session
    const publicUrl = new URL('/s/' + session.data.id, getRequest().url).href
    return { ok: true as const, data: { session: session.data, publicUrl } }
  })

export const listRatings = createServerFn({ method: 'GET' })
  .validator((value: { id: string; cursor?: string }) => ({
    id: sessionIdSchema.parse(value.id),
    cursor: sessionIdSchema.optional().parse(value.cursor),
  }))
  .handler(async ({ data, context }) => requestBackend(
    context.backend, withCursor(sessionPath(data.id) + '/ratings', data.cursor), ratingPageSchema,
    { owner: await requireOwner() },
  ))

export const createSession = createServerFn({ method: 'POST' })
  .validator((value: unknown) => sessionInputSchema.extend({ analytics: analyticsContextSchema.optional() }).parse(value))
  .handler(async ({ data, context }) => requestBackend(context.backend, '/sessions', sessionSchema, {
    method: 'POST', owner: await requireOwner(), body: { title: data.title, slideUrl: data.slideUrl }, analytics: data.analytics,
  }))

export const updateSession = createServerFn({ method: 'POST' })
  .validator((value: { id: string; title: string; slideUrl: string; analytics?: unknown }) => ({
    id: sessionIdSchema.parse(value.id),
    input: sessionInputSchema.parse({ title: value.title, slideUrl: value.slideUrl }),
    analytics: analyticsContextSchema.optional().parse(value.analytics),
  }))
  .handler(async ({ data, context }) => requestBackend(context.backend, sessionPath(data.id), sessionSchema, {
    method: 'PATCH', owner: await requireOwner(), body: data.input, analytics: data.analytics,
  }))

export const deleteSession = createServerFn({ method: 'POST' })
  .validator((value: unknown) => deleteSessionInputSchema.parse(value))
  .handler(async ({ data, context }) => requestBackend(context.backend, sessionPath(data.id), { parse: () => null }, {
    method: 'DELETE', owner: await requireOwner(), analytics: data.analytics,
  }))
