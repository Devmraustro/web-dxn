#!/usr/bin/env node
/**
 * Real-browser production smoke check.
 *
 * HTTP 200 alone is not proof that the SPA renders. This opens the production
 * domain in headless Chromium, captures uncaught exceptions (including the
 * debugger call frames at the throw site), verifies the React root and the
 * route-specific UI mount, checks referenced JS/CSS assets return 200 with
 * browser-native MIME types, and exercises the public health/products APIs.
 *
 * It runs each route with normal storage and with site storage denied, because
 * a pre-mount localStorage SecurityError is invisible to React ErrorBoundary.
 *
 * Usage:
 *   PRODUCTION_URL=https://dxnnadz.vercel.app node scripts/production-browser-check.mjs
 */
import fs from "node:fs";
import path from "node:path";

const puppeteer = (await import(process.env.PUPPETEER_MODULE || "puppeteer")).default;

const base = (process.env.PRODUCTION_URL || "https://dxnnadz.vercel.app").replace(/\/$/, "");
const routes = ["/", "/join", "/products"];
const modes = (process.env.BROWSER_MODES || "normal,blocked-storage").split(",").map((s) => s.trim()).filter(Boolean);
const outDir = process.env.BROWSER_REPORT_DIR || "browser-report";
fs.mkdirSync(outDir, { recursive: true });

const browser = await puppeteer.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
  defaultViewport: { width: 1280, height: 900 },
  ...(process.env.PUPPETEER_EXECUTABLE_PATH ? { executablePath: process.env.PUPPETEER_EXECUTABLE_PATH } : {}),
});

const results = [];
let failed = false;

