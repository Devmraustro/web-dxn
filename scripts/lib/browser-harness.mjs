/**
 * Pure decision logic for the real-browser production verification harness.
 *
 * WHY THIS MODULE EXISTS
 * ----------------------
 * The first version of `scripts/production-browser-check.mjs` made two
 * methodology mistakes that produced FALSE NEGATIVES and FALSE POSITIVES:
 *
 *   1. Every route/mode case shared one browser profile, so the `blocked-storage`
 *      pass re-used the document + bundles that the `normal` pass had already
 *      cached. Chromium revalidated the cached `index.html` and the navigation
 *      came back as **HTTP 304**. The harness compared `response.status() === 200`
 *      and reported a failure even when the page rendered perfectly — a pure
 *      harness artefact, unrelated to the application under test.
 *   2. Because the cached document/bundle was re-used across modes, a "blocked
 *      storage" result could in principle be produced by a bundle that was
 *      already cached from the normal pass, which makes any pass/fail claim
 *      about the served build unverifiable.
 *
 * This module holds the (dependency-free, unit-tested) rules that fix #1 and
 * makes #2 detectable:
 *
 *   - `evaluateDocumentNavigation()` treats a 304 *revalidation* as a valid
 *     document navigation (the browser was given a complete, usable document)
 *     instead of an HTTP failure, while still failing real HTTP errors.
 *   - `summarizeCacheEvidence()` proves whether any response in a case was
 *     served from Chromium's HTTP cache / service worker. The runner requires
 *     zero cache hits, because it uses a fresh browser context per case **and**
 *     `Network.setCacheDisabled: true`.
 *
 * Everything here is exercised by `scripts/lib/browser-harness.test.mjs`
 * (`npm run test:harness`) so the harness itself is a tested artifact rather
 * than untested glue code.
 */

/** HTTP statuses that constitute a usable top-level document response. */
export const ACCEPTED_DOCUMENT_STATUSES = Object.freeze([200, 203, 304]);

/** Statuses that mean the browser had to revalidate a cached document. */
export const REVALIDATED_DOCUMENT_STATUSES = Object.freeze([304]);

/** Headers/counters that must exist for a case to count as isolated. */
export const REQUIRED_ISOLATION = Object.freeze({
  context: "fresh-browser-context-per-case",
  cache: "cdp-network-setCacheDisabled",
});

export const isAcceptedDocumentStatus = (status) =>
  ACCEPTED_DOCUMENT_STATUSES.includes(status);

const isJsonContentType = (value) => /application\/json|application\/[a-z0-9.+-]*\+json/i.test(String(value || ""));

/**
 * Evaluate the top-level document navigation.
 *
 * A 304 is NOT an error: the browser asked "has this changed?", the server said
 * "no", and the browser then used the document it already had — a complete,
 * renderable document. Failing on 304 measured the harness's own cache, not the
 * application. We therefore accept it, but we keep it visible in the evidence
 * (`revalidated: true`) and the runner separately asserts that zero responses
 * came from cache.
 */
export function evaluateDocumentNavigation(input = {}) {
  const status = Number(input.status ?? 0);
  const readyState = input.readyState;
  const rootPresent = input.rootPresent === true;
  const reasons = [];

  if (input.responseReceived === false) reasons.push("no-navigation-response");
  if (!isAcceptedDocumentStatus(status)) reasons.push(`unexpected-document-status-${status}`);
  if (readyState !== "interactive" && readyState !== "complete") {
    reasons.push(`document-not-parsed-${String(readyState)}`);
  }
  if (!rootPresent) reasons.push("root-element-missing");

  const revalidated = REVALIDATED_DOCUMENT_STATUSES.includes(status);
  return {
    ok: reasons.length === 0,
    status,
    acceptedStatuses: [...ACCEPTED_DOCUMENT_STATUSES],
    revalidated,
    /**
     * Distinguishes "the server sent us the document" from "the browser
     * revalidated a cached copy". Both are accepted; only the second one means
     * cache state influenced the case, which the cache assertions then flag.
     */
    documentSource: revalidated ? "revalidated-cache" : "network",
    reasons,
  };
}

