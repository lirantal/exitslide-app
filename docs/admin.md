# ExitSlide administration

## Cloudflare staging

The workspace pins Cloudflare's `cf` CLI release candidate. From the repo root, start the CLI login and complete the browser device approval. Check that `whoami` shows the account that owns the ExitSlide staging resources before provisioning or deploying. Enable that account's `workers.dev` subdomain for the staging frontend.

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

The staging frontend binds to `exitslide-backend-staging`. The backend binds the dedicated staging D1 database as `DB` and keeps its public and preview URLs disabled. The frontend disables invocation logs and trace retention to keep OAuth callback data out of retained logs.

## WorkOS staging and frontend deployment

In the WorkOS staging environment, open **Applications**, select the ExitSlide application, and copy its **Client ID**. Enable hosted sign-up for the pilot. Add the following URLs in **Redirects**, using your Cloudflare account's `workers.dev` subdomain.

- **Redirect URI** `https://exitslide-frontend-staging.<account-subdomain>.workers.dev/auth/callback`
- **Initiate login URI** `https://exitslide-frontend-staging.<account-subdomain>.workers.dev/sign-in`
- **Default Sign-out URI** `https://exitslide-frontend-staging.<account-subdomain>.workers.dev/`. Add it under **Sign-out URIs** and mark it **Default** so WorkOS can return the browser after logout.

For staging, put these three values in a private `.env` file at the repository root. Keep this file out of version control and use `frontend/.dev.vars` for local development values. AuthKit uses keyless mode for this setup.

```dotenv
WORKOS_CLIENT_ID="client_..."
WORKOS_REDIRECT_URI="https://exitslide-frontend-staging.<account-subdomain>.workers.dev/auth/callback"
WORKOS_COOKIE_PASSWORD="replace-with-output-of-openssl-rand-base64-32"
```

Run `openssl rand -base64 32` to generate the cookie password. Keep it stable across staging deployments to preserve existing sign-ins. The frontend secret input should contain exactly these three values. Use the root `.env` if it contains only those values, or make a separate private dotenv or JSON file if the root `.env` also contains the staging smoke key.

```sh
pnpm --filter @exitslide/frontend deploy:staging --no-provision --secrets-file '<path-to-frontend-secrets-file>'
```

If WorkOS logout lands on `app-homepage-url-not-found`, verify that the staging homepage is marked **Default** under **Sign-out URIs**. For remote admin changes, the official MCP endpoint is registered in [the project's Codex config](../.codex/config.toml). The [WorkOS MCP runbook](workos-admin.md#connect-from-codex-cloud) covers device authorization when the localhost callback fails in Codex Cloud.

## GitHub Actions staging smoke

Create a WorkOS API key in the same **Staging** environment as the ExitSlide AuthKit application. The smoke test uses an `sk_test_` key to create and remove temporary test speakers. For a local run, set `EXITSLIDE_WORKOS_STAGING_API_KEY` in the process environment or the ignored root `.env`. Keep this key separate from the frontend WorkOS credentials and the WorkOS MCP OAuth tokens.

In the ExitSlide GitHub repository, open **Settings → Environments**, create or select **staging**, and add `EXITSLIDE_WORKOS_STAGING_API_KEY` under **Environment secrets**. Set the optional environment variable `EXITSLIDE_STAGING_URL` if the public staging origin changes.

From an authenticated GitHub CLI with permission to manage the repository environment, run the following in Bash from the repo root. If the environment is missing, create it with `gh api --method PUT repos/lirantal/exitslide-app/environments/staging`. The secret upload reads the ignored root `.env` and passes the key on standard input. Verification lists the secret by name.

```bash
set -o pipefail
node --input-type=module -e '
  import { readFileSync } from "node:fs";
  import { parseEnv } from "node:util";
  const key = parseEnv(readFileSync(".env", "utf8")).EXITSLIDE_WORKOS_STAGING_API_KEY;
  if (!key || !/^sk_test_\S+$/.test(key)) throw new Error("Set a WorkOS staging key in .env");
  process.stdout.write(key);
' | gh secret set EXITSLIDE_WORKOS_STAGING_API_KEY --env staging --repo lirantal/exitslide-app
gh secret list --env staging --repo lirantal/exitslide-app
```

If the GitHub integration reports `Resource not accessible by integration`, use `gh auth login --hostname github.com --web --scopes repo` with a repository administrator. In Codex Cloud, use a private temporary `GH_CONFIG_DIR` and unset any injected `GH_TOKEN` or `GITHUB_TOKEN` for login and subsequent admin commands so the device login takes effect. Remove the temporary config when finished.

Once [Staging smoke](../.github/workflows/staging-smoke.yml) is on the default branch, dispatch it from **Actions → Staging smoke → Run workflow**. It also runs on a successful GitHub deployment status for the `staging` environment if the Cloudflare integration publishes that event. The job tests the live staging URL. Cloudflare handles deployment, so the smoke job needs only the WorkOS staging API key. Use the [pilot checklist](pilot.md) for verification and rollback.
