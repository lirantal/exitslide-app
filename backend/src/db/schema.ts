import { sql } from 'drizzle-orm'
import { check, index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const sessionLinks = sqliteTable('session_links', {
  id: text().primaryKey().notNull(),
})

export const sessions = sqliteTable('sessions', {
  id: text().primaryKey().notNull().references(() => sessionLinks.id),
  ownerId: text('owner_id').notNull(),
  title: text().notNull(),
  slideUrl: text('slide_url').notNull(),
  createdAt: text('created_at').notNull(),
}, (table) => [
  index('sessions_by_owner').on(table.ownerId, table.createdAt, table.id),
])

export const ratings = sqliteTable('ratings', {
  sessionId: text('session_id').notNull().references(() => sessions.id, { onDelete: 'cascade' }),
  submissionId: text('submission_id').notNull(),
  score: integer().notNull(),
  createdAt: text('created_at').notNull(),
}, (table) => [
  primaryKey({ columns: [table.sessionId, table.submissionId] }),
  check('rating_score', sql`typeof(${table.score}) = 'integer' and ${table.score} between 1 and 5`),
  index('ratings_by_session').on(table.sessionId, table.createdAt, table.submissionId),
])

export const engagementEvents = sqliteTable('engagement_events', {
  id: text().primaryKey().notNull(),
  sessionId: text('session_id').notNull().references(() => sessions.id, { onDelete: 'cascade' }),
  type: text({ enum: ['visit', 'slide_click'] }).notNull(),
  createdAt: text('created_at').notNull(),
  country: text(),
}, (table) => [
  check('engagement_event_type', sql`${table.type} in ('visit', 'slide_click')`),
  index('engagement_events_by_session').on(table.sessionId, table.createdAt),
])