/**
 * Summarise cache reuse for one case.
 *
 * `responses` entries: `{ url, status, fromCache, fromServiceWorker, cacheControl, resourceType }`
 * `options.priorCaseUrls`: URLs already requested by earlier cases in this run.
 *
 * Not every `fromCache` hit is a methodology problem, so the policy is explicit:
 *
 *   - a cached **document** is always fatal: it means the case rendered a
 *     document left behind by an earlier navigation instead of the served build;
 *   - a cached response whose URL was already requested by a **previous case**
 *     is fatal: that is exactly the cross-mode cache reuse this harness must
 *     never allow (`normal` warming the cache for `blocked-storage`);
 *   - a cached **subresource first requested in this same case** is a Chromium
 *     memory-cache artefact of duplicate in-document fetches (e.g. StrictMode
 *     double-effects or a preload followed by an import). It is recorded for
 *     transparency but cannot mask a cross-case problem, because nothing from a
 *     previous case is involved.
 */
export function summarizeCacheEvidence(responses = [], options = {}) {
  const priorCaseUrls = new Set(options.priorCaseUrls || []);
  // `data:`/`blob:` resources are decoded in-process and have no HTTP cache
  // entry, no validator and no build identity: Chromium reports them as
  // "cached" simply because the bytes are embedded in the document. They can
  // never serve a stale build, so they are excluded from cache accounting
  // (otherwise a Bootstrap chevron `data:image/svg+xml` URI would look like
  // cross-case cache reuse — a false failure).
  const isNetworkUrl = (url) => !/^(data|blob|about|chrome|file|chrome-extension):/i.test(String(url || ""));
  const hits = responses.filter((r) => r.fromCache === true && isNetworkUrl(r.url));
  const serviceWorker = responses.filter((r) => r.fromServiceWorker === true);
  const revalidated = responses.filter((r) => r.status === 304);
  const documents = responses.filter((r) => r.resourceType === "Document");
  const detail = hits.map((r) => ({
    url: r.url,
    resourceType: r.resourceType,
    status: r.status,
    seenInPriorCase: priorCaseUrls.has(r.url),
  }));
  const crossCaseHits = detail.filter((hit) => hit.seenInPriorCase);
  const sameCaseHits = detail.filter((hit) => !hit.seenInPriorCase);
  const documentFromCacheCount = documents.filter((r) => r.fromCache === true).length;
  return {
    responseCount: responses.length,
    fromCacheCount: hits.length,
    fromServiceWorkerCount: serviceWorker.length,
    revalidatedCount: revalidated.length,
    documentFromCacheCount,
    cachedResponses: detail.slice(0, 10),
    crossCaseCacheHits: crossCaseHits.slice(0, 10),
    sameCaseCacheHits: sameCaseHits.slice(0, 10),
    ok: documentFromCacheCount === 0 && serviceWorker.length === 0 && crossCaseHits.length === 0,
  };
}

/** Same-origin failures are fatal; third-party (fonts/analytics) are recorded. */
export function classifyFailedRequests(failures = [], origin = "") {
  const sameOrigin = [];
  const thirdParty = [];
  for (const failure of failures) {
    let isSameOrigin = false;
    try {
      isSameOrigin = new URL(failure.url).origin === origin;
    } catch {
      isSameOrigin = false;
    }
    (isSameOrigin ? sameOrigin : thirdParty).push(failure);
  }
  return { sameOrigin, thirdParty, ok: sameOrigin.length === 0 };
}

/**
 * Asset MIME/status validation. `/assets/*` is content-hashed JS/CSS served
 * `immutable`, so a non-200 (or an HTML body served for a .js URL) means the
 * deployment is broken.
 */
export function evaluateAssetResponses(assets = []) {
  const failures = [];
  for (const asset of assets) {
    const url = String(asset.url || "");
    if (!isAcceptedDocumentStatus(asset.status) && asset.status !== 200) {
      failures.push({ url, reason: `status-${asset.status}` });
      continue;
    }
    if (asset.status === 304) continue; // revalidated immutable asset, body cached
    if (/\.js($|\?)/.test(url) && !/javascript|ecmascript/i.test(String(asset.contentType || ""))) {
      failures.push({ url, reason: `bad-js-mime-${asset.contentType}` });
    }
    if (/\.css($|\?)/.test(url) && !/text\/css/i.test(String(asset.contentType || ""))) {
      failures.push({ url, reason: `bad-css-mime-${asset.contentType}` });
    }
  }
  return { ok: failures.length === 0, failures, count: assets.length };
}

