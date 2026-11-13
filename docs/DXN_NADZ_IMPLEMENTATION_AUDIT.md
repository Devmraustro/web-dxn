# DXN NADZ — Phase 0 Mandatory Repository Audit

**Date:** 2026-11-13  
**Repository:** `Devmraustro/web-dxn`  
**Branch:** `arena/36ae59a2-web-dxn` (branched from `main` @ `828430cf2ed71cdc4ccfab426dcf71253163c16a`)  
**Scope:** Complete engineering audit prior to implementing the DXN NADZ E-Commerce, Brand Education, Customer Acquisition, CRM & Network Management enhancements.

---

## 1. Frontend & Backend Architecture Overview

`web-dxn` is a unified TypeScript monorepo combining a **Node.js + Express 5 REST API** (`src/backend`) and a **React 19 + Vite 8 Single-Page Application** (`src/frontend`), served from a single origin in production and packaged for **Vercel serverless functions** (`api/index.js` -> compiled `dist/index.js` + static `dist/frontend/build`).

| Layer | Location | Technology | Role |
|---|---|---|---|
| Serverless Entry | `api/index.js`, `src/index.ts` | `@vercel/node` CommonJS handler | Wraps Express `app`; caches MongoDB connection (`ensureDB()`); serves static/health/robots paths without DB; returns safe `503` when DB is unreachable |
| Traditional Server Entry | `src/backend/index.ts` | Node.js HTTP listener | Used for local dev (`npm run dev` via `ts-node`) and Docker (`Dockerfile`, `docker-compose.yml`) |
| Backend API | `src/backend/` | Express `^5.2.1`, TypeScript `^5.6.3` | REST endpoints under `/api/*`, Meta webhooks under `/meta/*`, SEO endpoints (`/robots.txt`, `/sitemap.xml`) |
| Database / ODM | `src/Database/Models.ts`, `src/backend/db.ts` | MongoDB + Mongoose `^9.9.4` | Single-connection cached promise; schema definitions for commerce, users, reviews, AI/Meta, notes |
| Validation & Security | `src/backend/middleware/` | `yup` `^1.7.1`, `helmet` `^8.3.0`, `express-rate-limit` `^8.6.2`, `bcrypt` `^6.0.0`, `jsonwebtoken` `^9.0.3` | Input validation, NoSQL operator stripping, rate limiting, JWT RBAC (`owner`, `admin`, `staff`, `support`), magic-byte image verification |
| Frontend SPA | `src/frontend/` | React `^19.2.8`, React Router `^7.18.2`, React-Bootstrap `^2.10.10`, Bootstrap `^5.3.8`, Formik `^2.4.9`, `i18next` `^26.4.0`, `react-helmet-async` `^3.0.0` | Arabic-first (`dir="rtl"`) + French (`dir="ltr"`) responsive storefront and `/admin` back-office |
| AI & Social Sales | `src/backend/ai/` | Deterministic + OpenAI/Anthropic orchestrator | Guardrailed sales assistant & Meta (Facebook/Instagram) webhook pipeline |

---

## 2. Existing Database Models (`src/Database/Models.ts`)

1. **`User`**: `email` (unique), `password` (bcrypt), `role` (`"owner" | "admin" | "staff" | "support"`), `name`, `phone`, `isActive`, `lastLogin`, `passwordResetTokenHash`, `passwordResetExpiresAt`.
2. **`Customer`**: `userId` (ref `User`), `firstName`, `lastName`, `phone`, `secondPhone`, `wilaya`, `commune`, `address`, `orders[]`.
3. **`Product`**: `sku` (unique), `slug` (unique), `price`, `compareAtPrice`, `image`, `images[]`, `isActive`, `isFeatured`, `sortOrder`, `stockQuantity`, `points` (DXN PV/points). *Note: Does not yet have an explicit `category` / `categoryId` field, though `ProductCard.tsx` already reads `product.category || product.sku || "DXN"`!*
4. **`ProductTranslation`**: `productId` (ref `Product`), `language` (`"ar" | "fr"`), `title`, `description`, `size`, `specifications`, `metaTitle`, `metaDescription`. *Note: Does not yet store separate `ingredients` or `usageInstructions`, though `specifications` exists.*
5. **`Pack` & `PackItem`**: Product bundles with component `productId` and `quantity`.
6. **`Offer`**: `title`, `slug`, `type` (`"percentage" | "fixed" | "promotional"`), `value`, `isActive`, `startDate`, `endDate`, `productId`, `packId`.
7. **`Order`**: `orderNumber` (unique), `customerId`, `customerInfo` (`firstName`, `lastName`, `phone`, `secondPhone`, `wilaya`, `commune`, `address`), `deliveryMethod` (`"home" | "office"`), `paymentMethod` (`"cod" | "baridimob"`), `paymentStatus`, `status` (`"new" | "pending_payment" | "confirmed" | "processing" | "shipped" | "delivered" | "cancelled" | "rejected"`), `subtotal`, `shippingFee`, `discount`, `total`, `items[]`, `internalNotes`, `adminId`, `metadata` (stores `idempotencyKey` and `stockClaims`). *Note: Does not yet store optional `dxnMemberId` / customer membership number or `trafficSource` / referral attribution.*
8. **`Wilaya` & `ShippingRate`**: Canonical 58 Algerian wilayas (`src/backend/data/algerianWilayas.ts`) and per-wilaya home/office rates.
9. **`Review`**: `productId`, `customerName`, `customerId`, `rating` (1–5), `title`, `content`, `images[]`, `isPublished`.
10. **`AIKnowledge`, `Conversation`, `Message`, `SocialAccount`, `WebhookEvent`**: AI assistant KB, Meta conversations, and webhook deduplication (`dedupKey` unique sparse index).
11. **`AdminNote`**: `title`, `message`, `type`, `relatedModel`, `relatedId`, `createdBy`.

