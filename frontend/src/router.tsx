import { createRouter } from '@tanstack/react-router'
import type { WorkerContext } from './server/backend'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  return createRouter({ routeTree, scrollRestoration: true })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
    server: { requestContext: WorkerContext }
  }
}
