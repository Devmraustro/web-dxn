#!/usr/bin/env node
/**
 * End-to-end local browser verification orchestrator.
 *
 *   1. boot the fixture-backed LOCAL PRODUCTION stack
 *      (`scripts/local-production-server.mjs` = compiled `dist/` Express app +
 *      compiled Vite build, see that file for exactly what is real vs fixture);
 *   2. preflight the stack over plain HTTP (shell + `/api/health` + products);
 *   3. run the full browser matrix with `scripts/production-browser-check.mjs`
 *      (3 routes × normal/blocked-storage, isolated contexts, cache disabled)
 *      plus the harness cache self-test;
 *   4. tear the stack down and propagate the harness exit code.
 *
 * Usage: node scripts/verify-local-browser.mjs [--port 4173]
 */
import { spawn } from "node:child_process";
import path from "node:path";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const argOf = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index > -1 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
};
const port = Number(argOf("port", process.env.VERIFY_PORT || 4173));
const origin = `http://127.0.0.1:${port}`;

/**
 * Deterministic, non-secret verification environment. Nothing here is read from
 * a real deployment; `JWT_SECRET` only satisfies the production fail-fast guard
 * so the REAL compiled app can boot with `NODE_ENV=production` (the same mode
 * that mounts the compiled frontend and applies production headers).
 */
const serverEnv = {
  ...process.env,
  NODE_ENV: "production",
  PORT: String(port),
  HOST: "127.0.0.1",
  JWT_SECRET: "verification-only-secret-value-not-used-for-any-real-auth-0001",
  TRUST_PROXY: "1",
  AI_SALES_MODE: "PAUSED",
  TELEGRAM_BOT_TOKEN: "",
  CORS_ORIGIN: origin,
};

const waitForServer = (child, timeoutMs = 60000) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Local production server did not become ready in ${timeoutMs}ms`)), timeoutMs);
    const onData = (chunk) => {
      const text = chunk.toString();
      process.stdout.write(text);
      if (text.includes("LOCAL_PRODUCTION_READY")) {
        clearTimeout(timer);
        child.stdout.off("data", onData);
        resolve();
      }
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", (chunk) => process.stderr.write(chunk));
    child.on("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`Local production server exited early with code ${code}`));
    });
  });

async function preflight() {
  const checks = [];
  const shell = await fetch(`${origin}/`, { headers: { Accept: "text/html" } });
  const html = await shell.text();
  checks.push({ id: "shell", status: shell.status, cacheControl: shell.headers.get("cache-control"), hasRoot: /id="root"/.test(html), hasEntry: /\/assets\/index-[^"]+\.js/.test(html) });
  const health = await fetch(`${origin}/api/health`);
  const healthBody = await health.json();
  checks.push({ id: "health", status: health.status, contentType: health.headers.get("content-type"), body: healthBody });
  const products = await fetch(`${origin}/api/products?language=ar`);
  const productsBody = await products.json();
  checks.push({ id: "products", status: products.status, count: Array.isArray(productsBody.data) ? productsBody.data.length : null });

  const failures = [];
  if (checks[0].status !== 200 || !checks[0].hasRoot || !checks[0].hasEntry) failures.push("shell");
  if (checks[1].status !== 200) failures.push("health");
  if (checks[2].status !== 200 || !checks[2].count) failures.push("products");
  if (failures.length) {
    console.error("Preflight failed:", JSON.stringify(checks, null, 2));
    throw new Error(`Local production stack preflight failed: ${failures.join(", ")}`);
  }
  console.error(`Preflight OK: shell 200 (${checks[0].cacheControl}), health 200, products ${checks[2].count} items`);
  return checks;
}

const server = spawn(process.execPath, [path.join(repoRoot, "scripts", "local-production-server.mjs"), "--port", String(port)], {
  cwd: repoRoot,
  env: serverEnv,
  stdio: ["ignore", "pipe", "pipe"],
});

const shutdown = () => {
  if (!server.killed) server.kill("SIGTERM");
};

try {
  await waitForServer(server);
  await preflight();

  const harness = spawn(process.execPath, [path.join(repoRoot, "scripts", "production-browser-check.mjs")], {
    cwd: repoRoot,
    env: {
      ...process.env,
      BROWSER_BASE_URL: origin,
      BROWSER_TARGET: "local-production-build",
      BROWSER_MODES: process.env.BROWSER_MODES || "normal,blocked-storage",
      BROWSER_ROUTES: process.env.BROWSER_ROUTES || "/,/join,/products",
      BROWSER_REPORT_DIR: process.env.BROWSER_REPORT_DIR || "browser-report",
      HARNESS_SELF_TEST: process.env.HARNESS_SELF_TEST || "1",
      VERIFY_CLIENT_IP_POOL: "1",
      EXPECT_DB_CONNECTED: "0",
    },
    stdio: "inherit",
  });
  const exitCode = await new Promise((resolve) => harness.on("exit", (code, signal) => resolve(code ?? (signal ? 1 : 0))));
  shutdown();
  process.exit(exitCode);
} catch (error) {
  shutdown();
  console.error(String(error?.stack || error));
  process.exit(1);
}
