# DXN NADZ — Master Implementation Plan

**Date:** 2026-11-13  
**Target Branch:** `arena/36ae59a2-web-dxn`  
**Strategy:** Incremental, non-destructive, backward-compatible enhancement of the existing Express 5 + Mongoose 9 + React 19 + Vite 8 codebase.

---

## 1. Guiding Principles

1. **Zero Data Loss & Zero Breaking Changes:** Existing MongoDB collections (`User`, `Customer`, `Product`, `ProductTranslation`, `Pack`, `Offer`, `Order`, `Wilaya`, `ShippingRate`, `Review`, `AIKnowledge`, `WebhookEvent`, `AdminNote`) keep all existing fields and semantics. All schema additions are optional/defaulted fields or new collections.
2. **Genuine Product Assets Only:** Never generate AI product images or fake packaging. Preserve existing product photography and clean fallbacks.
3. **Strict Health & Income Compliance:** Educational content strictly separates established nutritional science, ingredient research, and traditional uses, with prominent medical disclaimers. Recruitment content prohibits guaranteed-income claims and explains direct-selling compensation transparently.
4. **Optional DXN Membership on Checkout:** Guest customers buy freely without a DXN membership number. Sponsor membership number is read-only server-configured data used only on the team recruitment flow.
5. **Real Database-Backed Admin & Analytics:** Zero fabricated metrics; clean empty states when collections are empty.

---

## 2. Database & Backend Architecture Additions (Phase 13 Foundation)

### 2.1 Extended Existing Schemas (`src/Database/Models.ts`)
- **`Product`**:
  - `category`: `{ type: String, default: "general", index: true }` (normalized slug: `"supplements"`, `"cosmetics"`, `"beverages"`, `"personal-care"`, `"general"`)
  - `categoryId`: `{ type: Schema.Types.ObjectId, ref: "ProductCategory" }`
- **`ProductTranslation`**:
  - `ingredients`: `{ type: String }`
  - `usageInstructions`: `{ type: String }`
  - `storageInstructions`: `{ type: String }`
- **`Order`**:
  - `dxnMemberId`: `{ type: String, default: null }` (normalized optional customer DXN membership number; never exposed publicly)
  - `trafficSource`: `{ source: String, medium: String, campaign: String, landingPath: String, capturedAt: Date }`

### 2.2 New Mongoose Models (`src/Database/Models.ts`)
1. **`ProductCategory`**: `slug` (unique), `nameAr`, `nameFr`, `descriptionAr`, `descriptionFr`, `sortOrder`, `isActive`. Seeded idempotently with `supplements` (المكملات الغذائية), `cosmetics` (الكوسميتيك), and `beverages` (المشروبات والقهوة).
2. **`MembershipLead`**:
   - `leadReference` (unique, e.g., `LEAD-YYYYMMDD-XXXX`)
   - `firstName`, `lastName`, `country`, `phone`, `preferredContactMethod` (`"whatsapp" | "phone" | "telegram" | "email"`)
   - Optional: `email`, `existingMembershipNumber`, `message`
   - `sponsorMembershipNumber` (stamped server-side from configured owner sponsor ID — never trusted from client!)
   - `privacyConsent` (`Boolean`, required `true`), `privacyConsentAt` (`Date`)
   - CRM fields: `status` (`"new" | "contacted" | "interested" | "customer" | "registered_member" | "not_interested"`), `officialMembershipNumber`, `followUpDate`, `assignedTo` (ref `User`)
   - `trafficSource` (`source`, `ref`, `utmSource`, `utmMedium`, `utmCampaign`, `landingPath`)
   - `notes[]` (`content`, `createdBy`, `createdAt`) & `communicationHistory[]` (`channel`, `summary`, `createdBy`, `createdAt`)
3. **`ContactMessage`**:
   - `reference` (unique, e.g., `MSG-YYYYMMDD-XXXX`), `name`, `phone`, `email`, `subject`, `message`, `privacyConsent`, `status` (`"new" | "read" | "replied" | "archived"`), `adminNotes`, `trafficSource`.