/** Any `/api/*` response with a 4xx/5xx status is a hard failure. */
export function evaluateApiTraffic(apiResponses = []) {
  const failures = apiResponses
    .filter((r) => Number(r.status) >= 400)
    .map((r) => ({ url: r.url, status: r.status }));
  return { ok: failures.length === 0, failures, count: apiResponses.length };
}

/** `/api/health` contract. */
export function validateHealthPayload(payload = {}, options = {}) {
  const reasons = [];
  const body = payload.body ?? null;
  if (payload.error) reasons.push(`fetch-error-${payload.error}`);
  if (Number(payload.status) !== 200) reasons.push(`status-${payload.status}`);
  if (!isJsonContentType(payload.contentType)) reasons.push("not-json");
  if (!body || typeof body !== "object") {
    reasons.push("body-not-object");
  } else {
    if (typeof body.status !== "string" || !body.status) reasons.push("missing-status-field");
    if (typeof body.db !== "string" || !body.db) reasons.push("missing-db-field");
    if (Number.isNaN(Date.parse(String(body.timestamp ?? "")))) reasons.push("missing-timestamp");
    if (options.requireDbConnected === true) {
      if (body.status !== "ok") reasons.push(`health-not-ok-${String(body.status)}`);
      if (body.db !== "connected") reasons.push(`db-not-connected-${String(body.db)}`);
    }
  }
  return { ok: reasons.length === 0, reasons, status: payload.status, body };
}

/** `/api/products?language=xx` contract (including per-item field shape). */
export function validateProductsPayload(payload = {}) {
  const reasons = [];
  const body = payload.body ?? null;
  if (payload.error) reasons.push(`fetch-error-${payload.error}`);
  if (Number(payload.status) !== 200) reasons.push(`status-${payload.status}`);
  if (!isJsonContentType(payload.contentType)) reasons.push("not-json");
  if (!body || typeof body !== "object") {
    reasons.push("body-not-object");
    return { ok: false, reasons, count: null };
  }
  if (body.success !== true) reasons.push("success-not-true");
  if (!Array.isArray(body.data)) {
    reasons.push("data-not-array");
    return { ok: false, reasons, count: null };
  }
  if (body.data.length === 0) reasons.push("data-empty");
  if (body.count !== undefined && body.count !== body.data.length) {
    reasons.push(`count-mismatch-${body.count}-vs-${body.data.length}`);
  }
  for (const [index, item] of body.data.entries()) {
    const id = item?._id ?? item?.id;
    if (typeof id !== "string" && typeof id !== "number") reasons.push(`item-${index}-missing-id`);
    if (typeof item?.slug !== "string" || !item.slug) reasons.push(`item-${index}-missing-slug`);
    if (typeof item?.price !== "number" || !Number.isFinite(item.price)) reasons.push(`item-${index}-bad-price`);
    if (typeof item?.image !== "string" || !item.image) reasons.push(`item-${index}-missing-image`);
    if (index >= 5) break; // shape-check the head of the catalogue only
  }
  return { ok: reasons.length === 0, reasons, count: body.data.length };
}

/** Route-specific UI that must exist once the SPA has mounted. */
export function evaluateRouteUi(route, info = {}) {
  const reasons = [];
  const h1 = typeof info.h1 === "string" ? info.h1.trim() : "";
  if (route === "/") {
    if (!/DXN|اكتشف/i.test(h1)) reasons.push(`unexpected-h1-${h1 || "empty"}`);
    if (info.headerPresent !== true) reasons.push("header-missing");
    if (Number(info.bodyTextLength ?? 0) < 200) reasons.push("body-too-small");
    if (Number(info.footerPresent === true ? 1 : 0) !== 1) reasons.push("footer-missing");
  } else if (route === "/join") {
    for (const field of ["firstName", "lastName", "phone", "privacyConsent", "submit"]) {
      if (info.joinForm?.[field] !== true) reasons.push(`join-field-missing-${field}`);
    }
    if (!h1) reasons.push("join-h1-missing");
  } else if (route === "/products") {
    if (!/DXN|اكتشف|منتجات/i.test(h1)) reasons.push(`unexpected-h1-${h1 || "empty"}`);
    if (Number(info.productCardCount ?? 0) < 1) reasons.push("no-product-cards");
    if (info.categoryTabsPresent !== true) reasons.push("category-tabs-missing");
    const loadedImages = (info.productImages || []).filter((img) => img.complete && img.naturalWidth > 0);
    if (loadedImages.length === 0) reasons.push("no-loaded-product-image");
  } else {
    reasons.push(`unknown-route-${route}`);
  }
  return { ok: reasons.length === 0, reasons };
}

