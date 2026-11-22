# Product analytics

ExitSlide uses PostHog EU only in the authenticated speaker dashboard. Public pages, attendee ratings, sign-in and auth callbacks do not initialize PostHog. Cloudflare visitor analytics is a separate future task.

## Preference and data

Product analytics starts automatically when a speaker opens the authenticated dashboard. The dashboard's **Privacy preferences** section explains collection and offers a checked **Product analytics** checkbox to turn it off. No affirmative consent is recorded for this default. Explicit choices are stored locally under `exitslide:product-analytics:v1`; existing `declined` preferences remain disabled, while a missing preference enables analytics. Unavailable storage fails closed. Changes synchronize across tabs. Turning analytics off stops new capture and clears PostHog's stored analytics identifier. Sign-out clears the analytics identity and preserves the browser preference, including opt-outs.

When enabled, a random browser identifier in local storage supports funnels and browser-level retention. We do not identify WorkOS users, create person profiles, or correlate devices. Counts represent browsers with analytics enabled, not all speakers. A shared browser is not a reliable person identity. Previously ingested events remain after opting out; this preference is not a historical-data deletion request. Default-on tracking is an opt-out model, not affirmative consent or a guarantee that applicable consent requirements are satisfied.

Only these events are sent:

| Event | Trigger |
| --- | --- |
| `dashboard_viewed` | Dashboard list opens |
| `session_create_started` | New Session form opens |
| `session_detail_viewed` | Session details open |
| `session_created` | Publishing succeeds |
| `session_updated` | Saving edits succeeds |
| `session_deleted` | Deletion succeeds |
| `session_link_copied` | Clipboard write succeeds |

Events include a fixed screen name (`dashboard`, `session_create`, or `session_detail`), pseudonymous SDK identifiers and protocol fields. A final allowlist strips SDK-added URLs, query strings, referrers, initial properties and any unexpected fields. No Session IDs, titles, slide URLs, emails, WorkOS IDs, ratings, form values, or error messages are sent. IP storage and GeoIP enrichment are disabled in SDK configuration. PostHog still receives the connecting IP to handle network requests.

Autocapture, automatic pageviews/pageleaves, replay, surveys, heatmaps, performance capture, exception capture, feature flag requests and external SDK scripts are disabled. This configuration deliberately does not use PostHog's cookieless fingerprint mode. Keep the privacy notice aligned with actual collection; adding new events or tracking features requires reviewing both consent and data collection.

## Configuration and release

The provided public `phc_` ingestion token is configured in `frontend/src/analytics/product-analytics.ts`, with an optional `VITE_POSTHOG_PROJECT_TOKEN` build-time override. This token is designed to ship to browsers; never substitute a personal `phx_` API key. Ingestion is fixed to `https://eu.i.posthog.com`, with the EU UI at `https://eu.posthog.com`.

Normal production builds use this configuration. Local development is disabled unless `VITE_POSTHOG_ENABLED=true` is explicitly provided, and fixture PR previews remain disabled regardless. Browser tests enable analytics with a dummy token and intercept PostHog requests, so tests do not populate the real project. Do not use the production token in analytics tests.

Merge through the existing PR/release workflow to deploy; runtime Cloudflare secrets are not required for this browser-only integration. After deployment, sign into the dashboard in a browser without a saved opt-out and publish a test Session. In PostHog EU, check Activity for `dashboard_viewed`, `session_created` and sanitized properties without touching Privacy preferences. Then turn analytics off and confirm no further requests occur when navigating the dashboard, reloading, or signing out and back in. Build an activation funnel from `session_create_started` to `session_created`, plus a trend of `session_link_copied`. No events are sent for browsers with analytics disabled.

The setup wizard was attempted but could not reach its skills download endpoints. The SDK was integrated directly using [PostHog's TanStack Start guide](https://posthog.com/docs/libraries/tanstack-start) and [collection controls](https://posthog.com/docs/privacy/data-collection). No PostHog MCP credentials or dashboard-management permissions are included in this integration.
