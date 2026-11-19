import { actorHeader, apiErrorSchema } from '@exitslide/contracts'

export interface WorkerContext {
  backend: { fetch(request: Request): Promise<Response> }
}

type BackendOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  owner?: string
  body?: unknown
}

export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; message: string }

export async function requestBackend<T>(
  backend: WorkerContext['backend'],
  path: string,
  schema: { parse(value: unknown): T },
  { method = 'GET', owner, body }: BackendOptions = {},
): Promise<Result<T>> {
  const headers = new Headers()
  if (owner) headers.set(actorHeader, owner)
  if (body !== undefined) headers.set('Content-Type', 'application/json')

  try {
    const result = await backend.fetch(new Request('https://exitslide-backend' + path, {
      method, headers, body: body === undefined ? undefined : JSON.stringify(body),
    }))
    if (result.status === 204) return { ok: true, data: schema.parse(null) }
    const payload: unknown = await result.json()
    if (result.ok) return { ok: true, data: schema.parse(payload) }

    return { ok: false, status: result.status, message: apiErrorSchema.parse(payload).message }
  } catch {
    return { ok: false, status: 503, message: 'The service is temporarily unavailable. Try again.' }
  }
}