4. **`NotificationLog`**:
   - `dedupKey` (unique, sparse), `eventType` (`"new_order" | "order_status" | "new_lead" | "new_contact" | "escalation"`), `referenceId`, `delivered`, `skipped`, `attempts`, `httpStatus`, `errorSummary`, `createdAt`.
5. **`SiteSettings`**:
   - Singleton document (`key: "global"`): `brandName` (`"DXN NADZ"`), `sponsorMembershipNumber`, `sponsorNameAr`, `sponsorNameFr`, `whatsappNumber`, `contactEmail`, `socialLinks` (`facebook`, `instagram`, `tiktok`, `telegram`, `whatsapp`), `telegramNotificationsEnabled` (`Boolean`, default `true`), `businessHoursAr`, `businessHoursFr`, `updatedBy`.
   - Public projection (`GET /api/settings/public`) exposes ONLY safe display config (never env secrets or tokens).
6. **`EducationalArticle`**:
   - `slug` (unique), `category` (`"ganoderma" | "spirulina" | "supplements" | "nutrition" | "usage"`), `isPublished`, `sortOrder`, bilingual `ar` & `fr` (`title`, `summary`, `scientificInfo`, `ingredientEvidence`, `traditionalUses`, `unprovenClaimsNotice`, `usageAndStorage`, `disclaimer`), `updatedBy`.
7. **`FaqItem`**:
   - `slug` (unique), `category` (`"company" | "products" | "ordering" | "membership" | "compliance"`), `sortOrder`, `isPublished`, bilingual `ar` & `fr` (`question`, `answer`).
8. **`ContentBlock`**:
   - `key` (unique: `"home"`, `"about"`, `"founder"`, `"why_dxn"`), bilingual `ar` & `fr` structured content overrides managed from Admin Content Management, merged over verified default content.
9. **`AuditLog`**:
   - `actorId` (ref `User`), `actorEmail`, `actorRole`, `action`, `resourceType`, `resourceId`, `summary`, `ip`, `createdAt`.

---

## 3. Phase-by-Phase Implementation Sequence

### Phase 1 — Design System, Brand Identity & Attribution Hook
- Update brand headers, titles, and footer to **DXN NADZ** while preserving `ar.json`/`fr.json` key parity and existing `site.ts` contracts.
- Add `AttributionContext` / `referralAttribution.ts` utility to capture `?ref=facebook|instagram|tiktok|whatsapp` and `utm_*` parameters on initial landing, persist safely in `sessionStorage`/`localStorage` (first-touch + latest-touch), and attach to orders, recruitment leads, and contact messages.
- Add floating WhatsApp button component (rendered only when a valid WhatsApp number/URL is configured, with clean fallback link to `/contact` when unconfigured).

### Phase 2 — Complete Homepage Redesign (`HomePage.tsx`)
- Upgrade Hero section with **DXN NADZ**, Arabic headline `"اكتشف عالم DXN"`, subtitle `"منتجات متنوعة، معرفة موثوقة، وفرصة لتطوير نشاطك التجاري."`, primary CTA `"اكتشف المنتجات"` (`/products`), secondary CTA `"انضم إلى فريقنا"` (`/join`), and genuine DXN product photography when available.
- Implement all 13 functional homepage sections:
  1. Hero banner
  2. Featured products
  3. Product categories (`الكل`, `المكملات الغذائية`, `الكوسميتيك`, etc. linking directly to `/products?category=...`)
  4. Why DXN? (`لماذا يختار الكثيرون DXN؟`)
  5. About DXN preview -> `/about`
  6. Meet the Founder preview -> `/founder`
  7. Product Education preview -> `/education`
  8. How DXN Business Works -> `/join`
  9. Join Our Team banner -> `/join`
  10. Frequently Asked Questions preview -> `/faq`
  11. Customer Testimonials (strictly from published DB `Review` records; hidden or honest empty note when none exist — zero fake testimonials!)
  12. Contact section -> `/contact`
  13. Professional footer (`Footer.tsx`)