**Missing Entities Needed for Full DXN NADZ Platform:**
- **`ProductCategory`** (or normalized category slug + bilingual labels, linked non-destructively to `Product` via optional `category` slug & `categoryId`, supporting `supplements`, `cosmetics`, `beverages`, `personal-care`, etc., while keeping existing products intact).
- **`MembershipLead`** (recruitment leads with unique `leadReference`, `firstName`, `lastName`, `country`, `phone`, `preferredContactMethod`, optional `email`, optional `existingMembershipNumber`, `sponsorMembershipNumber`, `message`, `privacyConsent`, `status` enum `new | contacted | interested | customer | registered_member | not_interested`, `officialMembershipNumber`, `followUpDate`, `source`/`referral`, `communicationHistory[]`).
- **`ContactMessage`** (storefront contact inquiries with `reference`, `name`, `phone`, `email`, `subject`, `message`, `source`, `status`, `privacyConsent`).
- **`NotificationLog`** (auditable log of Telegram notifications for orders, membership leads, and contact requests, with `dedupKey` unique sparse index, `eventType`, `relatedId`, `delivered`, `skipped`, `attempts`, `statusCode`, `errorMessage` — never storing bot tokens).
- **`SiteSettings`** (singleton/keyed DB-backed configuration for `sponsorMembershipNumber`, `whatsappNumber`, `socialLinks` (`facebook`, `instagram`, `tiktok`, `telegram`, `whatsapp`), `businessInfo`, `telegramNotificationsEnabled`, editable by `owner`/`admin` without exposing secret tokens).
- **`ContentEntry` / `Article` & `FAQ`** (DB-backed educational articles, company/founder content overrides, and searchable bilingual FAQs with safe seed defaults so pages work both with and without DB records).
- **`AuditLog`** (admin security audit trail recording actor `userId`/`role`, `action`, `targetModel`, `targetId`, `summary`, `ip`, `createdAt`).

---

## 3. Existing Pages, Components & API Endpoints

### Frontend Pages (`src/frontend/src/pages/`)
- `/` — `HomePage.tsx`: Hero, trust strip, featured products, offers band, discovery cards, trust cards, 4-step how-to-order, final CTA.
- `/products` — `ProductListPage.tsx`: Hero, trust strip, product grid (lacks client/API category tabs `الكل / المكملات الغذائية / الكوسميتيك` and search bar UI).
- `/product/:slug` — `ProductDetailPage.tsx`: Breadcrumb, image gallery, price, DXN points, size, description, add-to-cart, published reviews (lacks specifications/usage display, related products, WhatsApp inquiry button, structured data/Helmet SEO).
- `/cart` — `CartPage.tsx`: Live catalog reconciliation, quantity controls, DXN points sum, subtotal.
- `/checkout` — `CheckoutPage.tsx`: Formik + Yup validation, canonical wilaya dropdown, shipping fee calculation, COD payment, `Idempotency-Key` header (lacks optional DXN membership number field and traffic source attribution attachment).
- `/order-confirmation/:orderNumber` — `OrderConfirmationPage.tsx`: Post-checkout confirmation screen.
- `/privacy` — `PrivacyPolicyPage.tsx`: Bilingual privacy policy (note: contains a `<Link to="/contact">` button, while `/contact` route does not yet exist — currently redirects to `/` via wildcard!).
- `/admin/login` — `AdminLoginPage.tsx`: Admin JWT login.
- `/admin` — `AdminDashboardPage.tsx`: Total orders, pending, confirmed, delivered, revenue, recent orders, top products, top wilayas.
- `/admin/products` — `AdminProductsPage.tsx`: Create/edit products, SKU, slug, price, stock, DXN points, image upload, AR/FR translations.
- `/admin/orders` — `AdminOrdersPage.tsx`: Paginated orders, search, status/payment filters, status transitions, order detail modal.
- `/admin/reviews` — `AdminReviewPage.tsx`: Admin review CRUD + screenshot upload.

