# ExitSlide administration

## Cloudflare production

ExitSlide has one live deployment. The workspace pins Cloudflare's `cf` CLI. From the repo root, start the CLI login and complete device approval. Check that `whoami` shows the account that owns the ExitSlide resources. Production uses the account's `workers.dev` subdomain for the frontend.

```sh
pnpm exec cf auth login
pnpm exec cf auth whoami
```

Use the existing production database UUID as `EXITSLIDE_D1_ID`. For a fresh installation, create the database once with `pnpm exec cf d1 create --name exitslide`. Confirm the UUID refers to the intended database before every release. Apply migrations and deploy the backend before deploying the frontend.

```sh
export EXITSLIDE_D1_ID='<production-database-uuid>'
pnpm exec cf d1 migrations apply "$EXITSLIDE_D1_ID" --dir backend/drizzle
pnpm --filter @exitslide/backend deploy --no-provision
```

The frontend binds to `exitslide-backend`. The backend binds the production D1 database as `DB` and keeps its public and preview URLs disabled. The frontend disables invocation logs and traces to keep OAuth callback data out of retained logs.

## WorkOS and frontend deployment

In WorkOS, open **Applications** in the ExitSlide AuthKit environment and select the ExitSlide application. Keep the existing client ID when deploying an existing installation. D1 associates Sessions with WorkOS user IDs. Enable hosted sign-up and configure these URLs in **Redirects**, substituting the production origin if it differs.

- **Redirect URI** `https://exitslide-frontend.brain-labs.workers.dev/auth/callback`
- **Initiate login URI** `https://exitslide-frontend.brain-labs.workers.dev/sign-in`
- **Default Sign-out URI** `https://exitslide-frontend.brain-labs.workers.dev/`. Add it under **Sign-out URIs** and mark it **Default**.

Put these three values in a private dotenv or JSON file for the frontend deployment. AuthKit uses keyless mode. Use `frontend/.dev.vars` for local development values.

```dotenv
WORKOS_CLIENT_ID="client_..."
WORKOS_REDIRECT_URI="https://exitslide-frontend.brain-labs.workers.dev/auth/callback"
WORKOS_COOKIE_PASSWORD="replace-with-output-of-openssl-rand-base64-32"
```

Run `openssl rand -base64 32` to generate the cookie password for a new origin. Keep it stable across subsequent deployments to preserve sign-ins. The frontend secret file should contain only the three values above.

```sh
pnpm --filter @exitslide/frontend deploy --no-provision --secrets-file '<path-to-frontend-secrets-file>'
```

If WorkOS logout lands on `app-homepage-url-not-found`, verify that the production homepage is **Default** under **Sign-out URIs**. See the [WorkOS MCP runbook](workos-admin.md#connect-from-codex-cloud) for device authorization if the localhost callback fails.

## Previously shared Session links

The old hostname can serve the compatibility Worker in `frontend/legacy-links`. It redirects old Session links to production, keeps their paths and queries, and sends old bookmarks to the production homepage. Deploy it after the production hostname is ready. If switching hostnames again, update its destination before deploying it.

```sh
pnpm --filter @exitslide/frontend exec vite build legacy-links --config legacy-links/vite.config.ts
(cd frontend/legacy-links && ../../node_modules/.bin/cf deploy --prebuilt --no-provision)
```

## GitHub Actions live smoke

Create a WorkOS test API key in the AuthKit environment serving ExitSlide. The smoke test uses an `sk_test_` key to create and remove temporary test speakers. For a local run, set `EXITSLIDE_WORKOS_SMOKE_API_KEY` in the process environment or the ignored root `.env`.

In GitHub, go to **Settings → Secrets and variables → Actions** and add `EXITSLIDE_WORKOS_SMOKE_API_KEY` as a repository secret. If the public origin changes, set the optional repository Actions variable `EXITSLIDE_LIVE_URL` to the production HTTPS origin.

After deploying with `cf`, open **Actions → Live smoke → Run workflow**, select `main`, and monitor the run. Use the [pilot checklist](pilot.md) for verification and rollback.
