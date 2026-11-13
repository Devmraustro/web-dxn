# DXN NADZ — Production Deployment Guide (Vercel + MongoDB Atlas + Telegram)

## 1. Architecture Overview

**DXN NADZ** runs as a unified TypeScript monorepo optimized for **Vercel Serverless Functions** + **Static SPA Edge Delivery**:

- **Frontend (`src/frontend/`)**: React 19 + Vite 8 + Bootstrap 5 + `react-helmet-async`, compiled into `dist/frontend/build/` with route-level lazy code splitting (`< 27 kB` per page chunk).
- **Backend (`src/backend/` & `src/index.ts`)**: Express 5 + Mongoose 9, compiled into `dist/index.js` and invoked on Vercel via `api/index.js`.
- **Database**: MongoDB Atlas (`MONGODB_URI`), using warm-invocation connection caching (`ensureDB()`).
- **Instant Owner Alerts**: Telegram Bot API (`TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID`) for new COD orders, team recruitment leads, and contact inquiries.

---

## 2. Step-by-Step Deployment on Vercel

### Step 1: Prepare MongoDB Atlas
1. Create or open your MongoDB Atlas cluster (M0 Free or M10+ Production).
2. Under **Database Access**, create a dedicated user with `readWrite` permissions on the `dxn_nadz` (or `dxn_store`) database.
3. Under **Network Access**, allow Vercel serverless egress (`0.0.0.0/0` with strong credentials, or Vercel Static IPs if on Enterprise).
4. Copy the connection string (`mongodb+srv://<user>:<password>@<cluster>.mongodb.net/dxn_store?retryWrites=true&w=majority`).

### Step 2: Configure Environment Variables in Vercel
In **Vercel Dashboard → Project (`web-dxn`) → Settings → Environment Variables**, set for **Production** (and **Preview** as needed):

- `MONGODB_URI` — MongoDB Atlas connection string
- `JWT_SECRET` — Cryptographically random secret (`>= 32` characters, e.g. `openssl rand -hex 32`)
- `DXN_SPONSOR_MEMBER_ID` — Your official DXN Sponsor Membership Number (can also be updated anytime from `/admin/settings` without redeploying)
- `TELEGRAM_BOT_TOKEN` — From `@BotFather` (server-side secret — never prefix with `VITE_`)
- `TELEGRAM_CHAT_ID` — Your private admin chat or private admin group ID (server-side secret)
- `STORE_WHATSAPP_NUMBER` — Official WhatsApp number in international digits (e.g. `213661000000`)

See `docs/DXN_NADZ_ENVIRONMENT_VARIABLES.md` for the complete reference.

### Step 3: Build & Deploy Settings on Vercel
`vercel.json` is pre-configured in the repository root:
- **Install Command**: `npm install`
- **Build Command**: `npm run build` (runs `tsc -p tsconfig.json` followed by `vite build --config src/frontend/vite.config.ts`)
- **Output Directory**: `dist/frontend/build`
- **Serverless Function**: `api/index.js` (routes `/api/*`, `/meta/*`, `/robots.txt`, and `/sitemap.xml` to `dist/index.js`, while SPA routes fall back to `/index.html`).

### Step 4: Bootstrap Owner Admin Account
Run once against your production `MONGODB_URI` from a secure workstation:
```bash
MONGODB_URI="<your-atlas-uri>" ADMIN_EMAIL="<owner-email>" ADMIN_PASSWORD="<strong-password>" npm run seed:admin
```

### Step 5: Configure Live Platform Settings Without Redeploying
1. Sign in at `https://<your-domain>/admin/login`.
2. Navigate to **Settings & Integrations (`/admin/settings`)**:
   - Confirm or update your **DXN Sponsor Membership Number** (displayed read-only on `/join` with one-click Copy).
   - Enter your official **WhatsApp Number** and **Social Media URLs** (Facebook, Instagram, TikTok, Telegram Public Channel). Any field left blank stays hidden on the public website.
   - Verify that the **Telegram Bot** badge reads **Configured on Server** and enable notification switches for Orders, Leads, and Contact Messages.
3. Navigate to **Products (`/admin/products`)** to add genuine DXN products with real photographs, prices in DZD, DXN PV points, categories (`supplements`, `cosmetics`, `beverages`, `general`), ingredients, and usage/storage instructions in Arabic and French.
