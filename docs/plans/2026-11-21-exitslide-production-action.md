# ExitSlide production deploy action

## Trigger and order

When a push reaches `main`, use the existing Verify job to test that exact commit. On success, run a serialized production release with Cloudflare’s pinned `cf` CLI. Pull requests run Verify with read-only repository permissions and zero deployment credentials.

1. Check that the verified commit still heads `main` and that the production account, D1 database, frontend secret bindings, and live smoke key are configured.
2. Apply checked-in D1 migrations. Migrations must support the Worker versions still serving traffic during a release.
3. Deploy `exitslide-backend`, then `exitslide-frontend`, with automatic provisioning disabled. Keep the frontend’s existing Cloudflare secret bindings.
4. Check `/healthz` and invoke the existing Live smoke suite. Keep manual Live smoke available for diagnosing production or testing a rollback.

A failed step stops the release. After addressing a failure, rerun the failed jobs if the commit still heads `main`, or push a fix. For a failure after the first live change, use the compatible Worker versions and D1 schema guidance in the [pilot checklist](../pilot.md).

## Setup and verification

Configure a Cloudflare deployment token as a repository Actions secret and set the production account and D1 UUID as repository variables. Reuse the existing WorkOS smoke secret. Keep GitHub Actions as the production deploy trigger and leave Cloudflare Workers Builds disconnected for both Workers.

Before merging the workflow, lint the Actions YAML, run the local Verify checks, and dry-run both release deploy commands. Confirm GitHub Verify passes on the PR. After configuring the repository credentials and merging, watch the first production run through Live smoke. Preview URLs remain a separate decision.
