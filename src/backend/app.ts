import express from "express";
import morgan from "morgan";
import helmet from "helmet";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { securityHeaders, noSqlInjectionProtection, xssSanitization, rateLimiter, authRateLimiter, validateInput } from "./middleware/security.middleware";

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
import seoRoutes from "./seo/routes";
import reviewRoutes from "./routes/review.routes";
import uploadRoutes from "./routes/upload.routes";
import errorMiddleware from "./middleware/error.middleware";

// Initialize app
const app = express();

// --- Middleware ---

// Security headers and injection protection
app.use(securityHeaders);
app.use(noSqlInjectionProtection);
app.use(xssSanitization);

// Rate limiting
app.use(rateLimiter);
app.use("/api/auth", authRateLimiter);

// CORS - allow frontend origin
const corsOptions = {
  origin: process.env.CORS_ORIGIN || "http://localhost:3000",
  credentials: true,
  optionsSuccessStatus: 204,
};
app.use(cors(corsOptions));

// Meta webhooks require the RAW body for HMAC signature verification, so the
// raw parser must mount BEFORE the JSON parser consumes the stream.
app.use("/meta", express.raw({ type: "*/*", limit: "1mb" }));

// Body parsing with size limit
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Input validation
app.use(validateInput);

// HTTP request logging (dev in development, combined in production)
app.use(morgan(process.env.NODE_ENV === "development" ? "dev" : "combined"));

// Serve uploaded files (admin image uploads)
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// --- API Routes ---

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
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

// Meta webhooks (Instagram / Facebook) — raw body on POST
app.use("/meta", metaRoutes);

// SEO
app.use("/api/seo", seoRoutes);

// --- Frontend static serving (production) ---
// Mounted AFTER all API/meta/backend routers so it never shadows them. Only
// existing frontend build assets (js/css/img) are served; requests that miss
// fall through to the SPA fallback below.
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../frontend/build")));
}

// --- 404 / SPA fallback ---
app.use((req, res) => {
  if (req.path.startsWith("/api/")) {
    res.status(404).json({ message: "API endpoint not found" });
  } else if (req.path.startsWith("/meta/")) {
    res.status(404).json({ message: "Meta endpoint not found" });
  } else if (
    process.env.NODE_ENV === "production" &&
    req.method === "GET"
  ) {
    // SPA fallback: serve index.html ONLY for browser/frontend GET routes.
    // API and meta paths are explicitly excluded above, so index.html is
    // never returned for a backend endpoint.
    res.sendFile(path.resolve(__dirname, "../frontend/build", "index.html"));
  } else {
    res.status(404).send("Not Found");
  }
});

// --- Error Handling Middleware ---
app.use(errorMiddleware);

export default app;