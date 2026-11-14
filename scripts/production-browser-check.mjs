#!/usr/bin/env node
/**
 * Real-browser production verification (hardened).
 *
 * WHAT IT PROVES
 * --------------
 * HTTP 200 alone is not proof that the SPA rendered. For every route × storage
 * mode this harness requires, in a real Chromium:
 *
 *   1. cache-isolated case           — one fresh browser context per case **and**
 *                                      `Network.setCacheDisabled: true`, with zero
 *                                      responses served from cache verified by
 *                                      `response.fromCache()`;
 *   2. document navigation evaluated — 200/203/304 accepted (a 304 revalidation is
 *                                      a complete, usable document and must not be
 *                                      reported as an HTTP failure), other statuses
 *                                      rejected;
 *   3. blocked-storage simulation    — `localStorage` **and** `sessionStorage`
 *                                      getters throw `SecurityError` before any
 *                                      application script runs, and the denial is
 *                                      asserted (not assumed) in every case;
 *   4. zero uncaught exceptions      — `pageerror` and CDP `Runtime.exceptionThrown`
 *                                      (with `Debugger.setPauseOnExceptions` for
 *                                      throw-site frames);
 *   5. a mounted React root          — `#root` has element children plus React
 *                                      fiber/container markers (documented fallback
 *                                      to "root children + site chrome");
 *   6. correct route-specific UI     — `/` hero+chrome, `/join` form, `/products`
 *                                      catalogue cards + supported images;
 *   7. valid API responses           — `/api/health` and `/api/products` contract
 *                                      validated, and no `/api/*` response ≥ 400;
 *   8. asset integrity               — every `/assets/*` JS/CSS is 200 with the
 *                                      correct MIME type.
 *
 * It also runs a cache self-test (unless `HARNESS_SELF_TEST=0`) that proves the
 * harness both *detects* cache reuse and *defeats* it — see
 * `scripts/lib/browser-harness.mjs`.
 *
 * Usage:
 *   BROWSER_BASE_URL=http://127.0.0.1:4173 node scripts/production-browser-check.mjs
 *   PRODUCTION_URL=https://dxnnadz.vercel.app EXPECT_DB_CONNECTED=1 node scripts/production-browser-check.mjs
 */
import fs from "node:fs";
import http from "node:http";
import path from "node:path";

import {
  assessSelfTest,
  buildCaseVerdict,
  buildCheckRunText,
  evaluateDocumentNavigation,
  renderSummaryMarkdown,
  summarizeCacheEvidence,
} from "./lib/browser-harness.mjs";

const outDir = process.env.BROWSER_REPORT_DIR || "browser-report";
const casesDir = path.join(outDir, "cases");
fs.mkdirSync(casesDir, { recursive: true });

const base = (process.env.BROWSER_BASE_URL || process.env.PRODUCTION_URL || "http://127.0.0.1:4173").replace(/\/$/, "");
const isLocalBase = /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/.test(base);
const target = process.env.BROWSER_TARGET || (isLocalBase ? "local-production-build" : "production");
const routes = (process.env.BROWSER_ROUTES || "/,/join,/products")
  .split(",")
  .map((r) => r.trim())
  .filter(Boolean);
const modes = (process.env.BROWSER_MODES || "normal,blocked-storage")
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);
const requireDbConnected = process.env.EXPECT_DB_CONNECTED === "1";
const runSelfTest = process.env.HARNESS_SELF_TEST !== "0";
const spoilClientIp = process.env.VERIFY_CLIENT_IP_POOL === "1";
const navigationTimeout = Number(process.env.BROWSER_TIMEOUT_MS || 60000);
const mountTimeout = Number(process.env.BROWSER_MOUNT_TIMEOUT_MS || 25000);

/**
 * Installed through the CDP page lifecycle (not a page-level injection) so it
 * exists in every new document *before* the first application byte executes.
 * Both web storages are denied: a pre-mount `SecurityError` on either one used
 * to blank the page before React could mount.
 */
const DENY_STORAGE_SOURCE = `(() => {
  const deny = () => { throw new DOMException("Access is denied for this document.", "SecurityError"); };
  for (const key of ["localStorage", "sessionStorage"]) {
    try {
      Object.defineProperty(window, key, { configurable: true, get: deny });
    } catch (error) {
      try { delete window[key]; } catch (_) {}
    }
  }
})();`;

