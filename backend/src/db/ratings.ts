import type { RatingInput } from '@exitslide/contracts'
import { and, desc, eq, lt, or } from 'drizzle-orm'
import type { DrizzleD1Database } from 'drizzle-orm/d1'
import { ratings, sessions } from './schema'
import { pageSize } from './sessions'

export function getPublicSession(db: DrizzleD1Database, id: string) {
  return db.select({ title: sessions.title, slideUrl: sessions.slideUrl })
    .from(sessions).where(eq(sessions.id, id)).get()
}

export async function saveRating(db: D1Database, id: string, input: RatingInput) {
  const [ , read ] = await db.batch<{ score: number }>([
    db.prepare(`
      INSERT INTO ratings (session_id, submission_id, score, created_at)
      SELECT id, ?, ?, ? FROM sessions WHERE id = ?
      ON CONFLICT (session_id, submission_id) DO NOTHING
    `).bind(input.submissionId, input.score, new Date().toISOString(), id),
    db.prepare('SELECT score FROM ratings WHERE session_id = ? AND submission_id = ?')
      .bind(id, input.submissionId),
  ])

  const existing = read.results[0]
  if (!existing) return 'unavailable'
  return existing.score === input.score ? 'saved' : 'conflict'
}

export async function listRatings(db: DrizzleD1Database, id: string, cursor?: string) {
  const scope = eq(ratings.sessionId, id)
  const fields = { score: ratings.score, submissionId: ratings.submissionId, createdAt: ratings.createdAt }
  const after = cursor ? await db.select(fields).from(ratings)
    .where(and(scope, eq(ratings.submissionId, cursor))).get() : undefined
  if (cursor && !after) return null

  const rows = await db.select(fields).from(ratings)
    .where(after ? and(scope, or(lt(ratings.createdAt, after.createdAt),
      and(eq(ratings.createdAt, after.createdAt), lt(ratings.submissionId, after.submissionId)))) : scope)
    .orderBy(desc(ratings.createdAt), desc(ratings.submissionId)).limit(pageSize + 1)
  const items = rows.slice(0, pageSize)
  return { items, nextCursor: rows.length > pageSize ? items[pageSize - 1].submissionId : null }
}