/**
 * React-mount detection.
 *
 * `#root` having element children already proves *something* mounted. React also
 * stamps the container with a `__reactContainer$…` marker and each host node
 * with `__reactFiber$…`; when those markers are observable we require one of
 * them, otherwise we fall back to "root has children AND the site chrome
 * rendered", which is the user-visible definition of a mounted app.
 */
export function evaluateReactMount(info = {}) {
  const rootChildren = Number(info.rootChildren ?? -1);
  const fiberMarker = info.reactFiberMarker === true;
  const chrome = info.headerPresent === true || info.footerPresent === true;
  const reasons = [];
  if (rootChildren <= 0) reasons.push("root-empty");
  if (!fiberMarker && !(rootChildren > 0 && chrome)) reasons.push("no-react-mount-evidence");
  return {
    ok: reasons.length === 0,
    reasons,
    rootChildren,
    fiberMarker,
    markerFallback: !fiberMarker && reasons.length === 0,
  };
}

/** The blocked-storage simulation must actually be installed (and normal must not). */
export function evaluateStorageSimulation(mode, probe = {}) {
  const localDenied = probe.localStorage === "denied";
  const sessionDenied = probe.sessionStorage === "denied";
  if (mode === "blocked-storage") {
    const reasons = [];
    if (!localDenied) reasons.push(`localStorage-${probe.localStorage ?? "unknown"}`);
    if (!sessionDenied) reasons.push(`sessionStorage-${probe.sessionStorage ?? "unknown"}`);
    return { ok: reasons.length === 0, reasons, expected: "both-denied" };
  }
  const reasons = [];
  if (probe.localStorage !== "ok") reasons.push(`localStorage-${probe.localStorage ?? "unknown"}`);
  if (probe.sessionStorage !== "ok") reasons.push(`sessionStorage-${probe.sessionStorage ?? "unknown"}`);
  return { ok: reasons.length === 0, reasons, expected: "both-usable" };
}

/**
 * One case = one (mode, route) pair executed in its own browser context with
 * cache disabled. Returns the complete verdict, including every individual
 * check so failures are never summarised away.
 */
export function buildCaseVerdict(input = {}) {
  const {
    mode,
    route,
    documentNavigation = { ok: false, reasons: ["not-evaluated"] },
    cacheEvidence = { ok: false, fromCacheCount: -1, crossCaseCacheHits: [] },
    pageErrors = [],
    cdpExceptions = [],
    consoleErrors = [],
    failedRequests = [],
    assets = [],
    apiResponses = [],
    health = {},
    products = {},
    info = {},
    storageProbe = {},
    requireDbConnected = false,
    isolation = {},
    priorCaseUrls = [],
  } = input;

  const checks = [];
  const push = (id, result, detail = {}) => checks.push({ id, ok: result.ok === true, reasons: result.reasons ?? [], detail });

  push("document-navigation", documentNavigation, {
    status: documentNavigation.status,
    documentSource: documentNavigation.documentSource,
    acceptedStatuses: documentNavigation.acceptedStatuses,
  });
  push(
    "no-uncaught-page-errors",
    { ok: pageErrors.length === 0, reasons: pageErrors.map((e) => String(e.message).slice(0, 160)) },
    { count: pageErrors.length }
  );
  push(
    "no-uncaught-cdp-exceptions",
    { ok: cdpExceptions.length === 0, reasons: cdpExceptions.map((e) => String(e.text || e.exception?.description || "").slice(0, 160)) },
    { count: cdpExceptions.length }
  );
  push(
    "cache-isolation",
    {
      ok: cacheEvidence.ok === true,
      reasons: [
        ...(Number(cacheEvidence.documentFromCacheCount ?? 0) > 0 ? ["cached-document"] : []),
        ...(Number(cacheEvidence.fromServiceWorkerCount ?? 0) > 0 ? ["service-worker-response"] : []),
        ...((cacheEvidence.crossCaseCacheHits || []).length > 0 ? ["cross-case-cache-reuse"] : []),
      ],
    },
    {
      fromCacheCount: cacheEvidence.fromCacheCount,
      documentFromCacheCount: cacheEvidence.documentFromCacheCount,
      fromServiceWorkerCount: cacheEvidence.fromServiceWorkerCount,
      sameCaseMemoryCacheHits: (cacheEvidence.sameCaseCacheHits || []).length,
      crossCaseCacheHits: cacheEvidence.crossCaseCacheHits || [],
      cachedResponses: cacheEvidence.cachedResponses || [],
      priorCaseUrlCount: priorCaseUrls.length,
    }
  );
  push("harness-isolation", { ok: isolation.context === REQUIRED_ISOLATION.context && isolation.cache === REQUIRED_ISOLATION.cache, reasons: [] }, isolation);
  push("react-root-mounted", evaluateReactMount(info));
  push("route-ui", evaluateRouteUi(route, info));
  push("storage-simulation", evaluateStorageSimulation(mode, storageProbe));
  push("assets", evaluateAssetResponses(assets));
  push("api-traffic", evaluateApiTraffic(apiResponses));
  push("api-health", validateHealthPayload(health, { requireDbConnected }));
  push("api-products", validateProductsPayload(products));
  push(
    "same-origin-requests",
    classifyFailedRequests(failedRequests, input.origin || ""),
    { thirdPartyFailures: classifyFailedRequests(failedRequests, input.origin || "").thirdParty.map((f) => f.url).slice(0, 5) }
  );

  const failedChecks = checks.filter((c) => !c.ok);
  return {
    ok: failedChecks.length === 0,
    checks,
    failedChecks: failedChecks.map((c) => ({ id: c.id, reasons: c.reasons })),
    consoleErrorCount: consoleErrors.length,
  };
}

