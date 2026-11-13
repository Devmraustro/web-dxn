# DXN NADZ — Production Release & Owner Launch Checklist

## 1. Pre-Deploy Engineering Checklist (Completed)
- [x] Full rebrand to **DXN NADZ** across HTML metadata, header, footer, mobile navigation, privacy policy, and bilingual locales (`ar.json` / `fr.json` parity verified).
- [x] 13-section Homepage + `/about`, `/founder`, `/why-dxn`, `/education`, `/education/:slug`, `/products`, `/product/:slug`, `/join`, `/faq`, `/contact`, `/cart`, `/checkout`, and `/privacy`.
- [x] Mandatory health/dietary supplement disclaimers and ethical recruitment disclosures active on all product, educational, and recruitment pages.
- [x] Optional DXN Membership ID field (`رقم عضوية DXN (اختياري)`) wired end-to-end on `/checkout` -> `Order` -> Telegram notification -> `/admin/orders`.
- [x] Team Recruitment CRM (`/admin/leads`) with 4 segment counters, status pipeline, official DXN membership number assignment, follow-up dates, private notes, communication log, and secure CSV export.
- [x] Admin CMS (`/admin/content`) and Dynamic Site Settings (`/admin/settings`) with audit logging.
- [x] `npm run typecheck`, `npm run build`, and 441 automated Jest tests passing.

---

## 2. Vercel Production Cutover Checklist (For Platform Owner)

- [ ] **1. Verify Vercel Environment Variables**
  - Confirm `MONGODB_URI` and `JWT_SECRET` (`>= 32` chars) are set in Vercel Production environment.
  - Set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` for instant private Telegram alerts.
  - Optionally set `DXN_SPONSOR_MEMBER_ID` and `STORE_WHATSAPP_NUMBER` (or configure them directly in `/admin/settings` after deploy).

- [ ] **2. Merge & Deploy to Vercel**
  - Merge branch into `main` (or promote preview deployment in Vercel).
  - Verify `GET /api/health` returns `200 OK` and `GET /robots.txt` + `GET /sitemap.xml` load cleanly.

- [ ] **3. Configure Owner Identity in `/admin/settings`**
  - Log in at `/admin/login`.
  - Open `/admin/settings` and enter:
    - Official **DXN Sponsor Membership Number**
    - Official **WhatsApp Number**
    - Real **Facebook / Instagram / TikTok / Telegram** links (leave unlaunched channels empty so they remain hidden)
  - Save and verify `/join` displays your Sponsor Membership Number with working **Copy** button.

- [ ] **4. Populate Genuine DXN Product Catalog in `/admin/products`**
  - Upload real DXN product photos, accurate DZD prices, stock quantities, DXN PV points, categories, ingredients, and official usage/storage instructions in Arabic and French.

- [ ] **5. Run Live Smoke Tests**
  - Submit one test **Team Join Request** at `/join?ref=instagram` -> verify `LEAD-...` confirmation, Telegram alert receipt, `/admin/leads` appearance with `instagram` source badge, and CSV export download.
  - Submit one test **COD Order** at `/checkout` (with optional DXN Member ID) -> verify `ORD-...` confirmation, Telegram alert receipt, and `/admin/orders` status update.
  - Archive or mark the two smoke-test entries in `/admin/leads` and `/admin/orders`.
