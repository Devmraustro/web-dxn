# DXN NADZ — Environment Variables Reference

> **Security Rule:** Never commit `.env` files or real credentials to Git. Never prefix server secrets (`MONGODB_URI`, `JWT_SECRET`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `META_*`) with `VITE_`.

---

## 1. Core Required Server Variables (Production)

| Variable | Scope | Required | Description |
|---|---|---|---|
| `NODE_ENV` | Server | Yes | Set automatically to `production` by Vercel. |
| `MONGODB_URI` | Server Secret | **Yes** | MongoDB Atlas SRV connection string (`mongodb+srv://...`). |
| `JWT_SECRET` | Server Secret | **Yes** | Minimum 32-character secret used to sign & verify admin JWTs (`openssl rand -hex 32`). Server refuses to boot in production if shorter than 32 chars. |
| `CORS_ORIGIN` | Server | Recommended | Comma-separated allowed origins (e.g. `https://dxnnadz.vercel.app`). Same-origin requests and Vercel deployment domains are permitted automatically. |
| `BASE_URL` | Server | Recommended | Canonical base URL used for `robots.txt`, `sitemap.xml`, and local storage URLs (e.g. `https://dxnnadz.vercel.app`). |
| `STORE_URL_BASE` | Server | Optional | Base storefront URL used by AI assistant links (e.g. `https://dxnnadz.vercel.app`). |
| `DEFAULT_SHIPPING_HOME` | Server | Optional | Default home delivery shipping fee in DZD (defaults to `600`). |
| `DEFAULT_SHIPPING_OFFICE` | Server | Optional | Default stop-desk/office shipping fee in DZD (defaults to `400`). |

---

## 2. DXN NADZ Sponsor & Contact Defaults (Overridable in `/admin/settings`)

These variables act as initial defaults before the owner saves live settings in `/admin/settings` (stored in MongoDB `SiteSettings`):

| Variable | Scope | Required | Description |
|---|---|---|---|
| `DXN_SPONSOR_MEMBER_ID` | Server | Optional | Official DXN Sponsor Membership Number shown read-only on `/join`. If unset in both DB and env, `/join` displays a transparent "Available upon direct contact" state instead of fake digits. |
| `STORE_WHATSAPP_NUMBER` | Server | Optional | Official WhatsApp phone number (8–15 digits, e.g. `213661000000`). |
| `STORE_EMAIL` | Server | Optional | Official contact email (defaults to `dxntraveldz@gmail.com`). |

---

## 3. Instant Telegram Owner Notifications (Server-Only Secrets)

| Variable | Scope | Required | Description |
|---|---|---|---|
| `TELEGRAM_BOT_TOKEN` | Server Secret | Optional | Bot token issued by `@BotFather`. Redacted from all error logs (`bot[redacted]`). |
| `TELEGRAM_CHAT_ID` | Server Secret | Optional | Private owner Telegram user ID or private admin channel/group ID (e.g. `-1001234567890`). |

*Note:* If `TELEGRAM_BOT_TOKEN` or `TELEGRAM_CHAT_ID` is not set, order, lead, and contact submissions still succeed and persist to MongoDB without error (`[telegram] notification skipped: not configured`).

---

## 4. Optional Build-Time Frontend Social Fallbacks

| Variable | Scope | Required | Description |
|---|---|---|---|
| `VITE_FACEBOOK_URL` | Client Build | Optional | Public HTTPS Facebook page URL fallback (can also be managed dynamically in `/admin/settings`). |
| `VITE_INSTAGRAM_URL` | Client Build | Optional | Public HTTPS Instagram profile URL fallback (can also be managed dynamically in `/admin/settings`). |

---

## 5. Optional Image Storage & AI / Meta Messenger Integrations

| Variable | Scope | Required | Description |
|---|---|---|---|
| `CLOUDINARY_CLOUD_NAME` | Server Secret | Optional | Cloudinary cloud name for persistent product image uploads on serverless deployments. |
| `CLOUDINARY_API_KEY` | Server Secret | Optional | Cloudinary API key. |
| `CLOUDINARY_API_SECRET` | Server Secret | Optional | Cloudinary API secret. |
| `OPENROUTER_API_KEY` | Server Secret | Optional | Enables optional AI assistant capabilities when configured. |
| `META_PAGE_ID` | Server Secret | Optional | Facebook Page ID for optional Meta Messenger webhook integration. |
| `META_ACCESS_TOKEN` | Server Secret | Optional | Meta Page Access Token. |
| `META_VERIFY_TOKEN` | Server Secret | Optional | Meta Webhook verification token. |
| `META_APP_SECRET` | Server Secret | Optional | Meta App Secret for `X-Hub-Signature-256` verification. |
