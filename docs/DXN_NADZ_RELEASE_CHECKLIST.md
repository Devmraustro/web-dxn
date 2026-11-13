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
- [x] GitHub Actions run completes successfully on the release candidate — **verified** on branch (`43505777616`), PR #2 (`43505816912`), and `main` at release SHA `f8c361c` (`43505988666`); all `success`.

**Test-count note:** The current final-audit split is 165 unit + 319 AI/integration = 484 tests. Older 441-test documentation used a different historical grouping and has been superseded.

---

## 2. Vercel Production Cutover Checklist

### ✅ Completed (2026-11-13 — see `docs/DXN_NADZ_PRODUCTION_DEPLOYMENT_REPORT.md`)

- [x] **1. Verify Vercel Environment Variables** — `MONGODB_URI`, `JWT_SECRET`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, Cloudinary, CORS, `BASE_URL`, `STORE_URL_BASE`, Meta and shipping env keys confirmed present as production secrets.
- [x] **2. Release Branch & Deploy** — PR #2 merged into `main` at `f8c361c`; CI green on branch/PR/main; Vercel production deployment `dpl_HTjuHpQnDuDQ5btZKxzKsLrryaGx` is **READY/PROMOTED** at https://dxnnadz.vercel.app. Live-verified: `GET /api/health` (`db: connected`), `GET /robots.txt`, `GET /sitemap.xml`, homepage, catalog (32 products), product detail, 69-wilaya shipping endpoint, and admin RBAC (401 without token).
- [x] **4. Product Catalog** — 32 genuine DXN products already live with real Cloudinary images, DZD prices, and PV points. Remaining: owner content accuracy review.
- [x] **6. Production Database Migration** — 69-wilaya reconciliation applied additively and verified live in production; existing courier coverage/rates and the 32-product catalog preserved (non-destructive). Maintenance-window backup still recommended.

### ⬜ Remaining Owner Actions

- [ ] **3. Configure Owner Identity in `/admin/settings`**
  - Sign in at `/admin/login`.
  - Enter the official DXN Sponsor Membership Number, WhatsApp number, and real social profile URLs (public settings currently show `sponsorConfigured: false`).
  - Save and verify `/join` displays the correct sponsor number and working copy action.

- [ ] **5. Run Live Smoke Tests**
  - Submit a test team join request; verify confirmation, Telegram receipt, CRM entry, source attribution, and CSV export.
  - Submit a test COD order both with and without optional DXN Member ID; verify confirmation, Telegram receipt, and admin order visibility.
  - Archive or clearly mark smoke-test entries. (Order creation/persistence/notification logic is covered by 484 automated tests; these two steps confirm live end-to-end delivery from a browser.)

- [ ] **7. Verify Account Recovery**
  - Configure an SMTP/email provider and test the complete forgot-password and reset-password flow.
  - Until this passes, do not advertise password recovery as available.

- [ ] **8. Verify Telegram Live Delivery**
  - Run the live verification from a production-equivalent runtime with outbound access.
  - Confirm order, lead, and contact notifications arrive in the intended private chat without exposing secrets.
