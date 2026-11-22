import { actorHeader, sessionIdSchema, sessionInputSchema } from '@exitslide/contracts'
import { drizzle } from 'drizzle-orm/d1'
import { Hono } from 'hono'
import { listRatings } from '../db/ratings'
import { createSession, getSession, listSessions, retireSession, updateSession } from '../db/sessions'
import { recordProductEvent, type AnalyticsBindings } from '../analytics'

export type DatabaseBindings = { DB: D1Database } & AnalyticsBindings
export type OwnerContext = { Bindings: DatabaseBindings; Variables: { owner: string } }

export const sessionRoutes = new Hono<OwnerContext>()

sessionRoutes.use('*', async (context, next) => {
  const owner = context.req.header(actorHeader)
  if (!owner || !/^user_[A-Za-z0-9]{1,80}$/.test(owner)) {
    return context.json({ message: 'Sign in to continue.' }, 401)
  }
  context.set('owner', owner)
  await next()
})

sessionRoutes.get('/', async (context) => {
  const cursor = sessionIdSchema.optional().safeParse(context.req.query('cursor'))
  if (!cursor.success) return context.json({ message: 'Invalid page cursor.' }, 422)

  const page = await listSessions(drizzle(context.env.DB), context.get('owner'), cursor.data)
  return page ? context.json(page) : context.json({ message: 'Page is no longer available.' }, 422)
})

sessionRoutes.post('/', async (context) => {
  const input = sessionInputSchema.safeParse(await context.req.json().catch(() => null))
  if (!input.success) return context.json({ message: 'Enter a title and a valid HTTPS slide URL.' }, 422)
  const session = await createSession(drizzle(context.env.DB), context.get('owner'), input.data)
  recordProductEvent(context, 'session_created', { owner: context.get('owner') })
  return context.json(session, 201)
})

sessionRoutes.get('/:id', async (context) => {
  const id = sessionIdSchema.safeParse(context.req.param('id'))
  if (!id.success) return context.json({ message: 'Session unavailable.' }, 404)
  const session = await getSession(drizzle(context.env.DB), context.get('owner'), id.data)
  return session ? context.json(session) : context.json({ message: 'Session unavailable.' }, 404)
})

sessionRoutes.patch('/:id', async (context) => {
  const id = sessionIdSchema.safeParse(context.req.param('id'))
  if (!id.success) return context.json({ message: 'Session unavailable.' }, 404)
  const input = sessionInputSchema.safeParse(await context.req.json().catch(() => null))
  if (!input.success) return context.json({ message: 'Enter a title and a valid HTTPS slide URL.' }, 422)
  const session = await updateSession(drizzle(context.env.DB), context.get('owner'), id.data, input.data)
  if (session) recordProductEvent(context, 'session_updated', { owner: context.get('owner') })
  return session ? context.json(session) : context.json({ message: 'Session unavailable.' }, 404)
})

sessionRoutes.delete('/:id', async (context) => {
  const id = sessionIdSchema.safeParse(context.req.param('id'))
  const retired = id.success && await retireSession(drizzle(context.env.DB), context.get('owner'), id.data)
  if (retired) recordProductEvent(context, 'session_deleted', { owner: context.get('owner') })
  return retired ? context.body(null, 204) : context.json({ message: 'Session unavailable.' }, 404)
})

sessionRoutes.get('/:id/ratings', async (context) => {
  const id = sessionIdSchema.safeParse(context.req.param('id'))
  const db = drizzle(context.env.DB)
  if (!id.success || !await getSession(db, context.get('owner'), id.data)) {
    return context.json({ message: 'Session unavailable.' }, 404)
  }
  const cursor = sessionIdSchema.optional().safeParse(context.req.query('cursor'))
  if (!cursor.success) return context.json({ message: 'Invalid page cursor.' }, 422)

  const page = await listRatings(db, id.data, cursor.data)
  return page ? context.json(page) : context.json({ message: 'Page is no longer available.' }, 422)
})