const STORAGE_PROBE = `(() => {
  const probe = (kind) => {
    try {
      const store = window[kind];
      if (!store || typeof store.getItem !== "function") return "unavailable";
      store.getItem("__dxn_probe__");
      return "ok";
    } catch (error) {
      return "denied";
    }
  };
  return { localStorage: probe("localStorage"), sessionStorage: probe("sessionStorage") };
})()`;

const describeException = (event) => {
  const details = event?.exceptionDetails ?? {};
  const props = {};
  for (const property of details.exception?.preview?.properties || []) props[property.name] = property.value;
  return {
    text: details.text,
    className: details.exception?.className,
    description: details.exception?.description,
    name: props.name,
    message: props.message,
    code: props.code,
    url: details.url,
    lineNumber: details.lineNumber,
    columnNumber: details.columnNumber,
  };
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/* -------------------------------------------------------------------------- */
/* Cache self-test: prove detection AND defeat of cache reuse.                 */
/* -------------------------------------------------------------------------- */
async function startSelfTestServer(puppeteerBrowser) {
  let docCounter = 0;
  let revalidateCounter = 0;
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://127.0.0.1");
    if (url.pathname === "/doc") {
      const nonce = `doc-${++docCounter}`;
      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=600, immutable",
      });
      res.end(`<!doctype html><html><head><title>cache probe</title></head><body><div id="root"><h1>probe</h1></div><script>window.__probeNonce=${JSON.stringify(nonce)}</script></body></html>`);
      return;
    }
    if (url.pathname === "/doc-revalidate") {
      const etag = `"probe-etag-v1"`;
      if (req.headers["if-none-match"] === etag) {
        res.writeHead(304, { ETag: etag, "Cache-Control": "no-cache" });
        res.end();
        return;
      }
      const nonce = `rev-${++revalidateCounter}`;
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache", ETag: etag });
      res.end(`<!doctype html><html><head><title>cache probe</title></head><body><div id="root"><h1>probe</h1></div><script>window.__probeNonce=${JSON.stringify(nonce)}</script></body></html>`);
      return;
    }
    res.writeHead(404).end("not found");
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  return { origin, server, close: () => new Promise((resolve) => server.close(resolve)) };
}

async function navigateProbe(browser, url, { cacheDisabled, blockedStorage = false }) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  const cdp = await page.createCDPSession();
  await cdp.send("Network.enable");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled });
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  if (blockedStorage) await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: DENY_STORAGE_SOURCE });
  const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: navigationTimeout });
  // Read status/fromCache from the navigation response object itself: the
  // `response` event listener is not a reliable source for the top-level
  // document (a memory-cache hit can be reported without a request object).
  const navigation = {
    status: response?.status() ?? 0,
    fromCache: response ? response.fromCache() : false,
  };
  const nonce = await page.evaluate(() => window.__probeNonce ?? null);
  const storageProbe = await page.evaluate(STORAGE_PROBE);
  await context.close();
  return { status: navigation.status, reportedFromCache: navigation.fromCache, nonce, storageProbe };
}

async function navigateTwiceInOneContext(browser, url, { cacheDisabled, blockedStorage = false }) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  const cdp = await page.createCDPSession();
  await cdp.send("Network.enable");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled });
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  if (blockedStorage) await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: DENY_STORAGE_SOURCE });
  const navigations = [];
  const nonces = [];
  const storageProbes = [];
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: navigationTimeout });
    navigations.push({ status: response?.status() ?? 0, fromCache: response ? response.fromCache() : false });
    nonces.push(await page.evaluate(() => window.__probeNonce ?? null));
    storageProbes.push(await page.evaluate(STORAGE_PROBE));
  }
  await context.close();
  const last = navigations[navigations.length - 1] || { status: 0, fromCache: false };
  return {
    navigations,
    nonces,
    storageProbes,
    status: last.status,
    reportedFromCache: last.fromCache,
    nonceReused: nonces[0] !== null && nonces[0] === nonces[1],
  };
}

