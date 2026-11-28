import { z } from 'zod'

export const backendHealthSchema = z.strictObject({
  service: z.literal('exitslide-backend'),
  status: z.literal('ok'),
})

export const actorHeader = 'X-ExitSlide-Actor'
export const sessionIdSchema = z.uuid()

// Untrusted attribution only. These fields never authorize a business operation.
export const analyticsContextSchema = z.strictObject({
  enabled: z.boolean(),
  distinctId: z.uuid().optional(),
  sessionId: z.uuid().optional(),
})
export type AnalyticsContext = z.infer<typeof analyticsContextSchema>
export const analyticsEnabledHeader = 'X-ExitSlide-Analytics-Enabled'
export const analyticsDistinctIdHeader = 'X-ExitSlide-Analytics-Distinct-Id'
export const analyticsSessionIdHeader = 'X-ExitSlide-Analytics-Session-Id'
export const deleteSessionInputSchema = z.union([
  sessionIdSchema.transform(id => ({ id, analytics: undefined as AnalyticsContext | undefined })),
  z.strictObject({ id: sessionIdSchema, analytics: analyticsContextSchema.optional() }),
])

export const sessionInputSchema = z.strictObject({
  title: z.string().trim().min(1, 'Enter a title.').max(160, 'Use 160 characters or fewer.'),
  slideUrl: z.string().trim().max(2048).startsWith('https://').pipe(z.url({ protocol: /^https$/ })).refine((value) => {
    const url = new URL(value)
    return !url.username && !url.password
  }, 'Use a shareable HTTPS URL without embedded credentials.'),
})

export const sessionSchema = sessionInputSchema.extend({
  id: sessionIdSchema,
  createdAt: z.iso.datetime(),
})

export const sessionPageSchema = z.strictObject({
  items: z.array(sessionSchema),
  nextCursor: sessionIdSchema.nullable(),
})

export const apiErrorSchema = z.strictObject({
  message: z.string(),
})

export type SessionInput = z.infer<typeof sessionInputSchema>

export const publicSessionSchema = sessionInputSchema.pick({ title: true })

// Set by the frontend Worker for eligible public navigations.
export const engagementHeader = 'X-ExitSlide-Engagement'
export const engagementCountrySchema = z.string().regex(/^(?!XX|T1)[A-Z]{2}$/)
export const engagementDateSchema = z.iso.date()
export const engagementRangeSchema = z.strictObject({
  from: engagementDateSchema.optional(),
  to: engagementDateSchema.optional(),
}).refine(({ from, to }) => !from || !to || from <= to)
export type EngagementRange = z.infer<typeof engagementRangeSchema>

const engagementCountsSchema = z.strictObject({
  visits: z.number().int().nonnegative(),
  slideClicks: z.number().int().nonnegative(),
})
export const engagementReportSchema = z.strictObject({
  totals: engagementCountsSchema,
  days: z.array(engagementCountsSchema.extend({ date: engagementDateSchema })),
  countries: z.array(engagementCountsSchema.extend({ country: engagementCountrySchema })),
})
export type EngagementReport = z.infer<typeof engagementReportSchema>

export const ratingInputSchema = z.strictObject({
  score: z.number().int().min(1).max(5),
  submissionId: z.uuid(),
})

export const ratingPageSchema = z.strictObject({
  items: z.array(ratingInputSchema.extend({ createdAt: z.iso.datetime() })),
  nextCursor: z.uuid().nullable(),
})

export type RatingInput = z.infer<typeof ratingInputSchema>
export type Session = z.infer<typeof sessionSchema>
export type SessionPage = z.infer<typeof sessionPageSchema>
export type PublicSession = z.infer<typeof publicSessionSchema>
export type RatingPage = z.infer<typeof ratingPageSchema>

export const ratingSavedSchema = z.strictObject({ status: z.literal('saved') })