### Backend API Routes (`src/backend/routes/`)
- `/api/health`: Verbose safe DB readiness check.
- `/api/products`: `GET /`, `GET /slug/:slug`, `GET /:id`, `POST /`, `PUT /:id`, `DELETE /:id`, `PATCH /:id/toggle-featured`.
- `/api/orders`: `GET /` (admin), `GET /:id` (owner/admin), `POST /` (public guest checkout with idempotency + atomic stock decrement), `PUT /:id/status` (admin with atomic restock on cancel/reject).
- `/api/shipping`: Wilayas & `/calculate`.
- `/api/packs`, `/api/offers`, `/api/reviews`, `/api/upload`, `/api/users`, `/api/ai`, `/api/seo`, `/meta`.
- `/api/admin`: `/dashboard/stats`, `/dashboard/recent-orders`, `/dashboard/revenue`, `/dashboard/top-products`, `/dashboard/top-wilayas`, `/catalog`, `/products/:id`.

---

## 4. Existing Cart, Checkout, Order & Telegram Workflows

1. **Cart (`CartContext.tsx` + `cartReconcile.ts`)**: Persisted in `localStorage` (`dxn_cart`). Reconciled against `/api/products` and `/api/packs` before checkout; transient network errors do not wipe the cart.
2. **Checkout (`CheckoutPage.tsx` -> `POST /api/orders`)**:
   - Validates Algerian mobile numbers (`05/06/07` + 8 digits).
   - Sends `Idempotency-Key` header.
   - Server (`order.controller.ts` + `commerce.ts`) ignores client prices, resolves server prices, active offers, strict wilaya shipping fees, atomically decrements `Product.stockQuantity`, upserts `Customer` by phone, saves `Order`, and triggers `sendNewOrderNotification(order)` best-effort.