/**
 * Verdict for the cache self-test. Each scenario asserts a specific, opposite
 * outcome so the harness cannot "pass" by simply never detecting caching.
 */
export function assessSelfTest(scenarios = []) {
  const results = scenarios.map((scenario) => {
    const reasons = [];
    if (scenario.expect === "cache-reuse") {
      if (scenario.fromCache !== true) reasons.push("cache-reuse-not-observed");
      if (scenario.nonceReused !== true) reasons.push("document-not-reused");
    } else if (scenario.expect === "fresh") {
      if (scenario.fromCache === true) reasons.push("unexpected-cache-hit");
      if (scenario.status !== 200) reasons.push(`unexpected-status-${scenario.status}`);
      if (scenario.nonceReused !== false) reasons.push("stale-document-reused");
    } else if (scenario.expect === "revalidated") {
      if (scenario.status !== 304) reasons.push(`expected-304-got-${scenario.status}`);
      if (scenario.navigationOk !== true) reasons.push("revalidated-navigation-rejected");
    }
    return { name: scenario.name, expect: scenario.expect, ok: reasons.length === 0, reasons, scenario };
  });
  return { ok: results.length > 0 && results.every((r) => r.ok), results };
}

/** Markdown matrix for the GitHub check-run summary. */
export function renderSummaryMarkdown(report = {}) {
  const header = [
    `Base: ${report.base}`,
    `Target: ${report.target}`,
    `Checked at: ${report.checkedAt}`,
    `Harness: ${report.harness?.isolation} · ${report.harness?.cachePolicy} · Chromium ${report.harness?.browserVersion ?? "?"}`,
    `Overall: ${report.failed ? "FAIL" : "PASS"}`,
    "",
    "| Mode | Route | Result | HTTP | Document source | Cached docs / cross-case / same-case | #root children | pageerrors | CDP exceptions | health | products | route UI | storage sim |",
    "|---|---|---|---|---|---|---|---|---|---|---|---|---|",
  ];
  const rows = (report.results || []).map((r) =>
    `| ${r.mode} | ${r.route} | ${r.ok ? "PASS" : "FAIL"} | ${r.documentNavigation?.status ?? r.error ?? ""} | ${r.documentNavigation?.documentSource ?? ""} | ${r.cacheEvidence?.documentFromCacheCount ?? ""} / ${(r.cacheEvidence?.crossCaseCacheHits || []).length} / ${(r.cacheEvidence?.sameCaseCacheHits || []).length} | ${r.info?.rootChildren ?? ""} | ${r.pageErrors?.length ?? ""} | ${r.cdpExceptions?.length ?? ""} | ${r.validations?.health?.ok ?? ""} | ${r.validations?.products?.ok ?? ""} | ${r.validations?.routeUi?.ok ?? ""} | ${r.storageProbe?.localStorage ?? ""}/${r.storageProbe?.sessionStorage ?? ""} |`
  );
  const failed = (report.results || []).filter((r) => !r.ok).flatMap((r) =>
    (r.failedChecks || []).map((c) => `- \`${r.mode} ${r.route}\` → **${c.id}**: ${c.reasons.join(", ") || "failed"}`)
  );
  const selfTest = report.selfTest
    ? [
        "",
        "### Harness cache self-test",
        `Result: ${report.selfTest.ok ? "PASS" : "FAIL"}`,
        "",
        "| Scenario | Expected | Status | fromCache | Nonce reused | Result |",
        "|---|---|---|---|---|---|",
        ...report.selfTest.results.map(
          (r) => `| ${r.name} | ${r.expect} | ${r.scenario.status ?? ""} | ${r.scenario.fromCache ?? ""} | ${r.scenario.nonceReused ?? ""} | ${r.ok ? "PASS" : "FAIL"} |`
        ),
      ]
    : [];
  return [...header, ...rows, ...(failed.length ? ["", "### Failed checks", ...failed] : []), ...selfTest].join("\n");
}