async function runCacheSelfTest(browser) {
  const { origin, close } = await startSelfTestServer(browser);
  const scenarios = [];
  try {
    // 1. Control: same context, browser cache ENABLED → the document IS reused.
    //    Without this, "no cache reuse" could just mean "the probe never caches".
    const control = await navigateTwiceInOneContext(browser, `${origin}/doc`, { cacheDisabled: false });
    scenarios.push({
      name: "control-same-context-cache-enabled",
      description: "Same context, cache enabled: the second navigation must be served from cache.",
      expect: "cache-reuse",
      status: control.status,
      fromCache: control.reportedFromCache,
      nonceReused: control.nonceReused,
      navigations: control.navigations,
    });

    // 2. Fresh context per navigation, cache ENABLED → no reuse possible.
    const isolatedA = await navigateProbe(browser, `${origin}/doc`, { cacheDisabled: false });
    const isolatedB = await navigateProbe(browser, `${origin}/doc`, { cacheDisabled: false });
    scenarios.push({
      name: "fresh-context-per-navigation",
      description: "Two freshly created contexts, cache enabled: each navigation must fetch a new document.",
      expect: "fresh",
      status: isolatedB.status,
      fromCache: isolatedB.reportedFromCache,
      nonceReused: isolatedA.nonce === isolatedB.nonce,
      navigations: [isolatedA, isolatedB].map((n) => ({ status: n.status, fromCache: n.reportedFromCache })),
    });

    // 3. Same context, CDP cache disabled → re-navigation must hit the network.
    const disabled = await navigateTwiceInOneContext(browser, `${origin}/doc`, { cacheDisabled: true });
    scenarios.push({
      name: "cdp-cache-disabled-same-context",
      description: "Same context with Network.setCacheDisabled: both navigations must be 200 from the network.",
      expect: "fresh",
      status: disabled.status,
      fromCache: disabled.reportedFromCache,
      nonceReused: disabled.nonceReused,
      navigations: disabled.navigations,
    });

    // 4. A 304 revalidation must be accepted by the navigation policy.
    const revalidation = await navigateTwiceInOneContext(browser, `${origin}/doc-revalidate`, { cacheDisabled: false });
    const navigationVerdict = evaluateDocumentNavigation({
      status: revalidation.status,
      responseReceived: true,
      readyState: "complete",
      rootPresent: true,
    });
    scenarios.push({
      name: "revalidated-document-304",
      description: "A cached document revalidated with 304 must be accepted as a valid navigation.",
      expect: "revalidated",
      status: revalidation.status,
      fromCache: revalidation.reportedFromCache,
      nonceReused: revalidation.nonceReused,
      navigationOk: navigationVerdict.ok,
      navigations: revalidation.navigations,
    });

    // 5. blocked-storage case after a normal case warmed the cache.
    const warm = await navigateProbe(browser, `${origin}/doc`, { cacheDisabled: false });
    const blocked = await navigateProbe(browser, `${origin}/doc`, { cacheDisabled: true, blockedStorage: true });
    scenarios.push({
      name: "blocked-storage-after-normal-warm-cache",
      description: "A blocked-storage case must not re-use the document a normal case cached.",
      expect: "fresh",
      status: blocked.status,
      fromCache: blocked.reportedFromCache,
      nonceReused: warm.nonce === blocked.nonce,
      storageProbe: blocked.storageProbe,
      navigations: [
        { status: warm.status, fromCache: warm.reportedFromCache },
        { status: blocked.status, fromCache: blocked.reportedFromCache },
      ],
    });
  } finally {
    await close();
  }
  return assessSelfTest(scenarios);
}