### Phase 3 & Phase 12 — Company Info, Founder, Education Center, FAQ & Contact Pages
- `/about` (`AboutDxnPage.tsx`): `"من هي شركة DXN؟"` — Malaysia founding (1993 by Datuk Dr. Lim Siow Jin), One Dragon philosophy (cultivation, processing, distribution), international direct-selling operations, accurate quality & manufacturing overview without invented stats.
- `/founder` (`FounderPage.tsx`): `"تعرّف على مؤسس DXN"` — Datuk Dr. Lim Siow Jin biography, academic engineering background, Ganoderma research focus, 1993 founding of DXN in Kedah, Malaysia, business philosophy, verified milestones only (no unverified poster claims, clean typographic/editorial emblem when licensed portrait is not uploaded by admin, plus admin ability to upload an authentic licensed portrait via CMS).
- `/why-dxn` (`WhyDxnPage.tsx`): `"لماذا يختار الكثيرون DXN؟"` — Malaysian origin & global reach, diverse portfolio, integrated manufacturing, product accessibility, direct-selling structure, team mentorship.
- `/education` & `/education/:slug` (`EducationCenterPage.tsx`): Dedicated health-compliant educational center covering all 10 required topics (Ganoderma, Spirulina, Dietary Supplements, Vitamins & Minerals, Dietary Fiber, Antioxidants, Ingredients & Nutrition, Correct Usage, Product Storage, Educational FAQs). Every article explicitly separates:
  - ما أثبتته المصادر العلمية عن العناصر الغذائية (Scientifically established info)
  - الدراسات حول المكونات المحددة (Ingredient-specific evidence)
  - الاستخدامات التقليدية والتاريخية (Traditional/historical uses)
  - ادعاءات غير مثبتة يجب تجنبها (Unproven claims notice)
  - تنبيه صحي رسمي (Mandatory health disclaimer: supplements are not medicines and do not diagnose, treat, cure, or prevent diseases).
- `/faq` (`FaqTrustPage.tsx`): Searchable FAQ & Trust Center covering all 10+ core questions plus privacy, terms of use, and health compliance disclaimers.
- `/contact` (`ContactPage.tsx`): Validated contact request form with rate-limiting, honeypot spam protection, DB persistence (`ContactMessage`), Telegram notification (`DXN NADZ — NEW CONTACT REQUEST`), and configurable social channels.

### Phase 4 & Phase 5 — Product Catalog Filters, Search, Details & Optional Checkout Membership
- Extend `/api/products` and `/api/categories` to support category filtering (`all`, `supplements`, `cosmetics`, plus dynamic DB categories) and search by name/description/SKU without full page reloads.
- Enhance `ProductListPage.tsx` with instant category filter pills (`الكل`, `المكملات الغذائية`, `الكوسميتيك`, + dynamic categories) and live search bar.
- Enhance `ProductDetailPage.tsx` with ingredients, specifications, official usage/storage instructions, health disclaimer for supplements, related products from the same category, and WhatsApp product inquiry button (when WhatsApp is configured).
- Enhance `CheckoutPage.tsx` and `POST /api/orders` with optional `"رقم عضوية DXN (اختياري)"` (placeholder `"أدخل رقم عضويتك إن وجد"`):
  - Never mandatory; empty saves as `null`.
  - Normalized alphanumeric/digits format (`6–20` chars when provided), stripped from public responses, visible in Admin Order details and owner's private Telegram order notification.

### Phase 6 & Phase 7 — DXN Recruitment Landing Page (`/join`) & Admin CRM
- `/join` (`JoinTeamPage.tsx`): `"انضم إلى فريق DXN NADZ"`
  - Transparent explanation of direct selling, customer vs. distributor distinction, onboarding steps, team support, no-guaranteed-income compliance notice, FAQs.
  - Displays read-only server-configured `sponsorMembershipNumber` (shows clear placeholder notice `"يُحدَّد رقم الراعي من إعدادات الإدارة"` until owner sets their real DXN ID, never editable by visitors, never confused with new member ID).
  - Validated recruitment form: `firstName`, `lastName`, `country`, `phone`, `preferredContactMethod` (required); `email`, `existingMembershipNumber`, `message` (optional); `privacyConsent` checkbox (required); honeypot anti-spam field.
  - Server workflow (`POST /api/leads`): rate-limited, validates input, stamps server-side sponsor number, generates unique `LEAD-...` reference, records `trafficSource`, saves to `MembershipLead`, sends `DXN NADZ — NEW MEMBERSHIP LEAD` Telegram alert, returns confirmation screen with lead reference.