for (const mode of modes) {
  for (const route of routes) {
    const page = await browser.newPage();
    const pageErrors = [];
    const cdpExceptions = [];
    const debuggerFrames = [];
    const consoleErrors = [];
    const failedRequests = [];
    const assets = [];
    const apiResponses = [];

    const cdp = await page.createCDPSession();
    await cdp.send("Runtime.enable");
    await cdp.send("Debugger.enable");
    await cdp.send("Debugger.setPauseOnExceptions", { state: "uncaught" });
    cdp.on("Runtime.exceptionThrown", (event) => cdpExceptions.push(event.exceptionDetails));
    cdp.on("Debugger.paused", async (event) => {
      if (event.reason === "exception" || event.reason === "promiseRejection") {
        debuggerFrames.push({
          reason: event.reason,
          callFrames: (event.callFrames || []).slice(0, 8).map((frame) => ({
            functionName: frame.functionName,
            url: frame.url,
            lineNumber: frame.location.lineNumber,
            columnNumber: frame.location.columnNumber,
          })),
        });
      }
      try { await cdp.send("Debugger.resume"); } catch { /* page may have closed */ }
    });

    page.on("pageerror", (error) => pageErrors.push({ message: error.message, stack: error.stack }));
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push({ text: msg.text(), location: msg.location() });
    });
    page.on("requestfailed", (request) => failedRequests.push({ url: request.url(), error: request.failure()?.errorText }));
    page.on("response", (response) => {
      const url = new URL(response.url());
      const record = { url: response.url(), status: response.status(), contentType: response.headers()["content-type"] || "" };
      if (url.pathname.startsWith("/assets/")) assets.push(record);
      if (url.pathname.startsWith("/api/")) apiResponses.push(record);
    });

    if (mode === "blocked-storage") {
      await page.evaluateOnNewDocument(() => {
        const deny = () => { throw new DOMException("Access is denied for this document.", "SecurityError"); };
        Object.defineProperty(window, "localStorage", { configurable: true, get: deny });
        Object.defineProperty(window, "sessionStorage", { configurable: true, get: deny });
      });
    }

    const result = { route, mode, url: base + route, ok: false };
    try {
      const response = await page.goto(base + route, { waitUntil: "networkidle2", timeout: 60000 });
      await new Promise((resolve) => setTimeout(resolve, 3000));
      const info = await page.evaluate(() => {
        const root = document.getElementById("root");
        const entry = Array.from(document.scripts).find((s) => /\/assets\/index-[^/]+\.js$/.test(s.src));
        const h1 = document.querySelector("h1");
        const productCards = document.querySelectorAll(".dxn-pcard");
        const productImages = Array.from(document.querySelectorAll(".dxn-pcard img")).slice(0, 6).map((img) => ({
          src: img.currentSrc || img.src,
          complete: img.complete,
          naturalWidth: img.naturalWidth,
        }));
        return {
          readyState: document.readyState,
          title: document.title,
          lang: document.documentElement.lang,
          dir: document.documentElement.dir,
          rootChildren: root ? root.childElementCount : -1,
          bodyTextLength: document.body.innerText.trim().length,
          bodyStart: document.body.innerText.trim().slice(0, 160),
          h1: h1 ? h1.textContent.trim() : null,
          entryScript: entry ? { src: entry.src, type: entry.type } : null,
          joinForm: {
            firstName: !!document.querySelector('input[name="firstName"]'),
            lastName: !!document.querySelector('input[name="lastName"]'),
            phone: !!document.querySelector('input[name="phone"]'),
            privacyConsent: !!document.querySelector('input[name="privacyConsent"]'),
            submit: !!document.querySelector('button[type="submit"]'),
          },
          productCardCount: productCards.length,
          productImages,
        };
      });

      const apiChecks = await page.evaluate(async () => {
        const read = async (url) => {
          try {
            const res = await fetch(url, { headers: { Accept: "application/json" } });
            const contentType = res.headers.get("content-type") || "";
            const body = await res.json();
            return { url, status: res.status, contentType, body };
          } catch (error) {
            return { url, error: String(error) };
          }
        };
        const [health, products] = await Promise.all([read("/api/health"), read("/api/products?language=ar")]);
        return {
          health: {
            url: health.url, status: health.status, contentType: health.contentType, error: health.error,
            statusField: health.body?.status, db: health.body?.db, dbConfigured: health.body?.dbConfigured,
            ok: health.status === 200 && health.body?.status === "ok",
          },
          products: {
            url: products.url, status: products.status, contentType: products.contentType, error: products.error,
            success: products.body?.success, count: Array.isArray(products.body?.data) ? products.body.data.length : null,
            ok: products.status === 200 && products.body?.success === true && Array.isArray(products.body?.data) && products.body.data.length > 0,
          },
        };
      });

      const assetFailures = assets.filter((asset) => {
        if (asset.status !== 200) return true;
        if (/\.js($|\?)/.test(asset.url)) return !/javascript|ecmascript/i.test(asset.contentType);
        if (/\.css($|\?)/.test(asset.url)) return !/text\/css/i.test(asset.contentType);
        return false;
      });
      const routeOk =
        route === "/" ? Boolean(info.h1 && /DXN|اكتشف/i.test(info.h1)) :
        route === "/join" ? Object.values(info.joinForm).every(Boolean) :
        route === "/products" ? info.productCardCount > 0 && Boolean(info.h1) :
        false;

      result.httpStatus = response?.status();
      result.info = info;
      result.apiChecks = apiChecks;
      result.pageErrors = pageErrors;
      result.cdpExceptions = cdpExceptions;
      result.debuggerFrames = debuggerFrames;
      result.consoleErrors = consoleErrors;
      result.failedRequests = failedRequests;
      result.assets = assets;
      result.apiResponses = apiResponses;
      result.assetFailures = assetFailures;
      result.routeOk = routeOk;
      result.ok =
        response?.status() === 200 &&
        pageErrors.length === 0 &&
        cdpExceptions.length === 0 &&
        info.rootChildren > 0 &&
        info.bodyTextLength > 50 &&
        info.entryScript?.type === "module" &&
        assetFailures.length === 0 &&
        apiChecks.health.ok &&
        apiChecks.products.ok &&
        routeOk;
      await page.screenshot({ path: path.join(outDir, `${mode}${route.replace(/\//g, "_") || "_root"}.png`), fullPage: false });
    } catch (error) {
      result.error = String(error);
      result.pageErrors = pageErrors;
      result.cdpExceptions = cdpExceptions;
      result.debuggerFrames = debuggerFrames;
      result.consoleErrors = consoleErrors;
      result.failedRequests = failedRequests;
      result.assets = assets;
      result.apiResponses = apiResponses;
    } finally {
      await page.close();
    }
    if (!result.ok) failed = true;
    results.push(result);
  }
}

await browser.close();
const report = { base, checkedAt: new Date().toISOString(), modes, failed, results };
fs.writeFileSync(path.join(outDir, "production-browser-report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
process.exit(failed ? 1 : 0);
