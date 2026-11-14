# Browser verification harness

Real-browser proof that the production bundle renders — not just that HTTP
returns 200. This document describes what the harness guarantees, how to run it,
and how to read its evidence.

| Piece | File |
|---|---|
| Decision logic (pure, unit-tested) | `scripts/lib/browser-harness.mjs` |
| Logic tests (`npm run test:harness`) | `scripts/lib/browser-harness.test.mjs` |
| Browser matrix runner | `scripts/production-browser-check.mjs` |
| Local production stack (compiled app + fixture API) | `scripts/local-production-server.mjs` |
| One-command local run | `scripts/verify-local-browser.mjs` |
| CI | `.github/workflows/production-browser.yml` (jobs `local-production`, `production-live`) |

## What is asserted

For every route (`/`, `/join`, `/products`) × storage mode (`normal`,
`blocked-storage`):

| Check id | Requirement |
|---|---|
| `document-navigation` | HTTP `200`/`203`/**`304`** accepted; anything else fails. A 304 is a revalidation of a complete document — never a failure. |
| `no-uncaught-page-errors` | Zero `pageerror` events. |
| `no-uncaught-cdp-exceptions` | Zero CDP `Runtime.exceptionThrown` (throw-site frames captured via `Debugger.setPauseOnExceptions`). |
| `cache-isolation` | Zero cached **documents**, zero service-worker responses, and zero cross-case cache hits (any cached response whose URL a *previous* case already requested). Same-case memory-cache hits on a subresource are recorded, not fatal — see below. |
| `harness-isolation` | The case ran in a fresh browser context **and** with `Network.setCacheDisabled: true`. |
| `react-root-mounted` | `#root` has element children plus React `__reactContainer$`/`__reactFiber$` markers (documented fallback: root children + site chrome). |
| `route-ui` | `/` hero + header + footer; `/join` the five form controls; `/products` heading + cards + category tabs + at least one decoded product image. |
| `storage-simulation` | In `blocked-storage`, **both** `localStorage` and `sessionStorage` getters must throw (`denied`); in `normal` both must work. Asserted, not assumed. |
| `assets` | Every `/assets/*.js|css` is 200 with a JavaScript/CSS MIME type. |
| `api-traffic` | No `/api/*` response ≥ 400 during the case. |
| `api-health` | 200 JSON with `status`, `db`, `timestamp`; `EXPECT_DB_CONNECTED=1` additionally requires `status: "ok"`, `db: "connected"`. |
| `api-products` | 200 JSON, `success: true`, non-empty `data`, `count === data.length`, and per-item `_id`/`slug`/`price`/`image` shape. |
| `same-origin-requests` | No failed same-origin requests (third-party failures, e.g. Google Fonts on a network-isolated runner, are recorded but not fatal). |

## Why 304 used to fail, and what changed

The first harness reused one browser profile for all six cases. The
`normal` case warmed the HTTP cache; the `blocked-storage` case then revalidated
the cached `index.html` and Chromium answered the navigation with **304**. The
harness compared `response.status() === 200` and failed — a harness artefact, not
an application defect.

Now:

* every case gets `browser.createBrowserContext()` (own cache, own storage);
* every page gets `Network.setCacheDisabled: true` before the first navigation;
* the navigation policy accepts `200/203/304` and records
  `documentSource: "network" | "revalidated-cache"`;
* cache isolation is *asserted* per response, so no case can silently pass by
  re-using a previous case's build. Chromium cannot fully disable its in-process
  memory cache, so a duplicated in-document fetch (React StrictMode double
  effects, a `modulepreload` followed by an `import`) can still report
  `fromCache: true` for a URL that was **first requested inside that same case**.
  That is not cross-case contamination, so it is recorded in the evidence
  (`sameCaseCacheHits`) instead of failing the case — while cached documents and
  any URL first seen in an earlier case remain hard failures. `data:`/`blob:`
  resources are excluded from cache accounting entirely: they are bytes embedded
  in the document, have no HTTP cache entry and no build identity.

## Cache self-test (proof the harness itself is trustworthy)

Unless `HARNESS_SELF_TEST=0`, the runner starts a throwaway HTTP server and runs
five scenarios:

| Scenario | Expectation | Proves |
|---|---|---|
| `control-same-context-cache-enabled` | cache hit, same document nonce | the probe *can* observe caching (no false "clean" result) |
| `fresh-context-per-navigation` | fresh 200, new nonce | isolation by context works on its own |
| `cdp-cache-disabled-same-context` | fresh 200, new nonce | `Network.setCacheDisabled` defeats reuse inside one context |
| `revalidated-document-304` | `304` classified as a valid navigation | the original false failure cannot come back |
| `blocked-storage-after-normal-warm-cache` | fresh 200 + storage denied | a blocked-storage case never re-uses a normal case's document |
| `detects-pre-mount-storage-throw` | case FAILS on `no-uncaught-*` only | the harness still catches the real defect, and never blames navigation/cache for it |
| `control-page-clean-with-storage` | case PASSES | the negative control is caused by the denial, not by a broken probe |

If any scenario stops holding, the harness fails even if the six app cases pass.

## Running it

```bash
# 1. Local production build (hermetic; no database, no network egress)
npm run build
npm install --no-save puppeteer@25.17.0     # once, downloads Chromium
npm run verify:browser:local                # → browser-report/

# 2. Live deployment (real API + real DB)
PRODUCTION_URL=https://dxnnadz.vercel.app \
EXPECT_DB_CONNECTED=1 HARNESS_SELF_TEST=0 \
node scripts/production-browser-check.mjs
```

Environment knobs: `BROWSER_ROUTES`, `BROWSER_MODES`, `BROWSER_REPORT_DIR`,
`BROWSER_TIMEOUT_MS`, `BROWSER_MOUNT_TIMEOUT_MS`, `EXPECT_DB_CONNECTED`,
`HARNESS_SELF_TEST`, `PUPPETEER_EXECUTABLE_PATH`.

## Evidence produced

`browser-report/` contains:

* `production-browser-report.json` — every case, every check, cache counters,
  document status/source, exceptions with throw-site frames, screenshots;
* `cases/<mode>_<route>.json` — per-case detail;
* `harness-selftest.json` — the five cache scenarios;
* `check-run-summary.md` / `check-run-text.json` — published as a GitHub check
  run (artifacts are not reachable from restricted sandboxes).

## Local fixture vs. live production

`scripts/local-production-server.mjs` serves the **real** compiled frontend and
the **real** compiled Express app (security headers, static asset caching, SPA
fallback, 404 rules). Only the *data layer* is a fixture: `/api/products`,
`/api/categories`, `/api/settings/public`, `/api/offers`, `/api/reviews`,
`/api/health` are answered from a deterministic in-memory catalog that mirrors
the production response contract, labelled `db: "fixture"`.

Reason: a hermetic runner has no Mongo and no egress. Without the fixture, the
catalogue renders zero cards and the harness would report an application failure
that is really an environment failure — the same class of false result this work
removes. Live API/DB truth is verified separately by the `production-live` job
with `EXPECT_DB_CONNECTED=1`.
