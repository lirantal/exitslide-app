# ExitSlide

ExitSlide lets speakers share slides and collect optional ratings after a Session. The [v1 plan](docs/plans/2026-11-19-2139-feat-exitslide-v1-plan.md) describes the pilot and later features.

See [Architecture and development workflow](docs/architecture.md) for the two-Worker request flow, WorkOS integration, and testing and commit conventions.

[Product analytics](docs/analytics.md) documents the default-on PostHog EU integration, opt-out preference, collected events, and release verification.

[Traffic analytics](docs/traffic-analytics.md) documents the cookieless Cloudflare Web Analytics integration on public pages.

## Local development

Use Node 24.22 or newer in the Node 24 line and pnpm 11.25.0.

```sh
pnpm install --frozen-lockfile
pnpm exec cf d1 migrations apply 00000000-0000-4000-8000-000000000001 \
  --local --persist-to frontend/.cloudflare/state --dir backend/drizzle
pnpm dev
```

Vite starts the public frontend at `http://localhost:3000` and loads the backend as an auxiliary Worker. Run `curl -fsS http://localhost:3000/healthz` to check the service binding. A successful response identifies the Hono backend.

The product website lives in `website/`. Run `pnpm --filter @exitslide/website dev` to preview it locally. Its account links go to the production app.

For speaker sign-in, copy `frontend/.dev.vars.example` to `frontend/.dev.vars` and set the WorkOS client ID, callback URL, and a random cookie password of at least 32 characters. In the WorkOS development project, register `http://localhost:3000/auth/callback` as the callback, `http://localhost:3000/sign-in` as the initiate-login URI, and `http://localhost:3000/` as the sign-out destination. Restart the dev server after setting the variables. The health check works before WorkOS configuration is added.

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Run `pnpm exec playwright install chromium` once, then `pnpm test:e2e` for the local browser workflow. The suite creates a temporary D1 database, applies the checked-in migrations, and uses a local AuthKit fixture with two test speakers. [Pilot verification](docs/pilot.md) covers `pnpm test:e2e:live` and the GitHub Actions workflow.

## Project administration

**[Deploy production](https://github.com/lirantal/exitslide-app/actions/workflows/ci.yml)** · Click **Run workflow**, select `main`, and confirm **Run workflow**.

The [admin runbook](docs/admin.md) covers production deployment, credentials, [landing-page DNS](docs/admin.md#landing-page-domains), and [fixture-backed frontend PR previews](docs/admin.md#frontend-pr-previews). The [pilot checklist](docs/pilot.md) covers release verification and rollback.
