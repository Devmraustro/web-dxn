# Instagram / Facebook Integration — DXN Store

Phase 19N–O/P/T. Connects an Instagram business account and/or Facebook Page to
the AI assistant and answers customers directly in Messenger.

## How it works

```
Meta → POST /meta/webhook  (raw JSON + X-Hub-Signature-256)
          │  verifySignature (HMAC-SHA256, timing-safe)
          ▼
      processWebhookEvent   (validates shape, builds idempotency key)
          │  dedup registry (a retried event is NOT answered twice)
          ▼
      Orchestrator.handleMessage  → AI pipeline (see docs/AI.md)
          ▼
      MetaMessenger.sendText  → Graph API me/messages
```

## Endpoints

| Method | Path             | Purpose                                        |
|--------|------------------|------------------------------------------------|
| GET    | `/meta/webhook`  | Meta verification handshake (challenge echo)   |
| POST   | `/meta/webhook`  | Event delivery (signature-validated)           |

The POST body is parsed as **raw** (`express.raw`, mounted before the JSON
parser) because Meta signs the exact bytes transmitted.

## Make it go live

This integration **requires external setup** that cannot be created from code.
Follow `docs/EXTERNAL-CONFIGURATION.md` — the short version:

1. Meta developer account + app.
2. In the app: enable **Messenger** (for a Page) and/or **Instagram** product.
3. Connect the app to your Facebook Page; convert the account to a business
   (Instagram) account if needed.
4. Subscribe to required webhook fields:
   - Messenger: `messages`, `messaging_postbacks`
   - Instagram: `messages`
5. Add the webhook callback URL `https://<your-domain>/meta/webhook` with a
   **verify token** of your choice.
6. Copy values into `.env`:
   - `META_VERIFY_TOKEN` — the token you supplied to Meta
   - `META_APP_SECRET` — app secret (console → App settings → Basic)
   - `META_PAGE_ACCESS_TOKEN` — long-lived page access token
   - `META_GRAPH_VERSION=v19.0`
7. Deploy behind HTTPS (Meta requires TLS) and point a public domain at the
   app. Because the app is behind a reverse proxy, set `app.set("trust proxy",
   1)` so Express trusts the proxy.

### Page access token

1. Console → your app → Messenger → "Add or remove Pages" → choose the Page.
2. "Generate access token" → copy the short-lived token.
3. Exchange for a **long-lived** token via the Graph API or **never-expiring** if
   the app is in Live mode for the relevant product.

## Verification & security

- **GET handshake** must return `hub.challenge` only when
  `hub.verify_token` equals `META_VERIFY_TOKEN` (otherwise 403).
- **POST signature** `X-Hub-Signature-256` is recomputed as
  `sha256=HMAC-SHA256(appSecret, rawBody)` and compared with
  `crypto.timingSafeEqual` (constant-time). Invalid/missing signatures → 401.
- Events are **rate limited** (`/meta/webhook`, 120/min) separately from the
  global limiter.
- **Idempotency:** each event is keyed `platform:sender:mid`; a redelivered
  event is acknowledged but never re-answered, so Meta retries can't cause
  duplicate replies.
- No secret is ever logged or returned to the client.

## Two webhook objects

`object: "instagram"` and `object: "page"` (Facebook) are both normalized by
`toNormalizedMessage`. Both platforms map to `MetaMessenger.sendText` via the
Graph API `me/messages` endpoint using the same page token.

## Testing

Covered in `tests/meta-webhook.test.ts` and `tests/adversarial-social.test.ts`
using an injected transport (no live Meta network). See `docs/AI.md`.
