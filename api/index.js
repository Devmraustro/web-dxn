"use strict";

/**
 * Vercel serverless function entry (modern zero-config `api/` functions).
 *
 * Vercel runs `buildCommand` (`npm run build`) first, which compiles the
 * TypeScript backend to `dist/` and the React app to `dist/frontend/build/`.
 * This file is then packaged by Vercel as the single serverless function and
 * `vercel.json` rewrites every route to it, so the Express app continues to
 * serve exactly what it served before:
 *
 *   - /api/*            REST API (products, orders, shipping, users, admin…)
 *   - /meta/*           Meta (Instagram/Facebook) webhooks (raw body)
 *   - /robots.txt       DB-free crawler entry
 *   - /sitemap.xml      DB-backed sitemap
 *   - /uploads/*        locally stored images (local/Docker only; /tmp on
 *                       Vercel, which is ephemeral by design — production
 *                       images are Cloudinary URLs)
 *   - /assets/*         hashed Vite build assets (immutable Cache-Control
 *                       set by Express static)
 *   - any other GET     SPA fallback (index.html)
 *
 * The compiled handler in `dist/index.js` performs the DB-gating
 * (`ensureDB()`) and returns a safe 503 for API/meta paths when the database
 * is unreachable.
 */
const handler = require("../dist/index.js");

const serverlessHandler = handler.default || handler;

if (typeof serverlessHandler !== "function") {
  throw new Error(
    "dist/index.js did not export a request handler — run `npm run build` first."
  );
}

module.exports = serverlessHandler;
module.exports.default = serverlessHandler; // both @vercel/node export conventions
