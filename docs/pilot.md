# Pilot verification

## Local release checks

Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and `pnpm test:e2e`. Worker tests apply the Drizzle migrations to real local D1. The Playwright test runs both Workers with a local AuthKit fixture, two speaker identities, and an anonymous mobile attendee. It checks edit and delete behavior, private feedback, an interrupted rating response, and the sign-out redirect.

The GitHub Actions Verify job runs these same checks on pull requests and pushes to `main`. Verify needs no Cloudflare or WorkOS credentials. Successful pushes to `main` continue into the [production release workflow](admin.md#github-actions-production-releases).

## Live checks

Check that the public frontend returns `200` for `/healthz` and reports the private backend, that the backend has no public or preview route, and that frontend log and trace retention are disabled. The [manual deployment instructions](admin.md#manual-cloudflare-deployment) cover recovery and first-time setup.

Run `pnpm test:e2e:live` after deploying. The suite uses real hosted sign-in, provisions two verified WorkOS test speakers, and opens an independent signed-out mobile browser. It retires the temporary Session and removes the test speakers. The suite reads `EXITSLIDE_WORKOS_SMOKE_API_KEY` from the environment or the ignored root `.env` and requires a WorkOS test key for the AuthKit tenant that serves ExitSlide. It uses the ExitSlide production hostname by default. Set `EXITSLIDE_LIVE_URL` if you move production to another Cloudflare account subdomain.

To run the same check in GitHub Actions, follow the [GitHub live smoke setup](admin.md#github-actions-live-smoke).

For a failed release, check the last successful step. If the commit still heads `main`, fix the cause and rerun failed jobs. A smoke-only rerun repeats verification. A deploy rerun applies pending migrations and redeploys both Workers. If the commit has been superseded, use the new `main` run. Use compatible migrations so the existing Workers can continue to serve requests while deployment is underway.

The live smoke covers the following user journeys.

1. As the first speaker, sign in through WorkOS and publish a Session with a test deck URL. Copy its public link.
2. Open the public link in the signed-out mobile browser. Open the deck before selecting a rating, then submit a rating and confirm the thank-you message. Reload the speaker's dashboard and verify that one rating is visible there.
3. Open the private dashboard URL as the second speaker and verify that the Session is unavailable. Open the public link as that same speaker and verify that the deck is accessible.
4. Change the deck URL as the first speaker. Open the original public link and verify the new destination. Delete the Session and verify that the link is unavailable and that an already-open attendee page cannot accept a rating.
5. Click **Sign out** once, verify the homepage appears, and reopen `/dashboard` to confirm that WorkOS sign-in is required again.

### Production cutover verification

On 21 November 2026, the ExitSlide pilot moved to `exitslide-frontend` and the private `exitslide-backend`. The release applied the D1 migration to `exitslide` and copied all seven retired Session link IDs from the source database. The source had no active Sessions or ratings before or after the switch. The production `/healthz` endpoint returned HTTP 200, and Cloudflare reported that the backend had public and preview URLs disabled.

During the cutover, the old frontend hostname redirected Session links to production. No one had shared links from that hostname, so its Cloudflare public endpoint was disabled and the redirect Worker source was removed. The old backend and D1 database are retained for rollback. Cloudflare reported no Workers Builds configuration for the previous Workers. Releases use `cf` and GitHub Actions verifies them.

Production uses the existing WorkOS client and speaker identities in the environment now named **Pilot AuthKit**. Only the production callback and sign-out URLs are registered. GitHub Actions passed Live smoke on `main` at `1d36f1b` with the repository secret [before the hostname switch](https://github.com/lirantal/exitslide-app/actions/runs/44906638874) and [after the hostname switch and WorkOS cleanup](https://github.com/lirantal/exitslide-app/actions/runs/44906910098).

### Pre-cutover baseline

On 21 November 2026, GitHub Actions successfully ran `pnpm test:e2e:staging` on `main` at merge commit `6e10a3f`. The runner used the `staging` environment secret to provision and remove the two WorkOS test speakers and exercise the live Session flow through sign-out. A separate request to `/healthz` returned HTTP 200 and reported the private backend. [Staging smoke run](https://github.com/lirantal/exitslide-app/actions/runs/44904227187)

## Restore a prior Worker version

Use `cf workers deployments list --worker <worker-name>` to find the previous version. Check that it can use the current D1 schema. Restore frontend before backend if both need to roll back.

```sh
pnpm exec cf workers deployments create --worker '<worker-name>' \
  --strategy percentage --versions '[{"version_id":"<compatible-version-id>","percentage":100}]'
```

Retest `/healthz` and the affected flow after restoring the version. If the prior version requires an incompatible schema, fix forward with a compatible migration and Worker release.
