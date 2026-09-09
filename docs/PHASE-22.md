# Phase 22 — AI Sales Experience Hardening + Conversational QA

Status: **IMPLEMENTED & VERIFIED** (local: 181/181 Jest, `tsc` exit 0, `npm run
build` exit 0). Live LLM: **CONFIGURATION REQUIRED / OWNER ACTION REQUIRED** —
see the real-call smoke result below.

Phase 22 hardens the Phase 21 real-LLM path as a trustworthy, multilingual,
secure sales assistant. It adds a comprehensive sales + safety QA suite and your
retrieval/guardrail integrity across Arabic, Algerian Darija, French and mixed
inputs, fixes real data-integrity bugs found by that suite, and verifies failure
handling, output validation, memory isolation and observability.

## Changes / Fixes

### 1. Multilingual (Arabic/Darija/French) catalog retrieval
`src/backend/ai/core/catalogSearch.ts` (new): a shared normalizer + matcher
(`normalizeText`, `stripArticle`, `queryTerms`, `haystackMatchesTerm`,
`matchesQuery`) that strips Arabic definite articles ("ال"), diacritics and
attached punctuation/question marks so Arabic/Darija queries actually find
products. Both adapters use it:
- `src/backend/ai/dataAccess.ts` — real `searchCatalog` refactored to
  `matchesQuery`/`queryTerms`.
- `src/backend/ai/core/testFakes.ts` — fake `searchCatalog` kept in sync.

### 2. Recommendation category coverage
`src/backend/ai/core/retrieval.ts` — `termToCategory` enriched (study/étude/
concentration/تركيز/دراسة/مذاكرة) plus extra coffee/tea/ginger/energy/immunity/
sleep terms.

### 3. Price-integrity bug fixes (found by the new suite)
- `src/backend/ai/core/guardrails.ts` — `extractPriceValue` now parses fr-FR
  grouped thousand separators (narrow no-break space U+202F). **Before**, any
  price ≥ 1000 ("3 200 DA") parsed as "3" and was wrongly rejected as a
  fabricated price, causing every price/stock question on a normal product to
  escalate to a human.
- `src/backend/ai/core/guardrails.ts` — `OUTPUT_price` now matches the FULL
  grouped amount ("3 600 DA") instead of splitting into partial groups
  ("600 DA") that were never allowlisted.
- `src/backend/ai/core/orchestrator.ts` — new `priceFacts()` includes both
  `priceDA` and a legitimate higher `compareAtPriceDA` in the output-validation
  allowlist. **Before**, a real discounted product's promo compare-at price
  ("3 600 DA → 3 200 DA") looked like an invention and escalated.

### 4. Output secret guardrail (defense-in-depth)
`src/backend/ai/core/guardrails.ts` — new `OUTPUT_SECRET` block: responses that
mention API keys, `OPENAI_API_KEY`, `sk-…`, `mongodb://…`, passwords, tokens or
"secret" are rejected and escalated. The model was already told never to reveal
these; this adds a hard filter so a manipulated conversation cannot exfiltrate
credentials through the reply.

### 5. Darija complaint & recommendation intent coverage
`src/backend/ai/core/intent.ts` — added Darija complaint triggers ("ما وصلش",
"ماوصلش", "وصلنيش", …) so "الطلب تاعي ما وصلش" escalates as a complaint instead
of silently returning generic order help; added recommendation triggers
("تنصحني", "ننصح", "نصحت", …) so "واش تنصحني؟" reaches the recommendation path.

### 6. Observability/PII (audit follow-up)
`src/backend/ai/services/ai.service.ts` — `escalateToOwner` no longer logs the
full 200-char customer message; a new `maskIdentifier()` masks customer IDs.
Logs only masked ID + platform + reason (no raw PII/message content).

## QA matrix covered by `src/backend/ai/tests/ai.sales.test.ts` (67 new tests)

- **Multilingual intent & grounded QA** — Arabic/Darija/French/mixed price and
  stock questions retrieve the real price, stay in the user's language, and
  never switch language unexpectedly.
- **Product questions** — known → answered from data; unknown → not invented;
  out-of-stock → reported out of stock, never available; pack discovery.
