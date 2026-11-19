import { backendHealthSchema } from '@exitslide/contracts'
import { Hono } from 'hono'

const app = new Hono()

app.get('/healthz', (context) =>
  context.json(
    backendHealthSchema.parse({ service: 'exitslide-backend', status: 'ok' }),
  ),
)

export default app
