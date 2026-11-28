import { engagementCountrySchema, type EngagementRange, type EngagementReport } from '@exitslide/contracts'
import { and, desc, eq, gte, isNotNull, lte, sql } from 'drizzle-orm'
import type { DrizzleD1Database } from 'drizzle-orm/d1'
import { engagementEvents } from './schema'

export async function recordEngagement(
  db: D1Database, sessionId: string, type: typeof engagementEvents.$inferInsert.type, attribution?: string,
) {
  if (attribution === undefined) return
  const country = engagementCountrySchema.safeParse(attribution).data ?? null
  try {
    await db.prepare(`
      INSERT INTO engagement_events (id, session_id, type, created_at, country)
      SELECT ?, id, ?, ?, ? FROM sessions WHERE id = ?
    `).bind(crypto.randomUUID(), type, new Date().toISOString(), country, sessionId).run()
  } catch {
    console.warn('engagement_event_write_failed')
  }
}

export async function getEngagementReport(
  db: DrizzleD1Database, sessionId: string, { from, to }: EngagementRange,
): Promise<EngagementReport> {
  const scope = and(
    eq(engagementEvents.sessionId, sessionId),
    from ? gte(engagementEvents.createdAt, from + 'T00:00:00.000Z') : undefined,
    to ? lte(engagementEvents.createdAt, to + 'T23:59:59.999Z') : undefined,
  )
  const date = sql<string>`substr(${engagementEvents.createdAt}, 1, 10)`
  const counts = {
    visits: sql<number>`count(*) filter (where ${engagementEvents.type} = 'visit')`,
    slideClicks: sql<number>`count(*) filter (where ${engagementEvents.type} = 'slide_click')`,
  }
  const [days, countries] = await db.batch([
    db.select({ date, ...counts }).from(engagementEvents).where(scope).groupBy(date).orderBy(desc(date)),
    db.select({ country: sql<string>`${engagementEvents.country}`, ...counts })
      .from(engagementEvents).where(and(scope, isNotNull(engagementEvents.country)))
      .groupBy(engagementEvents.country).orderBy(desc(sql`count(*)`), engagementEvents.country),
  ])
  const totals = { visits: 0, slideClicks: 0 }
  for (const day of days) {
    totals.visits += day.visits
    totals.slideClicks += day.slideClicks
  }
  return { totals, days, countries }
}
