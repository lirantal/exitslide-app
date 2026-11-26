# Cloudflare Web Analytics

Cloudflare Web Analytics measures traffic and performance on ExitSlide's public documents. PostHog remains responsible for product navigation and business events. This integration adds no cookie banner, persistent visitor ID, browser storage, or fingerprinting. Cloudflare documents its [privacy model](https://www.cloudflare.com/web-analytics/) and [RUM data collection](https://developers.cloudflare.com/web-analytics/llms-full.txt).

## Registered site

The `brain-labs` account has a manually installed Web Analytics site for `app.exitslide.top`.

- Site ID: `4371efa2377242249224114f95f9f595`.
- Public beacon token: configured in `frontend/src/analytics/web-analytics.ts`. This is an ingestion token, not a Cloudflare API credential.
- Automatic injection is off. The app installs the official beacon on the public pages listed below.

In the Cloudflare dashboard, select `brain-labs`, open **Web Analytics**, and select `app.exitslide.top`. Historical traffic from before the domain cutover is under `exitslide-frontend.brain-labs.workers.dev`. Traffic can take a few minutes to appear after a real visitor loads a measured page. Basic Worker request, error and CPU metrics are also available under **Workers & Pages → exitslide-frontend → Metrics**. Those include API requests and automated traffic and will differ from browser pageview counts.

## Collection boundaries

The official `https://static.cloudflareinsights.com/beacon.min.js` module loads once per document on:

- `/`: the public landing page.
- `/s/<valid-session-uuid>`: attendee pages, including an unavailable/retired Session at a valid shared link.

The script is absent on dashboard, authentication/callback, health, server-function and unknown routes. The production hostname must match exactly. Development and fixture previews are disabled by default, even when their URLs share the `workers.dev` suffix. No user-controlled strings are placed in the beacon configuration.

SPA measurement is explicitly disabled (`spa: false`) using Cloudflare's [supported configuration](https://developers.cloudflare.com/web-analytics/get-started/web-analytics-spa/). Reports represent full document visits, rather than every TanStack route change. A rating form rerender does not create another beacon. A same-document transition from an unavailable Session page to the homepage is not a new measured pageview. Avoid adding SPA tracking without rechecking the private-route boundaries.

Production responses use `Referrer-Policy: strict-origin` so subsequent navigations disclose origin-level referrers rather than private path/query values. Cloudflare receives page URL/referrer and performance information; shared Session UUIDs can therefore appear in path reports. No Session titles, slide URLs, ratings or form values are added as analytics fields. Cloudflare's [FAQ](https://developers.cloudflare.com/web-analytics/faq/) says query strings are not logged and UTM reporting/custom events are unsupported; this is not a promise that every URL value is removed before transport. Authentication pages are excluded rather than relying on query filtering. Do not put private content in public URL paths.

Available reports include pageviews/visits, top public paths, referrer hosts, countries, browsers/devices and web performance/Core Web Vitals. These are aggregate browser metrics, not reliable identified-user retention. Ad blockers may block the script and undercount visits. Geography and detailed performance metrics depend on Cloudflare's reporting and browser support.

The dashboard's PostHog **Product analytics** preference controls product telemetry, not this independent public-page measurement. No new tracking preference or visitor identifier is created by our loader. Cookies used by WorkOS authentication remain separate from analytics.

## Release, testing and future domains

Release builds enable the loader on the exact production hostname. No new Cloudflare secret is required. The following optional Vite build variables can override the defaults:

| Variable | Purpose |
| --- | --- |
| `VITE_CLOUDFLARE_WEB_ANALYTICS_ENABLED` | `false` disables release measurement; `true` explicitly enables local testing. Previews always stay disabled. |
| `VITE_CLOUDFLARE_WEB_ANALYTICS_TOKEN` | Public token from the matching Cloudflare Web Analytics site. |
| `VITE_CLOUDFLARE_WEB_ANALYTICS_HOST` | Exact permitted hostname, without protocol or path. |

When moving to a custom domain, register or update its Cloudflare Web Analytics site and update both the token and hostname together. Keep manual injection enabled in the app or switch to automatic injection, but do not run both. If a Content Security Policy is introduced, allow the official script host in `script-src` and `https://cloudflareinsights.com` in `connect-src`, following the [Cloudflare setup guide](https://developers.cloudflare.com/web-analytics/faq/).

The local analytics browser test serves a stub in place of the vendor script and uses a dummy site token. It verifies public-only insertion, configuration, one script per document, and no new browser storage from our loader; it does not certify the vendor's implementation. Other integration tests and production smoke block the beacon so automated workflows do not populate the real dataset. Unit tests cover route and build-mode boundaries. Fixture previews remain analytics-free.

After deployment, visit the production landing page and an attendee page in a normal browser. Verify a single beacon module loads, then navigate away or hide the tab so performance data can flush. In Web Analytics, check for the corresponding public path. Confirm the script is absent on the speaker dashboard. Do not infer successful ingestion solely from the presence of the script tag.
