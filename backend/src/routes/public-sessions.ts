import { engagementHeader, ratingInputSchema, sessionIdSchema } from '@exitslide/contracts'
import { drizzle } from 'drizzle-orm/d1'
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { saveRating } from '../db/ratings'
import { getPublicSession, getSlideDestination } from '../db/sessions'
import { recordEngagement } from '../db/engagement'
import type { DatabaseBindings } from './sessions'
import { recordProductEvent } from '../analytics'

export const publicSessionRoutes = new Hono<{ Bindings: DatabaseBindings }>()

publicSessionRoutes.use('*', async (context, next) => {
  context.header('Cache-Control', 'no-store')
  await next()
})

publicSessionRoutes.get('/:id', async (context) => {
  const id = sessionIdSchema.safeParse(context.req.param('id'))
  if (!id.success) return context.json({ message: 'Session unavailable.' }, 404)
  const session = await getPublicSession(drizzle(context.env.DB), id.data)
  if (!session) return context.json({ message: 'Session unavailable.' }, 404)
  await recordEngagement(context.env.DB, id.data, 'visit', context.req.header(engagementHeader))
  return context.json(session)
})

publicSessionRoutes.get('/:id/slides', async (context) => {
  const id = sessionIdSchema.safeParse(context.req.param('id'))
  if (!id.success) return context.json({ message: 'Session unavailable.' }, 404)
  const session = await getSlideDestination(drizzle(context.env.DB), id.data)
  if (!session) return context.json({ message: 'Session unavailable.' }, 404)
  await recordEngagement(context.env.DB, id.data, 'slide_click', context.req.header(engagementHeader))
  return context.redirect(session.slideUrl, 302)
})

publicSessionRoutes.post('/:id/ratings', bodyLimit({
  maxSize: 256,
  onError: (context) => context.json({ message: 'Rating request is too large.' }, 413),
}), async (context) => {
  const id = sessionIdSchema.safeParse(context.req.param('id'))
  if (!id.success) return context.json({ message: 'Session unavailable.' }, 404)

  const input = ratingInputSchema.safeParse(await context.req.json().catch(() => null))
  if (!input.success) return context.json({ message: 'Choose a rating from 1 to 5.' }, 422)

  const result = await saveRating(context.env.DB, id.data, input.data)
  if (result === 'unavailable') return context.json({ message: 'Session unavailable.' }, 404)
  if (result === 'conflict') return context.json({ message: 'This submission already has a different rating.' }, 409)
  if (result === 'saved') recordProductEvent(context, 'rating_submitted', {
    ratingId: id.data + ':' + input.data.submissionId, score: input.data.score,
  })
  return context.json({ status: 'saved' })
})