/* -------------------------------------------------------------------------- */
/* Main matrix                                                                 */
/* -------------------------------------------------------------------------- */
async function runCase(browser, { mode, route, index, priorCaseUrls }) {
  const url = `${base}${route}`;
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  const pageErrors = [];
  const cdpExceptions = [];
  const debuggerFrames = [];
  const consoleErrors = [];
  const failedRequests = [];
  const responses = [];
  const assets = [];
  const apiResponses = [];

  const result = {
    route,
    mode,
    url,
    ok: false,
    isolation: { context: "fresh-browser-context-per-case", cache: "cdp-network-setCacheDisabled" },
    cacheControl: { cacheDisabled: true, caseIndex: index, priorCaseUrlCount: priorCaseUrls.length },
  };

  const cdp = await page.createCDPSession();
  try {
    await cdp.send("Network.enable");
    // Requirement 1: never let a previous case's cache serve this case.
    await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Debugger.enable");
    await cdp.send("Debugger.setPauseOnExceptions", { state: "uncaught" });
    if (mode === "blocked-storage") {
      // Requirement 3: deny BOTH storages before any application script runs.
      await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: DENY_STORAGE_SOURCE });
    }

    cdp.on("Runtime.exceptionThrown", (event) => {
      cdpExceptions.push(describeException(event));
    });
    cdp.on("Debugger.paused", async (event) => {
      if (event.reason === "exception" || event.reason === "promiseRejection") {
        debuggerFrames.push({
          reason: event.reason,
          callFrames: (event.callFrames || []).slice(0, 8).map((frame) => ({
            functionName: frame.functionName,
            url: frame.url,
            lineNumber: frame.location?.lineNumber,
            columnNumber: frame.location?.columnNumber,
          })),
        });
      }
      try {
        await cdp.send("Debugger.resume");
      } catch {
        /* page closed */
      }
    });

    page.on("pageerror", (error) => pageErrors.push({ message: error.message, stack: error.stack }));
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push({ text: message.text(), location: message.location() });
    });
    page.on("requestfailed", (request) => failedRequests.push({ url: request.url(), error: request.failure()?.errorText }));
    page.on("response", (response) => {
      try {
        const parsed = new URL(response.url());
        const record = {
          url: response.url(),
          status: response.status(),
          contentType: response.headers()["content-type"] || "",
          cacheControl: response.headers()["cache-control"] || "",
          fromCache: response.fromCache(),
          fromServiceWorker: response.fromServiceWorker(),
          resourceType: response.request().resourceType(),
        };
        responses.push(record);
        if (parsed.pathname.startsWith("/assets/")) assets.push(record);
        if (parsed.pathname.startsWith("/api/")) apiResponses.push(record);
      } catch {
        /* response detached before headers were readable */
      }
    });

    if (spoilClientIp) {
      // Verification server has a per-IP rate limiter; give each case its own
      // client identity so the matrix never trips the limiter.
      await page.setExtraHTTPHeaders({ "X-Forwarded-For": `10.10.${Math.floor(index / 250)}.${(index % 250) + 2}` });
    }

    // Requirement 2: evaluate the navigation on its merits, not on `=== 200`.
    const navigationResponse = await page.goto(url, { waitUntil: "domcontentloaded", timeout: navigationTimeout });
    await page
      .waitForFunction(() => {
        const root = document.getElementById("root");
        return !!root && root.childElementCount > 0;
      }, { timeout: mountTimeout, polling: 100 })
      .catch(() => {});
    if (route === "/products") {
      await page
        .waitForFunction(() => document.querySelectorAll(".dxn-pcard").length > 0, { timeout: mountTimeout, polling: 100 })
        .catch(() => {});
    }
    await page.waitForNetworkIdle({ idleTime: 700, timeout: 15000 }).catch(() => {});
    await wait(750); // let lazy images finish decoding

    const info = await page.evaluate(() => {
      const root = document.getElementById("root");
      const keys = root ? Object.keys(root) : [];
      const childKeys = root?.firstElementChild ? Object.keys(root.firstElementChild) : [];
      const fiberMarker =
        keys.some((key) => key.startsWith("__reactContainer$") || key === "_reactRootContainer") ||
        childKeys.some((key) => key.startsWith("__reactFiber$") || key.startsWith("__reactProps$"));
      const entry = Array.from(document.scripts).find((script) => /\/assets\/index-[^/]+\.js$/.test(script.src));
      const h1 = document.querySelector("h1");
      const cards = document.querySelectorAll(".dxn-pcard");
      return {
        readyState: document.readyState,
        title: document.title,
        lang: document.documentElement.lang,
        dir: document.documentElement.dir,
        rootPresent: !!root,
        rootChildren: root ? root.childElementCount : -1,
        reactFiberMarker: fiberMarker,
        headerPresent: !!document.querySelector("header"),
        footerPresent: !!document.querySelector("footer"),
        bodyTextLength: document.body.innerText.trim().length,
        bodyStart: document.body.innerText.trim().slice(0, 160),
        h1: h1 ? h1.textContent.trim() : null,
        entryScript: entry ? { src: entry.src, type: entry.type } : null,
        categoryTabsPresent: !!document.querySelector('[role="tablist"]'),
        joinForm: {
          firstName: !!document.querySelector('input[name="firstName"]'),
          lastName: !!document.querySelector('input[name="lastName"]'),
          phone: !!document.querySelector('input[name="phone"]'),
          privacyConsent: !!document.querySelector('input[name="privacyConsent"]'),
          submit: !!document.querySelector('button[type="submit"]'),
        },
        productCardCount: cards.length,
        productImages: Array.from(document.querySelectorAll(".dxn-pcard img"))
          .slice(0, 6)
          .map((img) => ({ src: img.currentSrc || img.src, complete: img.complete, naturalWidth: img.naturalWidth })),
      };
    });

    const storageProbe = await page.evaluate(STORAGE_PROBE);

    const apiChecks = await page.evaluate(async () => {
      const read = async (path) => {
        try {
          const response = await fetch(path, { headers: { Accept: "application/json" }, cache: "no-store" });
          const contentType = response.headers.get("content-type") || "";
          let body = null;
          try {
            body = await response.json();
          } catch (error) {
            body = null;
          }
          return { url: path, status: response.status, contentType, body };
        } catch (error) {
          return { url: path, error: String(error) };
        }
      };
      const [health, products] = await Promise.all([read("/api/health"), read("/api/products?language=ar")]);
      return { health, products };
    });

    const documentNavigation = evaluateDocumentNavigation({
      status: navigationResponse?.status() ?? 0,
      responseReceived: !!navigationResponse,
      readyState: info.readyState,
      rootPresent: info.rootPresent,
    });
    const cacheEvidence = summarizeCacheEvidence(responses, { priorCaseUrls });
    const verdict = buildCaseVerdict({
      mode,
      route,
      origin: base,
      documentNavigation,
      cacheEvidence,
      pageErrors,
      cdpExceptions,
      consoleErrors,
      failedRequests,
      assets,
      apiResponses,
      health: apiChecks.health,
      products: apiChecks.products,
      info,
      storageProbe,
      requireDbConnected,
      isolation: result.isolation,
      priorCaseUrls,
    });

    Object.assign(result, {
      ok: verdict.ok,
      documentNavigation,
      cacheEvidence,
      pageErrors,
      cdpExceptions,
      debuggerFrames: debuggerFrames.slice(0, 3),
      firstCdpException: cdpExceptions[0],
      consoleErrors,
      failedRequests: {
        sameOrigin: failedRequests.filter((failure) => {
          try {
            return new URL(failure.url).origin === base;
          } catch {
            return false;
          }
        }),
        thirdParty: failedRequests.filter((failure) => {
          try {
            return new URL(failure.url).origin !== base;
          } catch {
            return true;
          }
        }),
      },
      assets: assets.map((asset) => ({ url: asset.url, status: asset.status, contentType: asset.contentType, fromCache: asset.fromCache })),
      observedUrls: [...new Set(responses.map((response) => response.url))],
      apiResponses: apiResponses.map((response) => ({ url: response.url, status: response.status, fromCache: response.fromCache })),
      info,
      storageProbe,
      validations: {
        health: { ok: verdict.checks.find((check) => check.id === "api-health")?.ok === true, status: apiChecks.health.status, body: apiChecks.health.body },
        products: { ok: verdict.checks.find((check) => check.id === "api-products")?.ok === true, count: Array.isArray(apiChecks.products?.body?.data) ? apiChecks.products.body.data.length : null },
        routeUi: { ok: verdict.checks.find((check) => check.id === "route-ui")?.ok === true },
        reactMount: { ok: verdict.checks.find((check) => check.id === "react-root-mounted")?.ok === true },
      },
      checks: verdict.checks,
      failedChecks: verdict.failedChecks,
    });
  } catch (error) {
    result.error = String(error?.stack || error);
    Object.assign(result, {
      pageErrors,
      cdpExceptions,
      debuggerFrames: debuggerFrames.slice(0, 3),
      firstCdpException: cdpExceptions[0],
      consoleErrors,
      cacheEvidence: summarizeCacheEvidence(responses, { priorCaseUrls }),
      failedChecks: [{ id: "case-execution", reasons: [String(error?.message || error)] }],
    });
  } finally {
    try {
      await page.screenshot({ path: path.join(outDir, `${mode}${route.replace(/\//g, "_") || "_root"}.png`), fullPage: false });
    } catch {
      /* screenshot is best-effort evidence */
    }
    await context.close();
  }

  fs.writeFileSync(path.join(casesDir, `${mode}${route.replace(/\//g, "_") || "_root"}.json`), JSON.stringify(result, null, 2));
  return result;
}

