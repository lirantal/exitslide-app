import { backendHealthSchema } from '@exitslide/contracts'
import { Hono } from 'hono'

import { publicSessionRoutes } from './routes/public-sessions'
import { sessionRoutes } from './routes/sessions'
import type { DatabaseBindings } from './routes/sessions'

const app = new Hono<{ Bindings: DatabaseBindings }>()

app.onError((_error, context) => context.json({ message: 'Storage is temporarily unavailable.' }, 503))
app.route('/sessions', sessionRoutes)
app.route('/public/sessions', publicSessionRoutes)

app.get('/healthz', (context) =>
  context.json(
    backendHealthSchema.parse({ service: 'exitslide-backend', status: 'ok' }),
  ),
)

export default app
