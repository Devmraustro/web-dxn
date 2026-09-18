import express from "express";
import morgan from "morgan";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import { securityHeaders, noSqlInjectionProtection, rateLimiter, validateInput } from "./middleware/security.middleware";
import { UPLOAD_DIR } from "./config/storage";
import { waitForReady } from "./utils/readyState";

dotenv.config();

// Import routes
import productRoutes from "./routes/product.routes";
import orderRoutes from "./routes/order.routes";
import shippingRoutes from "./routes/shipping.routes";
import packRoutes from "./routes/pack.routes";
import offerRoutes from "./routes/offer.routes";
import userRoutes from "./routes/user.routes";
import adminRoutes from "./routes/admin.routes";
import aiRoutes from "./routes/ai.routes";
import metaRoutes from "./routes/meta.routes";
import seoRoutes, { serveRobots, serveSitemap } from "./seo/routes";
import reviewRoutes from "./routes/review.routes";
import uploadRoutes from "./routes/upload.routes";
import errorMiddleware from "./middleware/error.middleware";

// Initialize app
const app = express();

// The Express app serves the built frontend (static assets + SPA fallback)
// when running in production OR on Vercel. Vercel's serverless runtime does
// not guarantee NODE_ENV=production, and the whole deployment (frontend
// routes included) is served through this one function, so it must mount the
// frontend whenever VERCEL is present as well.
const servesFrontend =
  process.env.NODE_ENV === "production" || !!process.env.VERCEL;

// Behind a proxy (Vercel/any reverse proxy) client IPs arrive via
// X-Forwarded-For. Without `trust proxy`, every visitor would share one IP,
// which (a) defeats the per-IP rate limiters (auth, AI, global) — or, with
// express-rate-limit's strict validation, throws on proxied requests — and
// (b) skews access logs. Vercel is the single trusted ingress in production,
// so trust one proxy hop there; locally, trust proxy stays off unless
// TRUST_PROXY is explicitly set (e.g. 1 behind an nginx/Caddy reverse proxy).
if (process.env.VERCEL || process.env.TRUST_PROXY) {
  const hops = Number(process.env.TRUST_PROXY);
  app.set("trust proxy", Number.isInteger(hops) && hops > 0 ? hops : 1);
}

// --- Middleware ---

// Security headers and injection protection
app.use(securityHeaders);
// Single NoSQL-operator + XSS sanitizer pass over body/query/params.
app.use(noSqlInjectionProtection);

// Global rate limiting (auth endpoints have their own stricter limiter in the
// user routes, and the AI/Meta routes define endpoint-specific limits).
app.use(rateLimiter);

// CORS - allow frontend origin(s). CORS_ORIGIN may be a comma-separated list.
const corsOrigins = (process.env.CORS_ORIGIN || "http://localhost:3000")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// On Vercel the SPA and the API are served from the same origin, so browser
// calls never need CORS headers. For cross-origin consumers, auto-allow the
// deployment's own domains (branch + permanent production URLs that Vercel
// sets as env vars) in addition to any explicit CORS_ORIGIN list.
const vercelOrigins = [
  process.env.VERCEL_URL,
  process.env.VERCEL_BRANCH_URL,
  process.env.VERCEL_PROJECT_PRODUCTION_URL,
  `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL ?? ""}`,
]
  .filter((u): u is string => !!u)
  .map((u) => `${u.includes("://") ? "" : "https://"}${u}`);

app.use((req, res, next) => {
  const allowed = [...corsOrigins, ...vercelOrigins];
  cors({
    origin(origin, callback) {
      // Non-browser clients (curl, server-to-server, webhooks) carry no Origin.
      if (!origin) return callback(null, true);
      if (allowed.includes(origin)) return callback(null, true);
      return callback(null, false);
    },
    credentials: true,
    optionsSuccessStatus: 204,
  })(req, res, next);
});

// Meta webhooks require the RAW body for HMAC signature verification, so the
// raw parser must mount BEFORE the JSON parser consumes the stream.
app.use("/meta", express.raw({ type: "application/json", limit: "1mb" }));
app.use("/api/meta", express.raw({ type: "application/json", limit: "1mb" }));

// Mount Meta webhook routes IMMEDIATELY after raw parser — they receive raw Buffer
app.use("/meta", metaRoutes);
app.use("/api/meta", metaRoutes);

// Body parsing with bounded size for NON-META routes only.
// This prevents express.json() from ever touching Meta webhook raw bodies.
app.use((req, res, next) => {
  if (!/^\/api\/meta\//.test(req.originalUrl) && !/^\/meta\//.test(req.originalUrl)) {
    express.json({ limit: "1mb" })(req, res, next);
  } else {
    next();
  }
});
app.use((req, res, next) => {
  if (!/^\/api\/meta\//.test(req.originalUrl) && !/^\/meta\//.test(req.originalUrl)) {
    express.urlencoded({ extended: true, limit: "1mb" })(req, res, next);
  } else {
    next();
  }
});

// Input validation (body complexity bound) — runs AFTER body parsers on non-Meta routes
app.use(validateInput);

