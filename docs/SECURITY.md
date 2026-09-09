# Security — DXN Store AI & Meta

Phase 19AJ/19V and general hardening relevant to the AI/Meta module.

## Secrets handling

- API keys (OpenAI/Anthropic), the Meta app secret, page token, verify token,
  and Telegram credentials are read **only** from environment variables.
- No secret is logged, echoed, or returned through any endpoint.
- `GET /api/ai/health` reports provider *name* and *healthy* status only —
  never key material.

## Webhook integrity

- `GET /meta/webhook` returns `hub.challenge` only when
  `hub.verify_token` matches `META_VERIFY_TOKEN` (otherwise 403).
- `POST /meta/webhook` recomputes `sha256=HMAC-SHA256(appSecret, rawBody)` from
  the **raw** body and compares via `crypto.timingSafeEqual` (constant-time).
  Invalid / missing signatures → 401. No diagnostic details are leaked.

## Input safety (AI)

- **Prompt-injection / fabrication directives** are blocked before they reach
  any provider (Arabic, Darija and French patterns).
- **Medical-risk gate:** any treatment/cure question escalates to a human.
- All webhook/AI payloads are treated as untrusted.

## Output safety (AI)

- Answers containing invented guarantees, medical claims, weight-loss promises,
  or prices not in the allowlist are rejected and escalated.
- The AI only talks about retrieved catalog data — it cannot invent stock,
  price, or shipping.

## Rate limiting

- Endpoint-specific limiter on `/meta/webhook` (120 req/min) on top of the
  global limiter — a flood or misconfigured caller cannot exhaust the global
  budget or hammer external APIs.

## Privacy (Phase 19AG)

- Telegram escalation sends only required data; customer identifiers are masked
  (`AB***12`), never sent in full.

## General note

Put the app behind HTTPS in production and set `app.set("trust proxy", 1)` when
behind a reverse proxy so rate-limit IP and secure cookies behave correctly.
Server hardening headers (`helmet`), CORS allow-listing, and request sanitizing
are additional layers applied at the app level (see `src/backend/app.ts`).
