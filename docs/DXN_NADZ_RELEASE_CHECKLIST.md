# DXN NADZ — Production Release & Owner Launch Checklist

## 1. Pre-Deploy Engineering Checklist
- [x] Full rebrand to **DXN NADZ** across HTML metadata, header, footer, mobile navigation, privacy policy, and bilingual locales (`ar.json` / `fr.json` parity verified).
- [x] 13-section Homepage and public information, education, product, join, FAQ, contact, cart, checkout, and privacy routes.
- [x] Mandatory health/dietary supplement disclaimers and ethical recruitment disclosures.
- [x] Optional DXN Membership ID field wired through checkout, order persistence, and notification payload.
- [x] Team Recruitment CRM with pipeline, official membership number assignment, follow-up dates, private notes, communication log, and CSV export.
- [x] Admin CMS and Dynamic Site Settings with audit logging.
- [x] Arena-reported local verification: `npm run typecheck`, `npm run build`, `npm run test:unit` (165/165), and `npm run test:ai` (319/319).
- [x] GitHub Actions workflow added at `.github/workflows/ci.yml` on the Arena branch.
- [ ] GitHub Actions run completes successfully on the release candidate (not yet independently verified).

**Test-count note:** The current final-audit split is 165 unit + 319 AI/integration = 484 tests. Older 441-test documentation used a different historical grouping and has been superseded.

---

## 2. Vercel Production Cutover Checklist (For Platform Owner)

- [ ] **1. Verify Vercel Environment Variables**
  - Confirm `MONGODB_URI` and `JWT_SECRET` (at least 32 characters) are set in Vercel Production.
  - Confirm `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` are configured as server-side secrets.
  - Confirm optional sponsor and WhatsApp settings are configured in Vercel or `/admin/settings`.

- [ ] **2. Release Branch & Deploy**
  - Merge the approved release branch into `main` only after CI and operational acceptance gates pass.
  - Verify `GET /api/health`, `GET /robots.txt`, and `GET /sitemap.xml` on the production domain.

- [ ] **3. Configure Owner Identity in `/admin/settings`**
  - Sign in at `/admin/login`.
  - Enter the official DXN Sponsor Membership Number, WhatsApp number, and real social profile URLs.
  - Save and verify `/join` displays the correct sponsor number and working copy action.

- [ ] **4. Populate Genuine DXN Product Catalog in `/admin/products`**
  - Upload genuine DXN product photos, accurate DZD prices, stock quantities, PV points, categories, ingredients, and official usage/storage instructions in Arabic and French.

- [ ] **5. Run Live Smoke Tests**
  - Submit a test team join request; verify confirmation, Telegram receipt, CRM entry, source attribution, and CSV export.
  - Submit a test COD order both with and without optional DXN Member ID; verify confirmation, Telegram receipt, and admin order visibility.
  - Archive or clearly mark smoke-test entries.

- [ ] **6. Verify Production Database Migration**
  - Back up the production database.
  - Run the 69-wilaya migration once in the approved maintenance window.
  - Verify existing courier coverage and shipping rates remain intact and new wilayas receive expected defaults.

- [ ] **7. Verify Account Recovery**
  - Configure an SMTP/email provider and test the complete forgot-password and reset-password flow.
  - Until this passes, do not advertise password recovery as available.

- [ ] **8. Verify Telegram Live Delivery**
  - Run the live verification from a production-equivalent runtime with outbound access.
  - Confirm order, lead, and contact notifications arrive in the intended private chat without exposing secrets.