3. **Telegram (`src/backend/services/telegram.service.ts`)**:
   - Uses `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` exclusively from `process.env`.
   - Implements bounded exponential-backoff retry (`maxAttempts: 3`), legacy Markdown escaping (`_`, `*`, `` ` ``, `[`), token redaction in logs (`bot[redacted]`), 4000-byte truncation, and safe `skipped: true` no-op when unconfigured.
   - Currently supports `sendNewOrderNotification`, `sendOrderStatusUpdate`, `sendEscalationNotification`, and `telegramSinkAdapter`.
   - Needs extension for: optional customer `dxnMemberId` in order notifications, `DXN NADZ — NEW MEMBERSHIP LEAD`, `DXN NADZ — NEW CONTACT REQUEST`, duplicate notification protection, and `NotificationLog` persistence.

---

## 5. Deployment Environment & Vercel Inspection

- **Vercel Project Inspected (Read-Only):** `web-dxn` (`prj_JuKLWDNO7XfVqW3nJHj2fPI3Hxjk`), production domain alias `https://dxnnadz.vercel.app`.
- **Build Pipeline:** `npm run build` runs `tsc -p tsconfig.json && vite build --config src/frontend/vite.config.ts`, outputting backend JS to `dist/` and SPA assets to `dist/frontend/build`.
- **Configured Vercel Production Env Keys (names only, secrets encrypted):** `MONGODB_URI`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `CORS_ORIGIN`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `STORAGE_PROVIDER`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `BASE_URL`, `STORE_URL_BASE`, `AI_PROVIDER`, `META_*`, `DEFAULT_SHIPPING_HOME`, `DEFAULT_SHIPPING_OFFICE`.
- **New Optional Env Keys to Support (with DB `SiteSettings` fallback):** `DXN_SPONSOR_MEMBER_ID` (owner's sponsor membership number), `STORE_WHATSAPP_NUMBER`, `VITE_TIKTOK_URL`, `VITE_TELEGRAM_URL`, `VITE_WHATSAPP_URL` (plus dynamic runtime loading via public `/api/site-settings/public` so the owner can update social links, WhatsApp, and sponsor ID from `/admin/settings` without rebuilding!).

---

## 6. Baseline Test & Build Audit

Executed prior to any code changes:
- `npm run typecheck`: **PASS** (0 TypeScript errors).
- `npm run build`: **PASS** (Backend `tsc` + Frontend `vite build` succeeded cleanly in 558ms).
- `META_PAGE_ID=test_page_id_123456789 npx jest --config jest.ai.config.js --runInBand`: **PASS** (13/13 suites, 319/319 tests). *Note: `jest.ai.config.js` lacks `META_PAGE_ID` default when invoked standalone without env; we will ensure non-breaking test reliability.*
- `npx jest --config jest.unit.config.js --runInBand`: **PASS** (3/3 suites, 56/56 tests).
- DB-free integration/unit suites (`phase23-product-admin.dbfree.test.ts`, `telegram.service.test.ts`, `meta-webhook-verification.test.ts`, `upload-wiring.test.ts`, `storage.signature.test.ts`, `slug.test.ts`, `seedEnv.test.ts`, `placeholderClassification.test.ts`, `cartReconcile.test.ts`, `languageSwitcher.test.ts`): **PASS**.
- Local MongoDB binary (`mongod`): Not installed in this sandbox (`BLOCKED_BY_ENVIRONMENT` for live-Mongo suites, matching `FINAL-PRODUCTION-AUDIT.md`). All new backend controllers/services will therefore have comprehensive **DB-free Supertest + mocked-model integration tests** and **pure unit tests** in addition to Mongoose schema/migration validation.

---

## 7. Open-Source Component & Dependency Evaluation

Searched GitHub (`gh search repos`) and audited `package.json`:
- **Rate Limiting:** `express-rate-limit` (MIT, v8.6.2) is already installed — reuse for endpoint-specific rate limiters on `/api/leads` and `/api/contact` (spam/abuse protection).
- **CSV Export:** Evaluated `zemirco/json2csv` & `juanjoDiaz/json2csv` (MIT). Because `package.json` should avoid unnecessary dependencies (Execution Rule 7) and already has 0 CSV dependencies, a dedicated internal RFC-4180 serializer with UTF-8 BOM (`\uFEFF` for Arabic Excel compatibility) and formula-injection sanitization (`=`, `+`, `-`, `@`, `\t`, `\r`) is safer, smaller, and zero-dependency.
- **Forms & Validation:** `formik` + `yup` are already installed and used in `CheckoutPage.tsx` and backend `validationSchema.ts` — reuse across Recruitment, Contact, Checkout, and Admin forms.
- **SEO Head Management:** `react-helmet-async` (v3.0.0) is already installed and used in `PrivacyPolicyPage.tsx` — reuse across all public pages for title, description, canonical, Open Graph, and JSON-LD structured data.

---

## 8. Potential Conflicts & Regression Hazards Identified (Must Guard)

1. **`launch-prep.test.ts` Locale Key Parity:** Asserts `Object.keys(ar.json).sort()` equals `Object.keys(fr.json).sort()` and checks `contactUs`, `email`, `facebook`, `instagram`, `paymentOnDelivery`. **Rule:** Every key added to `ar.json` MUST be added identically to `fr.json`.
2. **`launch-prep.test.ts` `site.ts` Contract:** Asserts `STORE_EMAIL === "dxntraveldz@gmail.com"` and `readSiteSocialConfig()` returns `undefined` for unconfigured build-time env vars (never fake URLs). **Rule:** Preserve `STORE_EMAIL`, `STORE_EMAIL_MAILTO`, and `readSiteSocialConfig()` behavior in `src/frontend/src/config/site.ts`.
3. **`telegram.service.test.ts` Header Substring:** Asserts `expect(text).toContain("*NEW ORDER*")` on `sendNewOrderNotification`. **Rule:** Format new order header as `🛒 DXN NADZ — *NEW ORDER*` so it satisfies both Phase 8.1 (`DXN NADZ — NEW ORDER`) and the existing test assertion (`*NEW ORDER*`).
4. **`commerce-unit.test.ts` & `security-fixes-v2.test.ts` SEO Contracts:** Assert `generateRobotsTxt()` defaults to `https://dxn.dz/sitemap.xml`, disallows `/admin`, `/api/`, `/meta/`, and `generateSitemap()` never includes `/shipping` or `?wilaya=` or placeholder seed products. **Rule:** Only add real, existing public routes (`/about`, `/founder`, `/why-dxn`, `/education`, `/join`, `/faq`, `/contact`, `/privacy`) to `generateSitemap()` and keep `generateRobotsTxt()` default parameter backward-compatible.
5. **Placeholder Catalog Guard (`placeholderCatalog.service.ts`):** `STARTER_PRODUCTS` in `dxnCatalog.ts` are intentionally treated as seed placeholders hidden from public `/api/products` unless admin-created products exist. **Rule:** Do NOT alter `PLACEHOLDER_PRODUCT_IDENTIFIERS` or weaken `withPublicReadScope`! Build category filtering cleanly on `Product` + `ProductCategory` so real admin products and category filters work seamlessly.
6. **Serverless Cold-Start Safety (`src/index.ts`):** Do not perform filesystem writes at module import time. Keep public read-only static/health endpoints safe when MongoDB is unavailable.
