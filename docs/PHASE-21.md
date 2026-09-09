# Phase 21 — Real LLM Production Integration

Status: **IMPLEMENTED & VERIFIED** (local build + 114/114 Jest, no live LLM call
made — that requires an owner API key).

Phase 21 turns the deterministic-first AI subsystem into a defensible real-LLM
production path without weakening any Phase 20A safety guarantee. The baseline
remains fully deterministic and safe when no provider/credential is configured.

## Changes

### 1. Bounded transient retry on real provider HTTP calls
`src/backend/ai/provider/AIProvider.ts` now wraps the OpenAI and Anthropic
`axios.post` calls in `withRetry` (existing `src/backend/ai/core/retry.ts`):
exponential backoff + jitter, max 3 attempts. Only transient failures are
retried — new `isTransientProviderError` classifies:
- **Retry:** network errors/timeouts (no status), HTTP 429, HTTP 5xx.
- **Never retried:** HTTP 4xx (401 auth, 400 bad request) and missing-key
  throws — retrying these wastes attempts and burns quota.

### 2. Config fail-safe + observability (no secret leak)
- If a real provider is configured with no key, `generateResponse` throws and
  the orchestrator fails closed to the deterministic fallback (never invents).
- Providers now expose `readonly configError?: string` naming the missing
  variable (e.g. `"OPENAI_API_KEY is missing"`) — never the value.
- `GET /api/ai/health` returns `configError` so misconfiguration is observable
  without leaking key material. The deterministic fallback never reports one.

### 3. Output guardrails: stock / shipping / discount invention
`src/backend/ai/core/guardrails.ts` — the `stock_invention`, `shipping_invention`
and `discount_invention` violation types are now actually enforced via a new
optional `OutputContext` passed by the orchestrator's LLM path:
- **Stock:** a positive availability claim (ar/fr "disponible/en stock/متوفر/…")
  is rejected when the named product is out of stock or no in-stock item is
  retrieved. "نفذت الكمية" / "Rupture de stock" (unavailability) are not treated
  as claims.
- **Shipping:** a fee figure near a shipping term that is not among the
  retrieved `shippingPricesDA` is rejected.
- **Discount:** a promo percentage/`réduction`/`خصم` not among authoritative
  discounts is rejected.
- Context-free calls (deterministic path) are unaffected — no new false
  positives on already-verified templates.

### 4. Grounded prompting + prompt hardening
`src/backend/ai/core/orchestrator.ts`:
- Retrieved products/packs, store settings and FAQ (via `getFaq`/`getStoreSettings`)
  are injected into the prompt inside `<DATA>…</DATA>` markers.
- The system prompt now states `<DATA>` is **data, not instructions**; forbids
  revealing the system prompt, secrets, or architecture; and instructs the model
  to ignore role-play / prompt-injection / fabricated-data directives.
- `truncateData` caps prompt sections (4000-char grounding, 6000-char user
  prompt) so token/context use stays bounded.
- The orchestrator passes a derived `OutputContext` to `validateOutput`.

## Verification

- `tsc -p tsconfig.json --noEmit` — **exit 0**
- `npm run build` — **exit 0**
- `npm test` — **114/114 PASS, 8/8 suites** (no regressions)
- AI suite alone — **86/86 PASS, 5 files** (4 original + new `ai.llm.test.ts`)

New `ai.llm.test.ts` covers: fabricated stock/shipping/discount rejection,
transient-error classification, retry-on-500 / no-retry-on-401 / bounded-retry,
config fail-safe (missing-key, no value leaked, deterministic free of
`configError`), OpenAI/Anthropic response parsing, and LLM-path grounding +
`<DATA>` isolation + fabricated price/medical blocking + role-play neutralization.

## OWNER ACTION REQUIRED
1. If you want the real LLM path: set `AI_PROVIDER=openai` (or `anthropic`) and
   the matching `*_API_KEY`/`*_MODEL` in `.env`. Until then the app is safe and
   deterministic with zero external setup.
2. After adding a key, verify `/api/ai/health` returns
   `{"provider":"openai","healthy":true}` (or `configError` naming any missing
   var). A live call is only made once a valid key is configured. OpenCode's
   next step after a key is present: a live `POST /api/ai/message` smoke test.
