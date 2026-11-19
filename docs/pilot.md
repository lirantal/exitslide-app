# Pilot verification

## Local release checks

Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and `pnpm test:e2e`. Worker tests apply the Drizzle migrations to real local D1. The Playwright test runs both Workers with a local AuthKit fixture, two speaker identities, and an anonymous mobile attendee. It checks edit and delete behavior, private feedback, an interrupted rating response, and the sign-out redirect.

## Staging checks

Deploy using the [staging instructions](../README.md#cloudflare-staging). Check that the public frontend returns `200` for `/healthz` and reports the private backend, that the backend has no public or preview route, and that frontend log and trace retention are disabled.

Use two real WorkOS staging accounts and one signed-out browser context for the hosted smoke test.

1. As the first speaker, sign in through WorkOS and publish a Session with a test deck URL. Copy its public link.
2. Open the public link in the signed-out mobile browser. Open the deck before selecting a rating, then submit a rating and confirm the thank-you message. Reload the speaker's dashboard and verify that one rating is visible there.
3. Open the private dashboard URL as the second speaker and verify that the Session is unavailable. Open the public link as that same speaker and verify that the deck is accessible.
4. Change the deck URL as the first speaker. Open the original public link and verify the new destination. Delete the Session and verify that the link is unavailable and that an already-open attendee page cannot accept a rating.
5. Click **Sign out** once, verify the homepage appears, and reopen `/dashboard` to confirm that WorkOS sign-in is required again.

### Latest staging verification

The service binding, private backend URL, signed-out dashboard guard, and WorkOS handoff passed. A staged mobile browser opened a disposable Session and saved one anonymous rating. Retirement returned `404` and removed the test rating. The two-account dashboard and hosted sign-out checks still need real WorkOS sessions. Playwright covers the equivalent app workflow locally with fixture identities.

## Restore a prior Worker version

Use `cf workers deployments list --worker <worker-name>` to find the previous version. Check that it can use the current D1 schema. Restore frontend before backend if both need to roll back.

```sh
pnpm exec cf workers deployments create --worker '<worker-name>' \
  --strategy percentage --versions '[{"version_id":"<compatible-version-id>","percentage":100}]'
```

Retest `/healthz` and the affected flow after restoring the version. If the prior version requires an incompatible schema, fix forward with a compatible migration and Worker release.
