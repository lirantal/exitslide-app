import {
  actorHeader, ratingInputSchema, ratingPageSchema, sessionInputSchema, sessionSchema,
  type RatingPage, type Session,
} from '@exitslide/contracts'

export const sampleSessionId = '10000000-0000-4000-8000-000000000001'
export const dataCookie = 'exitslide-preview-data'
export const speakerCookie = 'exitslide-test-user'

type FixtureSession = {
  owner: string
  session: Session
  ratings: RatingPage['items']
}

const sampleDate = '2026-11-21T10:00:00.000Z'

export function isSpeaker(value: unknown): value is 'user_first' | 'user_second' {
  return value === 'user_first' || value === 'user_second'
}

function sampleSessions(): FixtureSession[] {
  return [
    {
      owner: 'user_first',
      session: { id: sampleSessionId, title: 'Making the web work for everyone', slideUrl: 'https://example.com/slides', createdAt: sampleDate },
      ratings: [{ submissionId: '20000000-0000-4000-8000-000000000001', score: 5, createdAt: sampleDate }],
    },
    {
      owner: 'user_second',
      session: { id: '10000000-0000-4000-8000-000000000002', title: 'Designing better feedback loops', slideUrl: 'https://example.com/feedback', createdAt: sampleDate },
      ratings: [],
    },
  ]
}

export function previewCookie(name: string, value: string, maxAge?: number) {
  return name + '=' + value + '; Path=/; HttpOnly; Secure; SameSite=Lax' +
    (maxAge === undefined ? '' : '; Max-Age=' + maxAge)
}

function readSessions(request: Request): FixtureSession[] {
  const cookie = request.headers.get('Cookie')?.split('; ')
    .find(part => part.startsWith(dataCookie + '='))?.slice(dataCookie.length + 1)
  if (!cookie || cookie.length > 3600) return sampleSessions()

  try {
    const rows: unknown = JSON.parse(decodeURIComponent(cookie))
    if (!Array.isArray(rows)) return sampleSessions()
    return rows.map((row: FixtureSession) => {
      if (!isSpeaker(row.owner)) throw new Error('Invalid fixture speaker.')
      return {
        owner: row.owner,
        session: sessionSchema.parse(row.session),
        ratings: ratingPageSchema.shape.items.parse(row.ratings),
      }
    })
  } catch {
    return sampleSessions()
  }
}

const unavailable = () => Response.json({ message: 'Session unavailable.' }, { status: 404 })

export function createFixtures(request: Request) {
  const sessions = readSessions(request)
  let cookie: string | undefined

  function save(response: Response) {
    const encoded = encodeURIComponent(JSON.stringify(sessions))
    if (encoded.length > 3600) {
      return Response.json({ message: 'Preview data is full. Reset the sample data to continue.' }, { status: 422 })
    }
    cookie = previewCookie(dataCookie, encoded)
    return response
  }

  return {
    get cookie() { return cookie },
    async fetch(request: Request) {
      const [, prefix, collection, publicId, action] = new URL(request.url).pathname.split('/')
      const method = request.method
      if (prefix === 'public' && collection === 'sessions') {
        const row = sessions.find(row => row.session.id === publicId)
        if (!row) return unavailable()
        if (method === 'GET' && !action) {
          return Response.json(sessionInputSchema.parse({ title: row.session.title, slideUrl: row.session.slideUrl }))
        }
        if (method !== 'POST' || action !== 'ratings') return unavailable()

        const rating = ratingInputSchema.safeParse(await request.json())
        if (!rating.success) return Response.json({ message: 'Choose a rating from 1 to 5.' }, { status: 422 })
        const existing = row.ratings.find(item => item.submissionId === rating.data.submissionId)
        if (existing && existing.score !== rating.data.score) {
          return Response.json({ message: 'This submission already has a different rating.' }, { status: 409 })
        }
        if (!existing) row.ratings.unshift({ ...rating.data, createdAt: new Date().toISOString() })
        return save(Response.json({ status: 'saved' }))
      }

      const owner = request.headers.get(actorHeader)
      if (prefix !== 'sessions' || !isSpeaker(owner)) return unavailable()
      const ownedSessions = sessions.filter(row => row.owner === owner)
      if (!collection && method === 'GET') {
        return Response.json({ items: ownedSessions.map(row => row.session), nextCursor: null })
      }
      if (!collection && method === 'POST') {
        const input = sessionInputSchema.parse(await request.json())
        const session = { ...input, id: crypto.randomUUID(), createdAt: new Date().toISOString() }
        sessions.unshift({ owner, session, ratings: [] })
        return save(Response.json(session, { status: 201 }))
      }
      const row = ownedSessions.find(row => row.session.id === collection)
      if (!row) return unavailable()
      if (publicId === 'ratings' && method === 'GET') {
        return Response.json({ items: row.ratings, nextCursor: null })
      }
      if (method === 'GET') return Response.json(row.session)
      if (method === 'PATCH') {
        row.session = { ...row.session, ...sessionInputSchema.parse(await request.json()) }
        return save(Response.json(row.session))
      }
      if (method === 'DELETE') {
        sessions.splice(sessions.indexOf(row), 1)
        return save(new Response(null, { status: 204 }))
      }
      return unavailable()
    },
  }
}
