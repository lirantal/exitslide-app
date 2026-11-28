import type { SessionInput } from '@exitslide/contracts'
import { and, desc, eq, lt, or } from 'drizzle-orm'
import type { DrizzleD1Database } from 'drizzle-orm/d1'
import { sessionLinks, sessions } from './schema'

const sessionFields = {
  id: sessions.id,
  title: sessions.title,
  slideUrl: sessions.slideUrl,
  createdAt: sessions.createdAt,
}

export const pageSize = 20

export function getPublicSession(db: DrizzleD1Database, id: string) {
  return db.select({ title: sessions.title }).from(sessions).where(eq(sessions.id, id)).get()
}

export function getSlideDestination(db: DrizzleD1Database, id: string) {
  return db.select({ slideUrl: sessions.slideUrl }).from(sessions).where(eq(sessions.id, id)).get()
}

export async function getSession(db: DrizzleD1Database, owner: string, id: string) {
  return db.select(sessionFields).from(sessions)
    .where(and(eq(sessions.ownerId, owner), eq(sessions.id, id))).get()
}

export async function listSessions(db: DrizzleD1Database, owner: string, cursor?: string) {
  const after = cursor ? await getSession(db, owner, cursor) : undefined
  if (cursor && !after) return null

  const ownerFilter = eq(sessions.ownerId, owner)
  const rows = await db.select(sessionFields).from(sessions)
    .where(after ? and(ownerFilter, or(
      lt(sessions.createdAt, after.createdAt),
      and(eq(sessions.createdAt, after.createdAt), lt(sessions.id, after.id)),
    )) : ownerFilter)
    .orderBy(desc(sessions.createdAt), desc(sessions.id)).limit(pageSize + 1)

  const items = rows.slice(0, pageSize)
  return { items, nextCursor: rows.length > pageSize ? items[pageSize - 1].id : null }
}

export async function createSession(db: DrizzleD1Database, owner: string, input: SessionInput) {
  const session = { ...input, id: crypto.randomUUID(), createdAt: new Date().toISOString() }
  await db.batch([
    db.insert(sessionLinks).values({ id: session.id }),
    db.insert(sessions).values({ ...session, ownerId: owner }),
  ])
  return session
}

export async function updateSession(db: DrizzleD1Database, owner: string, id: string, input: SessionInput) {
  return db.update(sessions).set(input)
    .where(and(eq(sessions.ownerId, owner), eq(sessions.id, id))).returning(sessionFields).get()
}

export async function retireSession(db: DrizzleD1Database, owner: string, id: string) {
  const row = await db.delete(sessions)
    .where(and(eq(sessions.ownerId, owner), eq(sessions.id, id))).returning({ id: sessions.id }).get()
  return Boolean(row)
}
