# Product analytics

ExitSlide uses PostHog EU for product analytics. The browser SDK runs only in the authenticated speaker dashboard; the private backend records successful Session mutations and saved ratings. Public pages, sign-in and auth callbacks do not initialize the browser SDK. Cloudflare visitor analytics is a separate future task.

## Preference and data

Product analytics starts automatically when a speaker opens the authenticated dashboard. The dashboard's **Privacy preferences** section explains collection and offers a checked **Product analytics** checkbox to turn it off. No affirmative consent is recorded for this default. Explicit choices are stored locally under `exitslide:product-analytics:v1`; existing `declined` preferences remain disabled, while a missing preference enables analytics. Unavailable storage fails closed. Changes synchronize across tabs. Turning analytics off stops new browser capture, disables telemetry on subsequent business requests from this browser, and clears PostHog's stored analytics identifier. Sign-out clears the analytics identity and preserves the browser preference, including opt-outs.

When enabled, a random browser identifier in local storage supports funnels and browser-level retention. We do not send raw WorkOS IDs or create person profiles. Normal browser-attributed counts represent browsers with analytics enabled, not all speakers. A shared browser is not a reliable person identity. Previously ingested events remain after opting out; this preference is not a historical-data deletion request. Default-on tracking is an opt-out model, not affirmative consent or a guarantee that applicable consent requirements are satisfied.

## Event ownership

| Event | Source | Trigger |
| --- | --- | --- |
| `dashboard_viewed` | Browser | Dashboard list opens |
| `session_create_started` | Browser | New Session form opens |
| `session_detail_viewed` | Browser | Session details open |
| `session_link_copied` | Browser | Clipboard write succeeds |
| `session_created` | Backend | Session insert succeeds |
| `session_updated` | Backend | Authorized update succeeds |
| `session_deleted` | Backend | Authorized deletion succeeds |
| `rating_submitted` | Backend | A new valid rating is inserted |

Successful mutations are no longer captured in the browser, preventing double counting. Backend events run after persistence and ownership checks. Invalid input, unauthorized operations, missing Sessions, conflicting ratings, and rate-limited requests do not emit success events. Rating retries keep the existing submission UUID and return success without producing another analytics event. The rating event includes only its validated integer `score` (1–5), alongside fixed protocol fields.

Every event has a fixed `source` (`browser` or `backend`). Browser events include a fixed screen name (`dashboard`, `session_create`, or `session_detail`). An outbound allowlist removes URLs, referrers, query strings, initial properties and unexpected fields. Neither source sends titles, slide URLs, raw WorkOS IDs, emails, Session IDs, submission IDs, form values, request headers/IPs, or raw errors. SDK identifiers are pseudonymous personal data, not a claim of anonymization.

For speaker mutations, the browser passes its enabled preference plus validated pseudonymous distinct/session UUIDs through the server function. The frontend forwards these separately from business data over the private service binding. They are untrusted analytics attribution, never authorization; ownership still comes exclusively from WorkOS. Matching IDs join a `session_create_started` → `session_created` funnel without creating person profiles. If the SDK is unavailable or not ready, the backend uses a namespaced SHA-256 digest of the authenticated owner ID; these fallback events cannot be joined to the browser funnel. The fallback digest is stable per account and can link fallback backend events across devices; it is never merged with browser identities.

Ratings use a digest scoped to the Session/submission pair. They are not linked to a speaker/browser ID or used to track attendees across visits. No attendee pageview, slide-link click, or browser interaction telemetry has been added; a saved rating is a server-side business event.

The backend requires an explicit enabled header from the frontend. A saved opt-out disables it even when the SDK has not loaded; missing attribution from older clients also skips analytics. Local development and previews send a disabled preference. Production live-smoke browsers save an opt-out so synthetic WorkOS speakers and ratings do not populate the real PostHog project.

## Worker delivery

The private backend uses the official `posthog-node` SDK, including its Worker-compatible export, with EU ingestion. A per-event client uses `captureImmediate()` and `shutdown()` inside `executionCtx.waitUntil()`. Timeouts/retries are bounded and provider failures never change the business response. A fixed `product_analytics_delivery_failed` warning contains no provider payload or credentials. Delivery is best effort, with no durable outbox or exactly-once guarantee: a Worker failure after the database commit can lose an event. These counts are not suitable for billing.

IP storage and GeoIP enrichment are disabled. For browser events PostHog still receives the connecting IP to handle the network request; backend events originate at Cloudflare and do not forward visitor IPs.

Autocapture, automatic pageviews/pageleaves, replay, surveys, heatmaps, performance capture, exception capture, feature flag requests and external SDK scripts are disabled. This configuration deliberately does not use PostHog's cookieless fingerprint mode. Keep the privacy notice aligned with actual collection; adding new events or tracking features requires reviewing both consent and data collection.

## PostHog and Cloudflare setup

No new personal API key is needed. Use the same project's public `phc_` ingestion token for both SDKs:

1. In PostHog EU, open **Settings → Project → Project API key/token** and copy the existing project token. Do not create or supply a `phx_` personal key.
2. In Cloudflare, open **Workers & Pages → exitslide-backend → Settings → Variables and Secrets → Add**.
3. Choose **Secret**, name it **`POSTHOG_PROJECT_TOKEN`**, paste the `phc_` token, and save/deploy the setting. Select the live backend Worker, not the frontend or a fixture preview.
4. Add this before merging the server-events PR. Production deployment checks that the backend secret exists before migrations or Worker deployment. The backend has no hardcoded production-token fallback.

No extra PostHog settings, cookieless mode, GeoIP, session replay or personal API credentials are required. The host is fixed to the EU region in code. The token is not a read/admin credential; storing the server copy as a Cloudflare secret separates configuration from source and supports rotation. The browser's public token is already configured; keep both copies pointed at the same project.

## Browser configuration and release

The provided public `phc_` ingestion token is configured in `frontend/src/analytics/product-analytics.ts`, with an optional `VITE_POSTHOG_PROJECT_TOKEN` build-time override. This token is designed to ship to browsers; never substitute a personal `phx_` API key. Ingestion is fixed to `https://eu.i.posthog.com`, with the EU UI at `https://eu.posthog.com`.

Normal production builds use this configuration. Local development is disabled unless `VITE_POSTHOG_ENABLED=true` is explicitly provided, and fixture PR previews remain disabled regardless. Browser tests enable analytics with a dummy token and intercept PostHog requests, so tests do not populate the real project. Do not use the production token in analytics tests.

Merge through the existing PR/release workflow to deploy; the backend requires `POSTHOG_PROJECT_TOKEN` as described above. After deployment, sign into the dashboard in a browser without a saved opt-out and publish a test Session. In PostHog EU, check Activity for `dashboard_viewed` (`source=browser`), `session_created` (`source=backend`) and sanitized properties without touching Privacy preferences. Then turn analytics off and confirm no further requests occur when navigating the dashboard, reloading, or signing out and back in. Submit one attendee rating, retry with the same submission ID if testing delivery, and confirm only one `rating_submitted` event with a bounded score. Build an activation funnel from `session_create_started` to `session_created`, plus a trend of `session_link_copied`. No events are sent for business requests with analytics disabled. A browser preference is not retroactive deletion of events already queued or delivered.

The setup wizard was attempted but could not reach its skills download endpoints. The SDK was integrated directly using [PostHog's TanStack Start guide](https://posthog.com/docs/libraries/tanstack-start) and [collection controls](https://posthog.com/docs/privacy/data-collection). No PostHog MCP credentials or dashboard-management permissions are included in this integration.