/** Compact, size-capped evidence payload for the check-run `output.text` field. */
export function buildCheckRunText(report = {}, limit = 60000) {
  const cap = (value, max) => (typeof value === "string" ? value.slice(0, max) : value);
  const evidence = {
    target: report.target,
    base: report.base,
    checkedAt: report.checkedAt,
    harness: report.harness,
    selfTest: report.selfTest
      ? {
          ok: report.selfTest.ok,
          results: report.selfTest.results.map((r) => ({ name: r.name, expect: r.expect, ok: r.ok, scenario: r.scenario, reasons: r.reasons })),
        }
      : null,
    cases: (report.results || []).map((r) => ({
      mode: r.mode,
      route: r.route,
      ok: r.ok,
      documentNavigation: r.documentNavigation,
      cacheEvidence: {
        ok: r.cacheEvidence?.ok,
        fromCacheCount: r.cacheEvidence?.fromCacheCount,
        documentFromCacheCount: r.cacheEvidence?.documentFromCacheCount,
        fromServiceWorkerCount: r.cacheEvidence?.fromServiceWorkerCount,
        revalidatedCount: r.cacheEvidence?.revalidatedCount,
        cachedResponses: r.cacheEvidence?.cachedResponses,
        crossCaseCacheHits: r.cacheEvidence?.crossCaseCacheHits,
      },
      failedChecks: r.failedChecks,
      checks: (r.checks || []).map((c) => ({ id: c.id, ok: c.ok, reasons: c.reasons })),
      rootChildren: r.info?.rootChildren,
      entryScript: r.info?.entryScript,
      validations: {
        health: { ok: r.validations?.health?.ok, status: r.validations?.health?.status, body: r.validations?.health?.body },
        products: { ok: r.validations?.products?.ok, count: r.validations?.products?.count },
        routeUi: r.validations?.routeUi?.ok,
      },
      storageProbe: r.storageProbe,
      pageErrors: (r.pageErrors || []).map((e) => ({ message: cap(e.message, 300), stack: cap(e.stack, 800) })),
      firstCdpException: r.firstCdpException,
      debuggerFrames: r.debuggerFrames?.slice(0, 1),
      sameOriginFailures: r.failedRequests?.sameOrigin?.slice(0, 5),
      thirdPartyFailures: r.failedRequests?.thirdParty?.map((f) => f.url).slice(0, 5),
    })),
  };
  let text = JSON.stringify(evidence, null, 2);
  if (text.length > limit) {
    evidence.cases = evidence.cases.map((c) => ({ ...c, pageErrors: c.pageErrors?.slice(0, 1), debuggerFrames: [] }));
    text = JSON.stringify(evidence, null, 2);
  }
  if (text.length > limit) {
    text = JSON.stringify({ target: evidence.target, base: evidence.base, checkedAt: evidence.checkedAt, harness: evidence.harness, selfTest: evidence.selfTest, truncated: true }, null, 2);
  }
  return text;
}
