#!/usr/bin/env node
/**
 * Real-browser production smoke check.
 *
 * HTTP 200 alone is not proof that the SPA renders. This script opens the
 * production domain in headless Chromium, captures uncaught exceptions and
 * console errors, verifies the React root mounts, and checks referenced
 * JS/CSS assets return 200 with browser-native MIME types.
 *
 * Usage:
 *   PRODUCTION_URL=https://dxnnadz.vercel.app node scripts/production-browser-check.mjs
 */
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer";

const base = (process.env.PRODUCTION_URL || "https://dxnnadz.vercel.app").replace(/\/$/, "");
const routes = ["/", "/join", "/products"];
const outDir = process.env.BROWSER_REPORT_DIR || "browser-report";
fs.mkdirSync(outDir, { recursive: true });

const browser = await puppeteer.launch({
  headless: "shell",
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
  defaultViewport: { width: 1280, height: 900 },
});

const results = [];
let failed = false;

for (const route of routes) {
  const page = await browser.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  const failedRequests = [];
  const assets = [];

  page.on("pageerror", (error) => pageErrors.push({ message: error.message, stack: error.stack }));
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push({ text: msg.text(), location: msg.location() });
  });
  page.on("requestfailed", (request) => failedRequests.push({ url: request.url(), error: request.failure()?.errorText }));
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (url.pathname.startsWith("/assets/")) {
      assets.push({ url: response.url(), status: response.status(), contentType: response.headers()["content-type"] || "" });
    }
  });

  const result = { route, url: base + route, ok: false };
  try {
    const response = await page.goto(base + route, { waitUntil: "networkidle2", timeout: 60000 });
    await new Promise((resolve) => setTimeout(resolve, 3000));
    const info = await page.evaluate(() => {
      const root = document.getElementById("root");
      const entry = Array.from(document.scripts).find((s) => /\/assets\/index-[^/]+\.js$/.test(s.src));
      return {
        status: document.readyState,
        title: document.title,
        lang: document.documentElement.lang,
        dir: document.documentElement.dir,
        rootChildren: root ? root.childElementCount : -1,
        bodyTextLength: document.body.innerText.trim().length,
        bodyStart: document.body.innerText.trim().slice(0, 160),
        entryScript: entry ? { src: entry.src, type: entry.type } : null,
      };
    });
    const assetFailures = assets.filter((asset) => {
      if (asset.status !== 200) return true;
      if (/\.js$/.test(asset.url)) return !/javascript|ecmascript/i.test(asset.contentType);
      if (/\.css$/.test(asset.url)) return !/text\/css/i.test(asset.contentType);
      return false;
    });
    result.httpStatus = response?.status();
    result.info = info;
    result.pageErrors = pageErrors;
    result.consoleErrors = consoleErrors;
    result.failedRequests = failedRequests;
    result.assets = assets;
    result.assetFailures = assetFailures;
    result.ok =
      response?.status() === 200 &&
      pageErrors.length === 0 &&
      info.rootChildren > 0 &&
      info.bodyTextLength > 50 &&
      info.entryScript?.type === "module" &&
      assetFailures.length === 0;
    await page.screenshot({ path: path.join(outDir, `${route.replace(/\//g, "_") || "_root"}.png`), fullPage: false });
  } catch (error) {
    result.error = String(error);
    result.pageErrors = pageErrors;
    result.consoleErrors = consoleErrors;
    result.failedRequests = failedRequests;
    result.assets = assets;
  } finally {
    await page.close();
  }
  if (!result.ok) failed = true;
  results.push(result);
}

await browser.close();
const report = { base, checkedAt: new Date().toISOString(), failed, results };
fs.writeFileSync(path.join(outDir, "production-browser-report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
process.exit(failed ? 1 : 0);
