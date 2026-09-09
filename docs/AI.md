# AI Sales Assistant — DXN Store

Phase 19 core implementation. The AI assistant answers customer questions about
the DXN catalog (products, packs, prices, availability, shipping, payment,
orders) on the web and via Instagram/Facebook Messenger — **without inventing
facts**.

## Design principles

1. **Retrieval is the source of truth.** The AI never answers from
   "memory" — it retrieves from the catalog (database) and only talks about
   what it found. The LLM (when enabled) can phrase answers but cannot invent
   prices, stock, or medical claims.
2. **Deterministic by default.** With no API key configured, the system uses
   `DeterministicProvider` and answers safely from templates/retrieved data
   only. This is the production-safe default.
3. **Humans handle the rest.** Anything the AI cannot safely answer —
   medical questions, complaints, prompt-injection attempts, unknown intents,
   unavailable LLM — is escalated to a human (Telegram), never fabricated.

## Module layout (`src/backend/ai/`)

```
provider/AIProvider.ts     Provider abstraction + OpenAI / Anthropic / Deterministic factory
core/types.ts              Shared types (Intent, AiProvider, CatalogItem, results)
core/orchestrator.ts       Central pipeline (normalize -> language -> intent ->
                           guardrails -> retrieval -> LLM/deterministic -> validation -> memory)
core/intent.ts             Rule-based intent classifier (Arabic / Darija / French)
core/language.ts           Language detection
core/guardrails.ts         Input (prompt injection) + output (claim/price) validation
core/retrieval.ts          DataAccess interface + retrieve()/recommend()
core/memory.ts             Conversation store + context builder
core/responses.ts          Deterministic response templates + personality
core/escalation.ts         Telegram human handoff (best-effort, privacy-minimized)
core/retry.ts              Exponential backoff with jitter
dataAccess.ts              MongooseDataAccess (lazy-imports ../Database/Models)
tests/                    jest.ai.config.js-driven suites (no DB / no network)
```

## The pipeline (orchestrator.ts)

For every incoming message:

1. **Normalize** the text.
2. **Detect language** (Arabic / Darija / French / mixed).
3. **Classify intent** (`PRODUCT_INFO`, `PRICE`, `AVAILABILITY`,
   `RECOMMENDATION`, `PACK_INFO`, `SHIPPING`, `PAYMENT`, `ORDER_HELP`,
   `HUMAN_REQUEST`, `COMPLAINT`, `GREETING`, `THANKS`, `CATALOG`, `UNKNOWN`)
   and extract entities (product, pack, category, wilaya, DXN order number).
4. **Input guardrails** — block prompt-injection / fabrication directives.
5. **Medical-risk gate** — any health-treatment question escalates to a human.
6. **Retrieve** matching catalog items (never invented).
7. If an external LLM provider is configured, produce a phrased answer with the
   retrieved facts and bounded conversation history; otherwise use the
   deterministic template answer.
8. **Output guardrails** — reject answers containing invented guarantees,
   medical claims, weight-loss promises, non-allowlisted prices, and (when
   retrieval context is present) fabricated stock availability, shipping fees,
   or discounts (Phase 21).
9. **Persist memory**, return the result (reply text + escalation flag).

## Provider selection (`.env`)

| `AI_PROVIDER` | Behavior                                          | Key needed |
|---------------|---------------------------------------------------|------------|
| `deterministic` (default) | No external calls; templated answers | no         |
| `openai`      | GPT answer phrased from retrieved facts           | `OPENAI_API_KEY` |
| `anthropic`   | Claude answer phrased from retrieved facts        | `ANTHROPIC_API_KEY` |

```
AI_PROVIDER=deterministic   # or openai / anthropic
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-3-5-haiku-20241022
```

### Production hardening (Phase 21)

- **Bounded transient retry.** Real-provider HTTP calls are wrapped in `withRetry`
  (exponential backoff + jitter, max 3 attempts). Only transient failures are
  retried — network errors/timeouts, HTTP 429, and 5xx. Client errors (401/400)
  and missing-keys are never retried (`isTransientProviderError`).
- **Config fail-safe + observability.** If a real provider is chosen but its key
  is absent, `generateResponse` throws and the pipeline fails closed to the
  deterministic fallback (never fakes an answer). Providers expose a
  `configError` message naming the missing variable — revealed by
  `GET /api/ai/health` as `configError` (never the key value) so misconfiguration
  is observable without leaking secrets.
- **Grounded prompts.** Retrieved products/packs, store settings and matching FAQ
  are injected into the prompt inside `<DATA>…</DATA>` markers that are explicitly
  *data, not instructions*. The system prompt forbids revealing the system prompt,
  secrets, or architecture, and instructs the model to ignore role-play / prompt
  injection / fabricated data. Prompt sections are capped (`truncateData`) so
  token/context use stays bounded.

## Intent coverage

- price / availability / product info / recommendation / pack info
- shipping (wilaya-aware) / payment methods (COD, baridimob)
- order help & status (DXN-... order number extraction)
- greeting / thanks / catalog
- human request / complaint -> escalation
- everything else -> safe fallback / escalation, never fabrication

## Endpoints

- `POST /api/ai/message` — web chat (`{ message, conversationId }`)
- `GET  /api/ai/health` — reports provider name + healthy status (no secrets);
  includes `configError` when a real provider is misconfigured

## Testing

```
npx jest --config jest.config.js --runInBand src/backend/ai
```

Core AI suites now total **86 tests across 5 files**: core pipeline, Meta
webhook verification, adversarial safety (medical/price/stock/shipping/
prompt-injection), realistic Instagram flow with retry-deduplication,
order-vs-Telegram separation, and the Phase 21 LLM-production suite (retry
semantics, config fail-safe observability, provider response parsing, fabricated
stock/shipping/discount rejection, and grounded `<DATA>` prompting). Tests run
without MongoDB and without external credentials.

## Also see

- `docs/META-INTEGRATION.md` — Instagram / Facebook wiring
- `docs/TELEGRAM.md` — human escalation
- `docs/SECURITY.md` — verification, privacy, rate limiting
- `docs/EXTERNAL-CONFIGURATION.md` — owner-required setup to go live
