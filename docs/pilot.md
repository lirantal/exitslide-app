# Pilot verification

## Local release checks

Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and `pnpm test:e2e`. Worker tests apply the Drizzle migrations to real local D1. The Playwright test runs both Workers with a local AuthKit fixture, two speaker identities, and an anonymous mobile attendee. It checks edit and delete behavior, private feedback, an interrupted rating response, and the sign-out redirect.

GitHub Actions runs these same checks on pull requests and pushes to `main`. This workflow needs no Cloudflare or WorkOS credentials.

## Staging checks

Deploy using the [staging instructions](admin.md#cloudflare-staging). Check that the public frontend returns `200` for `/healthz` and reports the private backend, that the backend has no public or preview route, and that frontend log and trace retention are disabled.

Run `pnpm test:e2e:staging` after deploying. The suite uses real hosted sign-in, provisions two verified WorkOS staging test speakers, and opens an independent signed-out mobile browser. It retires the temporary Session and removes the test speakers. The suite reads `EXITSLIDE_WORKOS_STAGING_API_KEY` from the environment or the ignored root `.env` and requires a staging key. It uses the ExitSlide staging hostname by default. Set `EXITSLIDE_STAGING_URL` if you move staging to another Cloudflare account subdomain.

To run the same check in GitHub Actions, follow the [GitHub staging smoke setup](admin.md#github-actions-staging-smoke).

The live smoke covers the following user journeys.

1. As the first speaker, sign in through WorkOS and publish a Session with a test deck URL. Copy its public link.
2. Open the public link in the signed-out mobile browser. Open the deck before selecting a rating, then submit a rating and confirm the thank-you message. Reload the speaker's dashboard and verify that one rating is visible there.
3. Open the private dashboard URL as the second speaker and verify that the Session is unavailable. Open the public link as that same speaker and verify that the deck is accessible.
4. Change the deck URL as the first speaker. Open the original public link and verify the new destination. Delete the Session and verify that the link is unavailable and that an already-open attendee page cannot accept a rating.
5. Click **Sign out** once, verify the homepage appears, and reopen `/dashboard` to confirm that WorkOS sign-in is required again.

### Latest staging verification

On 21 November 2026, GitHub Actions successfully ran `pnpm test:e2e:staging` on `main` at merge commit `6e10a3f`. The runner used the `staging` environment secret to provision and remove the two WorkOS test speakers and exercise the live Session flow through sign-out. A separate request to `/healthz` returned HTTP 200 and reported the private backend. [Staging smoke run](https://github.com/lirantal/exitslide-app/actions/runs/44904227187)

`pnpm test:e2e:staging` passed against the live staging deployment after the ExitSlide homepage was set as the default WorkOS **Sign-out URI**. The test verified hosted sign-in, Session publishing and editing, private feedback, public slide access with optional anonymous ratings, and Session retirement. One click on **Sign out** returned to the ExitSlide homepage. Opening `/dashboard` again required sign-in. See the [staging setup](admin.md#cloudflare-staging).

## Restore a prior Worker version

Use `cf workers deployments list --worker <worker-name>` to find the previous version. Check that it can use the current D1 schema. Restore frontend before backend if both need to roll back.

```sh
pnpm exec cf workers deployments create --worker '<worker-name>' \
  --strategy percentage --versions '[{"version_id":"<compatible-version-id>","percentage":100}]'
```

Retest `/healthz` and the affected flow after restoring the version. If the prior version requires an incompatible schema, fix forward with a compatible migration and Worker release.