// HTTP request logging: dev format in development; combined in production
// (skipped entirely on Vercel, whose runtime already logs requests).
app.use(
  morgan(process.env.NODE_ENV === "development" ? "dev" : "combined", {
    skip: () => !!process.env.VERCEL,
  })
);

// Serve uploaded files (admin image uploads, local provider). On Vercel this
// directory is /tmp/uploads (ephemeral, usually empty — production images are
// served from Cloudinary URLs); on local/Docker it is ./uploads. express.static
// on a missing dir is a safe 404, never a crash.
app.use("/uploads", express.static(UPLOAD_DIR));

// --- API Routes ---

// Health check — DB state is reported verbosely so operators can tell WHY the
// database is unavailable (missing env var vs. unreachable host) without the
// URI itself ever being exposed.
app.get("/api/health", async (req, res) => {
  const configured = !!process.env.MONGODB_URI;
  // Bounded cold-start wait: on a cold serverless/Vercel function the DB is
  // often still connecting when the very first request arrives, so a naive
  // synchronous readyState check reports "degraded" for several seconds even
  // though everything is fine. Wait a BOUNDED window (matching MongoDB's
  // 10s serverSelectionTimeoutMS/connectTimeoutMS, never unbounded) for the
  // connection to establish, then report. Warm path (already ready) returns
  // immediately with no sleep. On timeout we report degraded — we never
  // crash, never throw, never leak secrets, and never delay past the bound.
  const ready = await waitForReady(
    () => mongoose.connection.readyState === 1,
    { timeoutMs: 10_000 }
  );
  res.json({
    status: ready ? "ok" : "degraded",
    db: ready ? "connected" : "disconnected",
    dbConfigured: configured,
    dbReason: ready
      ? "connected"
      : configured
        ? "MONGODB_URI set but connection not established within 10s"
        : "MONGODB_URI not configured in this environment",
    environment: process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString(),
});
});

// Products
app.use("/api/products", productRoutes);

// Orders (with stock validation and pricing snapshot)
app.use("/api/orders", orderRoutes);

// Shipping
app.use("/api/shipping", shippingRoutes);

// Packs
app.use("/api/packs", packRoutes);

// Offers
app.use("/api/offers", offerRoutes);

// Users
app.use("/api/users", userRoutes);

// Admin
app.use("/api/admin", adminRoutes);

// Reviews
app.use("/api/reviews", reviewRoutes);

// Admin file uploads
app.use("/api/upload", uploadRoutes);

// AI chat + health
app.use("/api/ai", aiRoutes);

// SEO
app.use("/api/seo", seoRoutes);

// Crawler entry points at conventional public URLs (also under /api/seo for
// backward compatibility). robots.txt is DB-free; sitemap.xml needs products.
app.get("/robots.txt", serveRobots);
app.get("/sitemap.xml", serveSitemap);

// --- Frontend static serving (production / Vercel) ---
// Mounted AFTER all API/meta/backend routers so it never shadows them. Only
// existing frontend build assets (js/css/img) are served; requests that miss
// fall through to the SPA fallback below.
if (servesFrontend) {
  // Vite emits content-hashed files under /assets — cache them aggressively.
  // The HTML shell and un-hashed paths stay uncached (default) so deploys are
  // picked up immediately.
  app.use(
    express.static(path.join(__dirname, "../frontend/build"), {
      setHeaders(res, filePath) {
        if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        }
      },
    })
  );
}

// --- 404 / SPA fallback ---
app.use((req, res) => {
  if (req.path.startsWith("/api/")) {
    res.status(404).json({ message: "API endpoint not found" });
  } else if (req.path.startsWith("/meta/")) {
    res.status(404).json({ message: "Meta endpoint not found" });
  } else if (
    servesFrontend &&
    req.method === "GET" &&
    // Paths that look like files (have a dot-extension) are never SPA routes:
    // a missing /uploads/..., /assets/..., /favicon.ico etc. must 404 instead
    // of returning index.html (which would mislead crawlers and browsers).
    !path.extname(req.path) &&
    // Dotfiles (/.env, /.git, /.htaccess, ...) must never be served the SPA
    // shell — they are configuration, not routes, and 404-ing them keeps the
    // server honest about what exists.
    !req.path.split("/").some((seg) => seg.startsWith(".") && seg !== ".")
  ) {
    // SPA fallback: serve index.html ONLY for browser/frontend GET routes.
    // API and meta paths are explicitly excluded above, so index.html is
    // never returned for a backend endpoint.
    const indexHtml = path.resolve(__dirname, "../frontend/build", "index.html");
    if (fs.existsSync(indexHtml)) {
      res.sendFile(indexHtml);
    } else {
      // No built frontend in this deployment (e.g. an API-only Vercel
      // function): report the SPA root as not found rather than erroring.
      res.status(404).send("Not Found");
    }
  } else {
    res.status(404).send("Not Found");
  }
});

// --- Error Handling Middleware ---
app.use(errorMiddleware);

export default app;