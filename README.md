# ExitSlide

ExitSlide lets speakers share slides and collect optional ratings after a Session. The [v1 plan](docs/plans/2026-11-19-2139-feat-exitslide-v1-plan.md) describes the pilot and later features.

See [Architecture and development workflow](docs/architecture.md) for the two-Worker request flow, WorkOS integration, and testing and commit conventions.

## Local development

Use Node 24.22 or newer in the Node 24 line and pnpm 11.25.0.

```sh
pnpm install --frozen-lockfile
pnpm exec cf d1 migrations apply 00000000-0000-4000-8000-000000000001 \
  --local --persist-to frontend/.cloudflare/state --dir backend/drizzle
pnpm dev
```

Vite starts the public frontend at `http://localhost:3000` and loads the backend as an auxiliary Worker. Run `curl -fsS http://localhost:3000/healthz` to check the service binding. A successful response identifies the Hono backend.

For speaker sign-in, copy `frontend/.dev.vars.example` to `frontend/.dev.vars` and set the WorkOS client ID, callback URL, and a random cookie password of at least 32 characters. In the WorkOS development project, register `http://localhost:3000/auth/callback` as the callback, `http://localhost:3000/sign-in` as the initiate-login URI, and `http://localhost:3000/` as the sign-out destination. Restart the dev server after setting the variables. The health check works before WorkOS configuration is added.

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Run `pnpm exec playwright install chromium` once, then `pnpm test:e2e` for the local browser workflow. The suite creates a temporary D1 database, applies the checked-in migrations, and uses a local AuthKit fixture with two test speakers. [Pilot verification](docs/pilot.md) covers the staging checks with real WorkOS accounts.

## Cloudflare staging

The workspace pins Cloudflare's `cf` CLI release candidate. Enable the account's `workers.dev` subdomain for the staging frontend.

```sh
pnpm exec cf auth login
pnpm exec cf auth whoami
```

Create the staging database once with `pnpm exec cf d1 create --name exitslide-staging` and use its UUID as `EXITSLIDE_D1_ID`. For each release, apply migrations and deploy the backend before deploying the frontend.

```sh
export EXITSLIDE_D1_ID='<staging-database-uuid>'
pnpm exec cf d1 migrations apply "$EXITSLIDE_D1_ID" --dir backend/drizzle
pnpm --filter @exitslide/backend deploy:staging --no-provision
```

The staging frontend binds to `exitslide-backend-staging`. The backend keeps its public and preview URLs disabled.

In the WorkOS staging environment, open **Applications**, select the ExitSlide application, and copy its **Client ID**. Add the following URLs in **Redirects**, using your Cloudflare account's `workers.dev` subdomain.

- **Redirect URI** `https://exitslide-frontend-staging.<account-subdomain>.workers.dev/auth/callback`
- **Initiate login URI** `https://exitslide-frontend-staging.<account-subdomain>.workers.dev/sign-in`
- **Default Sign-out URI** `https://exitslide-frontend-staging.<account-subdomain>.workers.dev/`. Add it under **Sign-out URIs** and mark it **Default** so WorkOS can return the browser after logout.

For staging, put these three values in a private `.env` file at the repository root. Keep this file out of version control and use `frontend/.dev.vars` for local development values. AuthKit uses keyless mode for this setup.

```dotenv
WORKOS_CLIENT_ID="client_..."
WORKOS_REDIRECT_URI="https://exitslide-frontend-staging.<account-subdomain>.workers.dev/auth/callback"
WORKOS_COOKIE_PASSWORD="replace-with-output-of-openssl-rand-base64-32"
```

Run `openssl rand -base64 32` to generate the cookie password. Keep it stable across staging deployments to preserve existing sign-ins. If the root `.env` contains only these three variables, pass it to `cf` as shown below. If it contains other settings, pass a separate private dotenv or JSON file with just the three WorkOS values.

```sh
pnpm --filter @exitslide/frontend deploy:staging --no-provision --secrets-file "$PWD/.env"
```

Use the [pilot verification checklist](docs/pilot.md) after deploying.