- **Price integrity + attacks** — fabricated-price injection blocked at input;
  "consider price X"/"50% discount" directives neutralized (real retrieved price
  wins); real compare-at promo price shown.
- **Stock integrity + attacks** — "say it's available"/"assume stock 100" never
  yield a positive availability claim.
- **Shipping integrity + attacks** — free-shipping / "0 DA" directives never
  produce invented fees; missing config is not invented.
- **Recommendation** — never medical; yields real items or a safe catalog
  fallback; study maps to study, not medical.
- **Medical red team** — 9 ar/darija/fr cure questions never answered with a
  claim; explicit cure question escalates to a human.
- **Prompt injection & secret extraction** — 8 ar/darija/fr/en injections
  blocked; no secret/system-prompt material leaks.
- **Retrieved-content (FAQ) is DATA, not instructions** — a malicious FAQ lands
  inside `<DATA>` and never mirrors into the system-prompt instructions.
- **Complaints & human escalation** — complaint/human-request escalates without
  fabricating a resolution or status.
- **Order IDOR privacy** — asking for another order never reveals details;
  order-status answered with safe guidance, no fabrication.
- **Conversation memory isolation & boundedness** — history bounded to the
  context window; two conversations never cross-contaminate; per-conversation
  persistence.
- **LLM failure handling** — provider timeout/network/missing-key and empty
  responses fail safe into the deterministic fallback, no crash, no leak.
- **Output validation** — fabricated price/medical claim/secret from the LLM is
  never passed through.

## Verification

- `npm test` — **181/181 PASS, 9/9 suites** (baseline 114 → +67 new; no
  regressions; `ai.llm.test.ts` still green).
- `npx tsc -p tsconfig.json --noEmit` — **exit 0**
- `npm run build` — **exit 0**

## Real LLM live smoke

A genuine live OpenAI call was attempted with `AI_PROVIDER=openai` using the
`OPENAI_API_KEY` already present in the environment:

- `provider=openai`, `configError=none`, key present.
- Result: **HTTP 401 Unauthorized** — the key in the environment is not valid
  for the OpenAI API (or is expired/revoked).

Therefore the real LLM path is **NOT LIVE VERIFIED**. The installed key must be
replaced. Until then the app runs safely in the deterministic, data-grounded
mode (which passes all 181 tests and provides full sales/complaint/order
functionality offline).

## Status summary (mandated vocabulary)

| Area | Status |
|------|--------|
| Deterministic sales/complaint/order pipeline | IMPLEMENTED & VERIFIED |
| Multilingual Arabic/Darija/French retrieval | IMPLEMENTED & VERIFIED |
| Price/stock/shipping/recommendation integrity | IMPLEMENTED & VERIFIED |
| Medical / health red team | IMPLEMENTED & VERIFIED |
| Prompt injection (direct + retrieved-content) | IMPLEMENTED & VERIFIED |
| Secret extraction blocking (input + output) | IMPLEMENTED & VERIFIED |
| Order IDOR privacy | IMPLEMENTED & VERIFIED |
| Conversation memory isolation & boundedness | IMPLEMENTED & VERIFIED |
| LLM failure handling (fake providers) | IMPLEMENTED & VERIFIED |
| Output validation | IMPLEMENTED & VERIFIED |
| Observability (PII-safe logging) | IMPLEMENTED & VERIFIED |
| Real LLM live smoke | CONFIGURATION REQUIRED / OWNER ACTION REQUIRED |

## OUT OF SCOPE (not changed)
Meta/Instagram/Facebook production integration, new payment integrations,
unrelated frontend redesign, and the legacy Meta path in `ai.service.ts`.

## OWNER ACTION REQUIRED
1. Set a **valid** `OPENAI_API_KEY` (the one currently in the environment
   returns HTTP 401) — or a valid `ANTHROPIC_API_KEY` — and set
   `AI_PROVIDER=openai` (or `anthropic`) in `.env`. Do **not** paste the key
   into source code or chat.
2. After installing a valid key, verify `GET /api/ai/health` returns
   `{"provider":"openai","healthy":true}` and run a live `POST /api/ai/message`
   smoke. Only then can the real LLM path be marked **LIVE VERIFIED**.
