/**
 * Unit tests for the browser-verification decision logic.
 *
 * Run with `npm run test:harness` (node:test — no browser, no network).
 *
 * These tests pin the two methodology fixes required of the harness:
 *   1. an HTTP 304 revalidation of a valid document is a PASS, not a failure;
 *   2. real cache reuse in a case is a hard FAIL, so isolation can never be
 *      silently skipped.
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  ACCEPTED_DOCUMENT_STATUSES,
  assessSelfTest,
  buildCaseVerdict,
  buildCheckRunText,
  classifyFailedRequests,
  evaluateAssetResponses,
  evaluateDocumentNavigation,
  evaluateReactMount,
  evaluateRouteUi,
  evaluateStorageSimulation,
  renderSummaryMarkdown,
  summarizeCacheEvidence,
  validateHealthPayload,
  validateProductsPayload,
} from "./browser-harness.mjs";

const okDom = { readyState: "complete", rootPresent: true };

const healthyHealth = {
  status: 200,
  contentType: "application/json; charset=utf-8",
  body: { status: "ok", db: "connected", dbConfigured: true, timestamp: "2026-11-14T00:00:00.000Z" },
};

const healthyProducts = {
  status: 200,
  contentType: "application/json; charset=utf-8",
  body: {
    success: true,
    count: 2,
    data: [
      { _id: "1", slug: "ganozhi", price: 4500, image: "/img/a.jpg" },
      { _id: "2", slug: "lingzhi", price: 7200, image: "/img/b.jpg" },
    ],
  },
};

const validInfo = (route) => ({
  readyState: "complete",
  rootPresent: true,
  rootChildren: 5,
  reactFiberMarker: true,
  headerPresent: true,
  footerPresent: true,
  bodyTextLength: 900,
  h1: route === "/products" ? "اكتشف تشكيلة منتجات DXN" : "اكتشف عالم DXN",
  joinForm:
    route === "/join"
      ? { firstName: true, lastName: true, phone: true, privacyConsent: true, submit: true }
      : undefined,
  productCardCount: route === "/products" ? 4 : 0,
  categoryTabsPresent: route === "/products",
  productImages: route === "/products" ? [{ complete: true, naturalWidth: 300 }] : [],
});

const validCase = (overrides = {}) => {
  const route = overrides.route ?? "/";
  const mode = overrides.mode ?? "normal";
  return {
    mode,
    route,
    origin: "http://127.0.0.1:4173",
    documentNavigation: evaluateDocumentNavigation({ status: 200, responseReceived: true, readyState: "complete", rootPresent: true }),
    cacheEvidence: summarizeCacheEvidence([{ url: "http://127.0.0.1:4173/", status: 200, fromCache: false, resourceType: "Document" }]),
    pageErrors: [],
    cdpExceptions: [],
    consoleErrors: [],
    failedRequests: [],
    assets: [{ url: "http://127.0.0.1:4173/assets/index-abc.js", status: 200, contentType: "text/javascript" }],
    apiResponses: [{ url: "http://127.0.0.1:4173/api/products?language=ar", status: 200 }],
    health: healthyHealth,
    products: healthyProducts,
    info: { ...validInfo(route), headerPresent: true },
    storageProbe: mode === "blocked-storage" ? { localStorage: "denied", sessionStorage: "denied" } : { localStorage: "ok", sessionStorage: "ok" },
    isolation: { context: "fresh-browser-context-per-case", cache: "cdp-network-setCacheDisabled" },
    requireDbConnected: true,
    ...overrides,
  };
};

test("accepted document statuses are 200/203/304", () => {
  assert.deepEqual([...ACCEPTED_DOCUMENT_STATUSES].sort(), [200, 203, 304]);
});

test("a 304 revalidation with a parseable document is accepted (regression: cache-related false failure)", () => {
  const verdict = evaluateDocumentNavigation({ status: 304, responseReceived: true, ...okDom });
  assert.equal(verdict.ok, true, verdict.reasons.join(","));
  assert.equal(verdict.revalidated, true);
  assert.equal(verdict.documentSource, "revalidated-cache");
});

test("200 document navigation is accepted and marked as network-served", () => {
  const verdict = evaluateDocumentNavigation({ status: 200, responseReceived: true, ...okDom });
  assert.equal(verdict.ok, true);
  assert.equal(verdict.revalidated, false);
  assert.equal(verdict.documentSource, "network");
});

test("real HTTP failures still fail", () => {
  for (const status of [0, 404, 500, 503]) {
    const verdict = evaluateDocumentNavigation({ status, responseReceived: status !== 0, ...okDom });
    assert.equal(verdict.ok, false, `status ${status} must fail`);
  }
});

test("a document that was not parsed or has no #root fails", () => {
  assert.equal(evaluateDocumentNavigation({ status: 200, responseReceived: true, readyState: "loading", rootPresent: true }).ok, false);
  assert.equal(evaluateDocumentNavigation({ status: 200, responseReceived: true, readyState: "complete", rootPresent: false }).ok, false);
});

test("cache evidence separates fatal document/cross-case reuse from same-case memory-cache hits", () => {
  const clean = summarizeCacheEvidence(
    [
      { url: "/a.js", status: 200, fromCache: false },
      { url: "/", status: 200, fromCache: false, resourceType: "Document" },
    ],
    { priorCaseUrls: ["/"] }
  );
  assert.equal(clean.ok, true);
  assert.equal(clean.fromCacheCount, 0);

  // A cached document is always fatal: the case rendered a stale document.
  const cachedDocument = summarizeCacheEvidence([{ url: "/", status: 200, fromCache: true, resourceType: "Document" }]);
  assert.equal(cachedDocument.ok, false);
  assert.equal(cachedDocument.documentFromCacheCount, 1);

  // A cached subresource that was first requested in THIS case is a Chromium
  // memory-cache artefact of a duplicated in-document fetch; it must not be
  // reported as a harness isolation failure, but it stays in the evidence.
  const sameCase = summarizeCacheEvidence([{ url: "/api/settings/public", status: 200, fromCache: true, resourceType: "Fetch" }], {
    priorCaseUrls: ["/", "/assets/index-abc.js"],
  });
  assert.equal(sameCase.ok, true);
  assert.equal(sameCase.fromCacheCount, 1);
  assert.equal(sameCase.sameCaseCacheHits.length, 1);
  assert.equal(sameCase.crossCaseCacheHits.length, 0);

  // Re-using anything that a PREVIOUS case already fetched is the exact defect
  // this harness exists to prevent.
  const crossCase = summarizeCacheEvidence([{ url: "/assets/index-abc.js", status: 200, fromCache: true }], {
    priorCaseUrls: ["/", "/assets/index-abc.js"],
  });
  assert.equal(crossCase.ok, false);
  assert.equal(crossCase.crossCaseCacheHits.length, 1);
  assert.equal(crossCase.crossCaseCacheHits[0].seenInPriorCase, true);

  const serviceWorker = summarizeCacheEvidence([{ url: "/", status: 200, fromServiceWorker: true, resourceType: "Document" }]);
  assert.equal(serviceWorker.ok, false);
  assert.equal(serviceWorker.fromServiceWorkerCount, 1);
});

test("third-party request failures are recorded but only same-origin failures fail the case", () => {
  const failures = [
    { url: "http://127.0.0.1:4173/assets/missing.js", error: "net::ERR_ABORTED" },
    { url: "https://fonts.googleapis.com/css2?family=Tajawal", error: "net::ERR_CONNECTION_RESET" },
  ];
  const result = classifyFailedRequests(failures, "http://127.0.0.1:4173");
  assert.equal(result.ok, false);
  assert.equal(result.sameOrigin.length, 1);
  assert.equal(result.thirdParty.length, 1);

  const onlyThirdParty = classifyFailedRequests([failures[1]], "http://127.0.0.1:4173");
  assert.equal(onlyThirdParty.ok, true);
});

test("assets must be served with JavaScript/CSS MIME types", () => {
  assert.equal(evaluateAssetResponses([{ url: "/assets/index-abc.js", status: 200, contentType: "text/html" }]).ok, false);
  assert.equal(evaluateAssetResponses([{ url: "/assets/index-abc.js", status: 200, contentType: "application/javascript" }]).ok, true);
  assert.equal(evaluateAssetResponses([{ url: "/assets/index-abc.css", status: 200, contentType: "text/css" }]).ok, true);
  assert.equal(evaluateAssetResponses([{ url: "/assets/index-abc.js", status: 404, contentType: "text/html" }]).ok, false);
});

test("health contract: JSON, status field, timestamp, and DB connected when required", () => {
  assert.equal(validateHealthPayload(healthyHealth).ok, true);

  const degraded = { ...healthyHealth, body: { ...healthyHealth.body, status: "degraded", db: "disconnected" } };
  assert.equal(validateHealthPayload(degraded).ok, true, "degraded is a valid contract response");
  assert.equal(validateHealthPayload(degraded, { requireDbConnected: true }).ok, false);
  assert.equal(validateHealthPayload({ ...healthyHealth, contentType: "text/html" }).ok, false);
  assert.equal(validateHealthPayload({ ...healthyHealth, body: { status: "ok" } }).ok, false, "missing db/timestamp");
});

test("products contract validates data array, count and item shape", () => {
  assert.equal(validateProductsPayload(healthyProducts).ok, true);
  assert.equal(validateProductsPayload({ ...healthyProducts, body: { success: true, count: 0, data: [] } }).ok, false);
  assert.equal(
    validateProductsPayload({ ...healthyProducts, body: { success: true, count: 1, data: [{ _id: "1", slug: "x", price: "9.99", image: "" }] } }).ok,
    false
  );
  assert.equal(validateProductsPayload({ ...healthyProducts, body: { success: true, count: 3, data: healthyProducts.body.data } }).ok, false);
});

test("route UI expectations are route-specific", () => {
  assert.equal(evaluateRouteUi("/", validInfo("/")).ok, true);
  assert.equal(evaluateRouteUi("/join", validInfo("/join")).ok, true);
  assert.equal(evaluateRouteUi("/products", validInfo("/products")).ok, true);
  assert.equal(evaluateRouteUi("/join", { ...validInfo("/join"), joinForm: { firstName: true } }).ok, false);
  assert.equal(evaluateRouteUi("/products", { ...validInfo("/products"), productCardCount: 0 }).ok, false);
  assert.equal(evaluateRouteUi("/products", { ...validInfo("/products"), productImages: [{ complete: true, naturalWidth: 0 }] }).ok, false);
  assert.equal(evaluateRouteUi("/", { ...validInfo("/"), h1: "Something else" }).ok, false);
});

test("react mount detection prefers fiber markers and allows a documented fallback", () => {
  assert.equal(evaluateReactMount({ rootChildren: 5, reactFiberMarker: true }).ok, true);
  const fallback = evaluateReactMount({ rootChildren: 5, reactFiberMarker: false, headerPresent: true });
  assert.equal(fallback.ok, true);
  assert.equal(fallback.markerFallback, true);
  assert.equal(evaluateReactMount({ rootChildren: 0, reactFiberMarker: false, headerPresent: true }).ok, false);
  assert.equal(evaluateReactMount({ rootChildren: 3, reactFiberMarker: false, headerPresent: false, footerPresent: false }).ok, false);
});

test("storage simulation is asserted in both directions", () => {
  assert.equal(evaluateStorageSimulation("blocked-storage", { localStorage: "denied", sessionStorage: "denied" }).ok, true);
  assert.equal(evaluateStorageSimulation("blocked-storage", { localStorage: "ok", sessionStorage: "denied" }).ok, false);
  assert.equal(evaluateStorageSimulation("normal", { localStorage: "ok", sessionStorage: "ok" }).ok, true);
  assert.equal(evaluateStorageSimulation("normal", { localStorage: "denied", sessionStorage: "ok" }).ok, false);
});

test("a fully valid case passes every check", () => {
  for (const mode of ["normal", "blocked-storage"]) {
    for (const route of ["/", "/join", "/products"]) {
      const verdict = buildCaseVerdict(validCase({ mode, route }));
      assert.equal(verdict.failedChecks.length, 0, `${mode} ${route}: ${JSON.stringify(verdict.failedChecks)}`);
    }
  }
});

test("a case whose only anomaly is a 304 document navigation PASSES (the original false failure)", () => {
  const verdict = buildCaseVerdict(
    validCase({
      documentNavigation: evaluateDocumentNavigation({ status: 304, responseReceived: true, ...okDom }),
      cacheEvidence: summarizeCacheEvidence([{ url: "http://127.0.0.1:4173/", status: 304, fromCache: true, resourceType: "Document" }]),
    })
  );
  const ids = verdict.failedChecks.map((c) => c.id);
  assert.equal(ids.includes("document-navigation"), false, `document-navigation must not fail on 304: ${JSON.stringify(verdict.failedChecks)}`);
  // ...while the cache assertion still reports that a cached response was used.
  assert.equal(ids.includes("cache-isolation"), true);
});

test("cache reuse, uncaught exceptions, storage tampering, bad APIs and missing UI all fail", () => {
  const cacheHit = buildCaseVerdict(
    validCase({ cacheEvidence: summarizeCacheEvidence([{ url: "/", status: 200, fromCache: true, resourceType: "Document" }]) })
  );
  assert.ok(cacheHit.failedChecks.some((c) => c.id === "cache-isolation"));

  const withPageError = buildCaseVerdict(validCase({ pageErrors: [{ message: "SecurityError: Access is denied for this document." }] }));
  assert.ok(withPageError.failedChecks.some((c) => c.id === "no-uncaught-page-errors"));

  const withCdpException = buildCaseVerdict(validCase({ cdpExceptions: [{ text: "Uncaught", exception: { description: "SecurityError" } }] }));
  assert.ok(withCdpException.failedChecks.some((c) => c.id === "no-uncaught-cdp-exceptions"));

  const brokenStorageSim = buildCaseVerdict(validCase({ mode: "blocked-storage", storageProbe: { localStorage: "ok", sessionStorage: "ok" } }));
  assert.ok(brokenStorageSim.failedChecks.some((c) => c.id === "storage-simulation"));

  const emptyProducts = buildCaseVerdict(validCase({ products: { status: 200, contentType: "application/json", body: { success: true, count: 0, data: [] } } }));
  assert.ok(emptyProducts.failedChecks.some((c) => c.id === "api-products"));

  const noUi = buildCaseVerdict(validCase({ route: "/products", info: { ...validInfo("/products"), productCardCount: 0 } }));
  assert.ok(noUi.failedChecks.some((c) => c.id === "route-ui"));

  const noIsolation = buildCaseVerdict(validCase({ isolation: { context: "shared", cache: "browser-default" } }));
  assert.ok(noIsolation.failedChecks.some((c) => c.id === "harness-isolation"));
});

test("self-test proves the harness detects caching AND defeats it", () => {
  const good = assessSelfTest([
    { name: "control same-context cached", expect: "cache-reuse", fromCache: true, nonceReused: true, status: 200 },
    { name: "isolated contexts", expect: "fresh", fromCache: false, nonceReused: false, status: 200 },
    { name: "cache disabled same-context", expect: "fresh", fromCache: false, nonceReused: false, status: 200 },
    { name: "revalidation", expect: "revalidated", status: 304, navigationOk: true },
  ]);
  assert.equal(good.ok, true, JSON.stringify(good.results.filter((r) => !r.ok)));

  const detectionBroken = assessSelfTest([
    { name: "control same-context cached", expect: "cache-reuse", fromCache: false, nonceReused: false, status: 200 },
  ]);
  assert.equal(detectionBroken.ok, false, "a harness that never observes caching must not pass");

  const isolationBroken = assessSelfTest([
    { name: "isolated contexts", expect: "fresh", fromCache: true, nonceReused: true, status: 304 },
  ]);
  assert.equal(isolationBroken.ok, false, "cache reuse in an isolated case must not pass");

  const revalidationRejected = assessSelfTest([{ name: "revalidation", expect: "revalidated", status: 200, navigationOk: false }]);
  assert.equal(revalidationRejected.ok, false);

  assert.equal(assessSelfTest([]).ok, false, "no scenarios means no proof");
});

test("summary and check-run text are renderable and size-capped", () => {
  const report = {
    target: "local-production-build",
    base: "http://127.0.0.1:4173",
    checkedAt: "2026-11-14T00:00:00.000Z",
    failed: false,
    harness: { isolation: "fresh-browser-context-per-case", cachePolicy: "cdp-network-setCacheDisabled", browserVersion: "HeadlessChrome/138" },
    selfTest: assessSelfTest([{ name: "isolated contexts", expect: "fresh", fromCache: false, nonceReused: false, status: 200 }]),
    results: ["/", "/join", "/products"].map((route) => {
      const verdict = buildCaseVerdict(validCase({ route: route === "/products" ? "/products" : route === "/join" ? "/join" : "/" }));
      return {
        mode: "normal",
        route,
        ok: verdict.ok,
        documentNavigation: { status: 200, documentSource: "network" },
        cacheEvidence: { fromCacheCount: 0, fromServiceWorkerCount: 0, revalidatedCount: 0 },
        info: validInfo(route),
        pageErrors: [],
        cdpExceptions: [],
        validations: { health: { ok: true, status: 200, body: healthyHealth.body }, products: { ok: true, count: 2 }, routeUi: { ok: true } },
        storageProbe: { localStorage: "ok", sessionStorage: "ok" },
        failedChecks: [],
      };
    }),
  };
  const markdown = renderSummaryMarkdown(report);
  assert.match(markdown, /Overall: PASS/);
  assert.match(markdown, /\| normal \| \/products \| PASS \|/);
  assert.match(markdown, /Harness cache self-test/);

  const text = buildCheckRunText(report);
  assert.ok(text.length < 60000);
  assert.equal(JSON.parse(text).cases.length, 3);

  const huge = { ...report, results: report.results.map((r) => ({ ...r, pageErrors: Array.from({ length: 50 }, () => ({ message: "x".repeat(5000), stack: "y".repeat(5000) })) })) };
  assert.ok(buildCheckRunText(huge).length <= 60000, "oversized evidence must be truncated, not rejected");
});
