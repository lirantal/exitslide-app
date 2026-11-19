import { z } from 'zod'

export const backendHealthSchema = z.strictObject({
  service: z.literal('exitslide-backend'),
  status: z.literal('ok'),
})
