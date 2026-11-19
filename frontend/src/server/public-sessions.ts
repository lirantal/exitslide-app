import { publicSessionSchema, ratingInputSchema, sessionIdSchema, type RatingInput } from '@exitslide/contracts'
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { requestBackend } from './backend'
import { sendRating } from './rating-delivery'

export const loadPublicSession = createServerFn({ method: 'GET' })
  .validator((value: unknown) => sessionIdSchema.parse(value))
  .handler(({ data, context }) => requestBackend(context.backend, '/public/sessions/' + data, publicSessionSchema))

export const submitRating = createServerFn({ method: 'POST' })
  .validator((value: { id: string; rating: RatingInput }) => ({
    id: sessionIdSchema.parse(value.id),
    rating: ratingInputSchema.parse(value.rating),
  }))
  .handler(({ data, context }) => sendRating(
    context, data.id, getRequest().headers.get('CF-Connecting-IP') ?? 'unknown', data.rating,
  ))
