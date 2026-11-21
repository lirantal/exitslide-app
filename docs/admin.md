# ExitSlide administration

## GitHub Actions production releases

A push to `main` runs Verify on that commit. Once it passes, **Deploy production** builds both Workers, checks the Cloudflare configuration, and applies D1 migrations before deploying the private backend and public frontend. The same run checks `/healthz` and runs Live smoke after deploying. Pull requests run Verify. Keep Workers Builds disconnected for both Workers so this workflow controls production release order.

In **Settings → Secrets and variables → Actions**, add these repository settings before enabling the workflow on `main`.

| Name | Setting | Value |
| --- | --- | --- |
| `CLOUDFLARE_ACCOUNT_ID` | Secret or variable | Cloudflare account ID for `brain-labs` |
| `EXITSLIDE_D1_ID` | Secret or variable | UUID of the production `exitslide` D1 database |
| `CLOUDFLARE_API_TOKEN` | Secret | Deployment token scoped to `brain-labs` with Workers Scripts Edit and D1 Edit permissions |
| `EXITSLIDE_WORKOS_SMOKE_API_KEY` | Secret | Existing test API key for the AuthKit environment serving ExitSlide |

If an ID is set in both places, the workflow uses the secret. To create the deployment token, select **Create Token → Create Custom Token** under [Cloudflare API Tokens](https://dash.cloudflare.com/profile/api-tokens). Give it **Account → Workers Scripts → Edit** and **Account → D1 → Edit**, include only the `brain-labs` account, and save the value in the GitHub Actions secret. [Cloudflare token instructions](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/)

The workflow inherits the three existing WorkOS runtime secrets on `exitslide-frontend` and checks that they exist before applying migrations. Keep runtime secret changes in Cloudflare. Check the first push to `main` through **Verify → Deploy production → Verify live deployment**. Use the [pilot checklist](pilot.md) for reruns and rollback.

## Manual Cloudflare deployment

ExitSlide has one live deployment. The workspace pins Cloudflare's `cf` CLI. From the repo root, start the CLI login and complete device approval. Check that `whoami` shows the account that owns the ExitSlide resources. Production uses the account's `workers.dev` subdomain for the frontend.

```sh
pnpm exec cf auth login
pnpm exec cf auth whoami
```

Use the existing production database UUID as `EXITSLIDE_D1_ID`. For a fresh installation, create the database once with `pnpm exec cf d1 create --name exitslide`. Confirm the UUID refers to the intended database before every release. Apply migrations and deploy the backend before deploying the frontend.

```sh
export EXITSLIDE_D1_ID='<production-database-uuid>'
pnpm exec cf d1 migrations apply "$EXITSLIDE_D1_ID" --dir backend/drizzle
pnpm --filter @exitslide/backend run deploy --no-provision
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
pnpm --filter @exitslide/frontend run deploy --no-provision --secrets-file '<path-to-frontend-secrets-file>'
```

If WorkOS logout lands on `app-homepage-url-not-found`, verify that the production homepage is **Default** under **Sign-out URIs**. See the [WorkOS MCP runbook](workos-admin.md#connect-from-codex-cloud) for device authorization if the localhost callback fails.

## GitHub Actions live smoke

Create a WorkOS test API key in the AuthKit environment serving ExitSlide. The smoke test uses an `sk_test_` key to create and remove temporary test speakers. For a local run, set `EXITSLIDE_WORKOS_SMOKE_API_KEY` in the process environment or the ignored root `.env`.

In GitHub, go to **Settings → Secrets and variables → Actions** and add `EXITSLIDE_WORKOS_SMOKE_API_KEY` as a repository secret. If the public origin changes, set the optional repository Actions variable `EXITSLIDE_LIVE_URL` to the production HTTPS origin.

The production workflow calls this check automatically. After a manual deploy or rollback, open **Actions → Live smoke → Run workflow**, select `main`, and monitor the run. Use the [pilot checklist](pilot.md) for verification and rollback.

## Frontend PR previews

Use previews for changes reviewers can see in the frontend, including PRs that also change the backend. For a backend behavior change, update the fixture if a reviewer needs to see its effect. Verify continues to run the real backend and temporary local D1 in CI.

Cloudflare Workers Builds publishes a Preview when a push to a branch other than `main` matches the preview watch paths. Cloudflare posts the link on the PR and updates the same branch URL on subsequent matching pushes. With **Auto-delete** enabled for the Preview, deleting the branch removes its preview. Closing the PR while keeping the branch leaves the preview available. [Cloudflare GitHub integration](https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/github-integration/) · [Preview lifecycle](https://developers.cloudflare.com/workers/ci-cd/builds/api-reference/#manage-previews)

The URL is public and carries synthetic data. Use the preview controls to switch speakers, try the attendee flow, or reset samples. New Sessions and ratings are stored in the current browser, so a new Session link works in another tab of that browser. Seeded Sessions are available to every reviewer.

Connect `lirantal/exitslide-app` in **Workers & Pages → exitslide-pr-preview → Settings → Builds**. Scope the Cloudflare GitHub App installation to this repository and use a build token with **Individual Workers → Editor** for `exitslide-pr-preview`. The Worker's production hostname stays disabled. Leave Preview runtime variables, secrets, and bindings empty. [Cloudflare Worker permissions](https://developers.cloudflare.com/workers/authorization/workers/) · [Cloudflare Preview URLs](https://developers.cloudflare.com/workers/previews/custom-domains/)

| Workers Builds setting | Value |
| --- | --- |
| Root directory | Repository root (`/`) |
| Production branch | `main` |
| Production build command | Leave blank |
| Production deploy command | `echo 'ExitSlide fixture previews have no production deployment'` |
| Enable Preview Builds | On |
| Preview build command | `pnpm install --frozen-lockfile && CLOUDFLARE_PREVIEW_BUILD=true pnpm --filter @exitslide/frontend exec vite build --mode pr-preview` |
| Preview command | `pnpm --filter @exitslide/frontend exec cf previews deploy --prebuilt --mode pr-preview` |
| Preview build variables | `SKIP_DEPENDENCY_INSTALL=true`, `NODE_VERSION=24.22.1`, `PNPM_VERSION=11.25.0` |
| Preview watch paths | `frontend/*`, `packages/contracts/*`, `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `.node-version`, `tsconfig.base.json` |

If the dashboard offers a production build toggle, disable it. The production deploy command is a no-op so a build of `main` cannot publish this Worker. GitHub Actions continues to deploy both production Workers. [Workers Builds settings](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/) · [Build watch paths](https://developers.cloudflare.com/workers/ci-cd/builds/build-watch-paths/) · [Build image variables](https://developers.cloudflare.com/workers/ci-cd/builds/build-image/)

To exercise the preview locally, run the fixture build and browser test.

```sh
CLOUDFLARE_PREVIEW_BUILD=true pnpm --filter @exitslide/frontend exec vite build --mode pr-preview
pnpm test:e2e:preview
```