async function main() {
  const puppeteer = (await import(process.env.PUPPETEER_MODULE || "puppeteer")).default;
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    defaultViewport: { width: 1280, height: 900 },
    ...(process.env.PUPPETEER_EXECUTABLE_PATH ? { executablePath: process.env.PUPPETEER_EXECUTABLE_PATH } : {}),
  });

  const results = [];
  const priorCaseUrls = new Set();
  let index = 0;
  try {
    for (const mode of modes) {
      for (const route of routes) {
        index += 1;
        const result = await runCase(browser, { mode, route, index, priorCaseUrls });
        for (const url of result.observedUrls || []) priorCaseUrls.add(url);
        results.push(result);
        console.error(`[${result.ok ? "PASS" : "FAIL"}] ${mode} ${route} (document ${result.documentNavigation?.status ?? result.error ?? "?"})`);
      }
    }

    let selfTest = null;
    if (runSelfTest) {
      selfTest = await runCacheSelfTest(browser);
      console.error(`[${selfTest.ok ? "PASS" : "FAIL"}] harness cache self-test (${selfTest.results.length} scenarios)`);
    }

    const browserVersion = await browser.version();
    const report = {
      target,
      base,
      checkedAt: new Date().toISOString(),
      routes,
      modes,
      requireDbConnected,
      harness: {
        isolation: "fresh-browser-context-per-case",
        cachePolicy: "cdp-network-setCacheDisabled",
        documentStatusPolicy: "accept 200/203/304 (304 = revalidation, not an error)",
        blockedStorage: "CDP Page.addScriptToEvaluateOnNewDocument denies localStorage + sessionStorage",
        uncaughtExceptionSources: ["pageerror", "CDP Runtime.exceptionThrown", "CDP Debugger.setPauseOnExceptions(uncaught)"],
        apiAssertions: ["/api/health contract", "/api/products contract (non-empty, item shape)", "no /api/* >= 400"],
        selfTest: runSelfTest ? "enabled" : "disabled",
        browserVersion,
      },
      selfTest,
      failed: results.some((result) => !result.ok) || (selfTest ? !selfTest.ok : false),
      results,
    };

    fs.writeFileSync(path.join(outDir, "production-browser-report.json"), JSON.stringify(report, null, 2));
    fs.writeFileSync(path.join(outDir, "check-run-summary.md"), renderSummaryMarkdown(report));
    fs.writeFileSync(path.join(outDir, "check-run-text.json"), buildCheckRunText(report));
    if (selfTest) fs.writeFileSync(path.join(outDir, "harness-selftest.json"), JSON.stringify(selfTest, null, 2));

    console.log(renderSummaryMarkdown(report));
    console.log("");
    console.log(
      JSON.stringify(
        {
          target,
          base,
          failed: report.failed,
          cases: results.map((result) => ({
            mode: result.mode,
            route: result.route,
            ok: result.ok,
            documentStatus: result.documentNavigation?.status ?? null,
            documentSource: result.documentNavigation?.documentSource ?? null,
            cachedResponses: result.cacheEvidence?.fromCacheCount ?? null,
            rootChildren: result.info?.rootChildren ?? null,
            pageErrors: result.pageErrors?.length ?? null,
            cdpExceptions: result.cdpExceptions?.length ?? null,
            failedChecks: result.failedChecks,
          })),
          selfTest: selfTest ? { ok: selfTest.ok, scenarios: selfTest.results.map((r) => ({ name: r.name, ok: r.ok, expect: r.expect })) } : null,
        },
        null,
        2
      )
    );
    process.exitCode = report.failed ? 1 : 0;
  } finally {
    await browser.close();
  }
}

await main();
