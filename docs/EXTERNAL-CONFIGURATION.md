# External Configuration Required — DXN Store

**Important — read this first.** Phase 19 implements and unit-tests the *code
pipeline* for the AI assistant and the Instagram/Facebook integration, but
making them **go live** requires external accounts, credentials, and services
that **cannot be created from code**. Until each item below is completed, the
relevant feature runs in a safe degraded mode (deterministic answers; webhook
acknowledges events but does not connect).

Status vocabulary used throughout this project:
- **IMPLEMENTED & TESTED** — built and verified by the passing test suite (no
  external dependency).
- **EXTERNAL CONFIGURATION REQUIRED** — code exists and is tested, but needs a
  real third-party setup to function end-to-end.
- **NOT IMPLEMENTED** — not built.

---

## 1. AI provider (LLM) — OPTIONAL / degraded by default

| Item | Where | Notes |
|------|-------|-------|
| Provider choice | `.env` `AI_PROVIDER=openai \| anthropic \| deterministic` | default `deterministic` = safe, free, no key |
| OpenAI API key | `.env` `OPENAI_API_KEY` | only if `AI_PROVIDER=openai`; billing required |
| OpenAI model | `.env` `OPENAI_MODEL` | default `gpt-4o-mini` |
| Anthropic API key | `.env` `ANTHROPIC_API_KEY` | only if `AI_PROVIDER=anthropic`; billing required |
| Anthropic model | `.env` `ANTHROPIC_MODEL` | default `claude-3-5-haiku-20241022` |

> Until a key is provided, `DeterministicProvider` answers from retrieved data
> only — correct and safe, but not conversational-personality. This is the
> intentional default.

## 2. MongoDB — REQUIRED for production data

| Item | Where | Notes |
|------|-------|-------|
| Running MongoDB instance | `.env` `MONGODB_URI` | catalog, conversations, orders live here |
| Data seeded | `npm run seed:catalog` | starter catalog is idempotent (never overwrites admin data); confirm prices before go-live |
| Owner/admin account | `npm run seed:admin` | `ADMIN_EMAIL` / `ADMIN_PASSWORD` (optionally `ADMIN_ROLE`) in `.env` |

> The AI module is tested against an in-memory catalog and does **not** require
> MongoDB to pass tests. In production the `MongooseDataAccess` adapter reads the
> real database.

## 3. Meta (Instagram + Facebook) — REQUIRED to go live

All of the following are **external** (developer console / business settings):

| Item | Where | Notes |
|------|-------|-------|
| Meta developer account | console | free |
| Meta App created | console | for a business type |
| Messenger product enabled | console → app → Messenger | for a Facebook Page |
| Instagram product enabled | console → app → Instagram | for a business IG account |
| Facebook Page connected | console → Messenger → Add/remove Pages | assistant will reply as the Page |
| Instagram converted to **Business** account | Instagram/app settings | required for API access |
| Webhook subscription fields | console → Webhooks | Messenger: `messages`, `messaging_postbacks`; Instagram: `messages` |
| Webhook callback URL | console | `https://<your-domain>/meta/webhook` |
| Verify token you choose | console + `.env` `META_VERIFY_TOKEN` | must match exactly |
| App secret | console → App settings → Basic | `.env` `META_APP_SECRET` |
| Page access token (long-lived) | console → Messenger → Generate | `.env` `META_PAGE_ACCESS_TOKEN` |
| Graph API version | `.env` `META_GRAPH_VERSION=v19.0` | |
| App review / Live mode | Meta | if not in dev mode, page messaging may require review |
| HTTPS public URL | hosting | Meta requires TLS |
| `trust proxy` enabled | app | set when behind reverse proxy |

## 4. Telegram — REQUIRED (optional if you skip human escalation)

| Item | Where | Notes |
|------|-------|-------|
| Telegram bot created | [BotFather](https://t.me/BotFather) | free; gives a bot token |
| Bot token | `.env` `TELEGRAM_BOT_TOKEN` | |
| Chat id of where to post | `.env` `TELEGRAM_CHAT_ID` | personal / group / channel id |

> Until configured, escalation is computed and returned to the caller but the
> Telegram notification is best-effort (and never throws).

## 5. Environment & deployment — REQUIRED

| Item | Notes |
|------|-------|
| Real `.env` created | from `.env.example`; never commit secrets |
| Public HTTPS domain | for Meta + production chat |
| Node.js runtime | with the installed dependencies |

---

## Current status summary (end of Phase 19)

| Feature | Status |
|---------|--------|
| AI pipeline (intent, language, guardrails, retrieval, memory) | **IMPLEMENTED & TESTED** (86 tests, incl. Phase 21 LLM-production hardening) |
| Deterministic provider (default) | **IMPLEMENTED & TESTED** |
| OpenAI / Anthropic providers | **IMPLEMENTED** (code + unit tests) / **EXTERNAL CONFIGURATION REQUIRED** (key + billing) |
| Meta webhook (verify + signature + idempotency) | **IMPLEMENTED & TESTED** |
| Meta Messenger send | **IMPLEMENTED & TESTED** (injected transport) / **EXTERNAL CONFIGURATION REQUIRED** (app/token) |
| Telegram human escalation | **IMPLEMENTED & TESTED** / **EXTERNAL CONFIGURATION REQUIRED** (bot token/chat id) |
| Mongo-backed catalog retrieval | **IMPLEMENTED** (adapter) / **EXTERNAL CONFIGURATION REQUIRED** (running DB + data) |