- Admin CRM (`/admin/leads` — `AdminLeadsPage.tsx` & `/admin/customers` — `AdminCustomersPage.tsx`):
  - Full 6-status pipeline (`new`, `contacted`, `interested`, `customer`, `registered_member`, `not_interested`).
  - Search & filter by status, country, traffic source, and date range.
  - Lead detail drawer/modal: update status, record `officialMembershipNumber` after real DXN registration, set `followUpDate`, add private notes, log communication history.
  - Clear classification badges distinguishing **Store Customers**, **Recruitment Leads**, **Existing DXN Members** (customers/leads who supplied an existing DXN ID), and **Registered Team Members** (`status === "registered_member"`).
  - Secure CSV export (`GET /api/admin/leads/export.csv`) with UTF-8 BOM and formula-injection protection, RBAC-gated to `owner`/`admin` and audit-logged.

### Phase 8, 9, 10, 11 — Telegram Reliability, Referral Analytics, Admin CMS & Settings
- Upgrade `telegram.service.ts` with:
  - `DXN NADZ — *NEW ORDER*` (including optional `dxnMemberId` and `trafficSource` when present)
  - `DXN NADZ — *NEW MEMBERSHIP LEAD*`
  - `DXN NADZ — *NEW CONTACT REQUEST*`
  - Duplicate notification guard + `NotificationLog` persistence (best-effort DB write that never crashes DB-free unit tests or order/lead creation).
- Upgrade `/admin` (`AdminDashboardPage.tsx` & `dashboard.controller.ts`):
  - Real DB metrics: Total Orders, New Orders, Total Customers, New Leads, Contacted Leads, Interested Leads, Officially Registered Members, Lead-to-Member Conversion Rate, Realized Revenue, Traffic Source breakdown (Orders & Leads by `?ref=` source), Notification delivery summary.
- Upgrade `AdminProductsPage.tsx`: Category selector (`supplements`, `cosmetics`, `beverages`, `personal-care`, `general`), bilingual `ingredients` and `usageInstructions`.
- Upgrade `AdminOrdersPage.tsx`: Display optional customer `dxnMemberId` and `trafficSource` in order detail modal + search by membership number.
- Add `/admin/messages` (`AdminMessagesPage.tsx`): View & manage contact form inquiries.
- Add `/admin/content` (`AdminContentPage.tsx`): Manage educational articles, FAQs, and homepage/about/founder content overrides.
- Add `/admin/settings` (`AdminSettingsPage.tsx`): Configure Sponsor Membership Number, WhatsApp contact, Facebook/Instagram/TikTok/Telegram URLs, business info, and view Telegram env configuration status (`configured: true/false` boolean only — secrets never exposed).

### Phase 14, 15, 16, 17, 18 — Security Hardening, SEO, QA Suite & Release Documentation
- Admin `AuditLog` middleware/helper on sensitive mutations (settings updates, product edits, order status changes, lead status/membership updates, CSV exports).
- Rate limiters & honeypot spam protection on public `/api/leads` and `/api/contact`.
- Dynamic `<Helmet>` SEO metadata, Open Graph, canonical URLs, JSON-LD (`Organization`, `Product`, `FAQPage`, `Article`), updated `sitemap.xml` and `robots.txt` (`/admin`, `/api/`, `/meta/`, `/cart`, `/checkout` disallowed).
- Comprehensive automated test suites (unit + Supertest HTTP integration + security + regression) verifying every workflow and confirming all existing tests continue to pass.
- Complete release documentation (`DXN_NADZ_DEPLOYMENT_GUIDE.md`, `DXN_NADZ_ENVIRONMENT_VARIABLES.md`, `DXN_NADZ_QA_REPORT.md`, `DXN_NADZ_RELEASE_CHECKLIST.md`).
