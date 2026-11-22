import { ratingSavedSchema, type RatingInput, type AnalyticsContext } from '@exitslide/contracts'
import { requestBackend, type Result, type WorkerContext } from './backend'

export async function sendRating(
  context: WorkerContext,
  sessionId: string,
  clientIp: string,
  input: RatingInput,
  analytics?: AnalyticsContext,
): Promise<Result<{ status: 'saved' }>> {
  try {
    const { success } = await context.ratingLimiter.limit({ key: sessionId + ':' + clientIp })
    if (!success) {
      return { ok: false, status: 429, message: 'Too many ratings right now. Wait a minute and try again.' }
    }
  } catch {
    return { ok: false, status: 503, message: 'Rating is temporarily unavailable. Try again.' }
  }

  return requestBackend(context.backend, '/public/sessions/' + sessionId + '/ratings', ratingSavedSchema, {
    method: 'POST', body: input, analytics,
  })
}
