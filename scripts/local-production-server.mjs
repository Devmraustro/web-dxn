#!/usr/bin/env node
/**
 * Deterministic local production stack for browser verification.
 *
 * WHAT IS REAL HERE
 * -----------------
 *   - The compiled production frontend: `dist/frontend/build` (the exact Vite
 *     output `npm run build` produces, served with the same immutable/no-cache
 *     Cache-Control policy as production).
 *   - The compiled production backend: `dist/index.js` → the real Express app
 *     (helmet/security headers, rate limiting, static asset serving, API route
 *     table, SPA fallback, 404 rules, error middleware).
 *
 * WHAT IS A FIXTURE (and why)
 * ---------------------------
 * The public API responses for `/api/products`, `/api/categories`,
 * `/api/settings/public`, `/api/offers`, `/api/reviews` and `/api/health` are
 * served from a deterministic in-memory fixture mounted in front of the real
 * app. A browser regression must be hermetic: it may not depend on Atlas being
 * reachable, on seeded production data, or on network egress from the runner.
 * Without this, a products page has zero cards whenever the DB is unavailable
 * and the harness would report an application failure that is really an
 * environment failure — exactly the class of false result this work removes.
 *
 * Every fixture payload mirrors the real controller contract (see
 * `src/backend/controllers/product.controller.ts` and friends):
 *   products  → { success, count, data: [{ _id, slug, sku, category, price,
 *                 compareAtPrice, stockQuantity, image, images, title,
 *                 description, translations[], isFeatured, isActive }] }
 *   health    → { status, db, dbConfigured, dbReason, environment, timestamp }
 * The fixture is explicitly labelled (`db: "fixture"`, `environment:
 * "verification-fixture"`) so evidence can never be mistaken for a live-DB
 * health claim. Live production API truth is verified separately by the
 * `production-live` job.
 *
 * Usage:
 *   node scripts/local-production-server.mjs --port 4173
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import express from "express";

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

const argOf = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index > -1 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
};

const port = Number(argOf("port", process.env.PORT || 4173));
const host = argOf("host", process.env.HOST || "127.0.0.1");
const buildDir = path.join(repoRoot, "dist", "frontend", "build");
const serverEntry = path.join(repoRoot, "dist", "index.js");

for (const required of [serverEntry, path.join(buildDir, "index.html")]) {
  if (!fs.existsSync(required)) {
    console.error(`Missing build artifact: ${required}\nRun \`npm run build\` before starting the local production server.`);
    process.exit(2);
  }
}

process.env.NODE_ENV = process.env.NODE_ENV || "production";
// The real app mounts the compiled frontend only when it believes it is in
// production; keep that behaviour explicit for the verification stack.
process.env.NODE_ENV = "production";

const compiled = require(serverEntry);
const realApp = compiled.startServer ? compiled.startServer() : compiled.default ?? compiled;
if (typeof realApp !== "function") {
  console.error("dist/index.js did not expose the Express app");
  process.exit(2);
}

// ---------------------------------------------------------------------------
// Deterministic fixture catalog (Arabic/French content, local images).
// ---------------------------------------------------------------------------
const PRODUCTS = [
  { slug: "ganozhi", sku: "DXN-GZ", category: "beverages", price: 4500, compareAtPrice: 5200, stock: 42, ar: "قهوة غانوتشي", fr: "Café Ganoderma Ganozhi", image: "ganozhi" },
  { slug: "lingzhi-coffee", sku: "DXN-LC", category: "beverages", price: 5200, compareAtPrice: null, stock: 37, ar: "قهوة لينغزي", fr: "Café Lingzhi 3-en-1", image: "lingzhi-coffee" },
  { slug: "spirulina-tablets", sku: "DXN-SP", category: "supplements", price: 6800, compareAtPrice: null, stock: 15, ar: "أقراص spirulina", fr: "Comprimés Spiruline", image: "spirulina-tablets" },
  { slug: "rg-soap", sku: "DXN-RG", category: "cosmetics", price: 1900, compareAtPrice: 2400, stock: 88, ar: "صابون آر جي", fr: "Savon RG", image: "rg-soap" },
  { slug: "ganozhi-toothpaste", sku: "DXN-TP", category: "cosmetics", price: 1600, compareAtPrice: null, stock: 64, ar: "معجون أسنان غانوتشي", fr: "Dentifrice Ganozhi", image: "ganozhi-toothpaste" },
  { slug: "cordial-cafe", sku: "DXN-CD", category: "beverages", price: 3900, compareAtPrice: null, stock: 0, ar: "قهوة كورديال", fr: "Cordial Café", image: "cordial-cafe" },
];

const productPayload = (language) =>
  PRODUCTS.map((p, index) => {
    const title = language === "fr" ? p.fr : p.ar;
    return {
      _id: `65f00000a1b2c3d4e5f6${String(index).padStart(4, "0")}`,
      slug: p.slug,
      sku: p.sku,
      category: p.category,
      price: p.price,
      compareAtPrice: p.compareAtPrice,
      stockQuantity: p.stock,
      points: 10,
      image: `/fixture/products/${p.image}.svg`,
      images: [`/fixture/products/${p.image}.svg`],
      title,
      description: language === "fr" ? `Produit DXN authentique — ${p.fr}.` : `منتج DXN الأصلي — ${p.ar}.`,
      size: "1 boîte",
      isFeatured: index < 2,
      isActive: true,
      isPlaceholder: false,
      translations: [{ language: "ar", title: p.ar }, { language: "fr", title: p.fr }],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
  });

const productSvg = (label) => `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="480" height="480" viewBox="0 0 480 480" role="img" aria-label="${label}">
  <rect width="480" height="480" fill="#0b3d1f"/>
  <circle cx="240" cy="200" r="96" fill="#d9a441"/>
  <text x="240" y="390" font-family="sans-serif" font-size="26" fill="#ffffff" text-anchor="middle">${label}</text>
</svg>`;

const fixture = express.Router();
const noStore = (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
};
// Scoped to the fixture's own paths only: the real app must keep its production
// caching policy for the SPA shell (`no-cache` + ETag) and `/assets/*`
// (`immutable`), otherwise the browser check would test the fixture's headers
// instead of the deployment's.
fixture.use("/api", noStore);
fixture.use("/fixture", noStore);

fixture.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    db: "fixture",
    dbConfigured: false,
    dbReason: "local verification fixture — no database is contacted by design",
    environment: "verification-fixture",
    timestamp: new Date().toISOString(),
  });
});

fixture.get("/api/products", (req, res) => {
  const language = req.query.language === "fr" ? "fr" : "ar";
  let data = productPayload(language);
  if (String(req.query.featured) === "true") data = data.filter((p) => p.isFeatured);
  if (typeof req.query.category === "string" && req.query.category !== "all") {
    data = data.filter((p) => p.category === req.query.category);
  }
  res.json({ success: true, count: data.length, data });
});

fixture.get("/api/products/slug/:slug", (req, res) => {
  const product = productPayload("ar").find((p) => p.slug === req.params.slug);
  if (!product) return res.status(404).json({ message: "Product not found" });
  res.json({ success: true, data: product });
});

fixture.get("/api/categories", (_req, res) => {
  res.json({
    success: true,
    data: [
      { _id: "cat-1", slug: "beverages", name: "مشروبات", nameAr: "مشروبات", nameFr: "Boissons", productCount: 3 },
      { _id: "cat-2", slug: "supplements", name: "مكملات", nameAr: "مكملات", nameFr: "Compléments", productCount: 1 },
      { _id: "cat-3", slug: "cosmetics", name: "مستحضرات", nameAr: "مستحضرات", nameFr: "Cosmétiques", productCount: 2 },
    ],
  });
});

fixture.get("/api/settings/public", (_req, res) => {
  res.json({
    success: true,
    data: {
      brandName: "DXN Natural Life",
      sponsorMembershipNumber: "123456789",
      sponsorConfigured: true,
      sponsorNameAr: "راعي DXN",
      sponsorNameFr: "Parrain DXN",
      whatsappNumber: "213555000000",
      whatsappUrl: "https://wa.me/213555000000",
      contactEmail: "contact@example.com",
      socialLinks: { facebook: "", instagram: "", tiktok: "", telegram: "", whatsapp: "https://wa.me/213555000000" },
      businessHoursAr: "9:00 - 18:00",
      businessHoursFr: "9h00 - 18h00",
    },
  });
});

fixture.get("/api/offers", (_req, res) => res.json({ success: true, count: 0, data: [] }));
fixture.get("/api/reviews", (_req, res) => res.json({ success: true, count: 0, data: [] }));
fixture.get("/api/packs", (_req, res) => res.json({ success: true, count: 0, data: [] }));

fixture.get("/fixture/products/:file", (req, res) => {
  const name = String(req.params.file || "").replace(/\.svg$/, "");
  const product = PRODUCTS.find((p) => p.image === name);
  if (!product) return res.status(404).send("Not Found");
  res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.send(productSvg(product.sku));
});

// ---------------------------------------------------------------------------
// Compose: fixtures first, then the REAL compiled Express application.
// ---------------------------------------------------------------------------
const outer = express();
outer.use(fixture);
outer.use(realApp);

const server = http.createServer(outer);

server.listen(port, host, () => {
  console.log(`LOCAL_PRODUCTION_READY http://${host}:${port}`);
  console.log(`serving build: ${buildDir}`);
});

const shutdown = () => {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
