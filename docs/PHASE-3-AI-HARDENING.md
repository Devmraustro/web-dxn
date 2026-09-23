# Phase 3 — DXN AI Sales Brain Hardening

Status: **IMPLEMENTED & VERIFIED** (local: full Jest run 30/33 suites + 496
tests passing, `tsc -p tsconfig.json` exit 0, `npm run build:backend` exit 0;
remaining failures are the 3 MongoDB-dependent suites — no local MongoDB — and
are documented as environmental). **AI SALES MODE: PAUSED — NOT ACTIVATED.**

Phase 3 hardens the Phase 19–23 AI sales brain for production without changing
its runtime posture: the system remains fully deterministic-and-paused by
default, outbound customer messaging stays **off**, and every behavior change is
covered by tests that run without a DB or a live LLM.

## Changes / Fixes

### 1. Dynamic `AI_SALES_MODE` (fixes an import-order bug, PAUSED stays the safe default)
`src/backend/config/env.ts` — new `getAiSalesMode()` reads `process.env` at each
call instead of the old module-level const that was evaluated **before** dotenv
loaded `.env` on some entry paths. Consumers switched to the dynamic reader:
- `src/backend/ai/meta/processor.ts` — pause gate now uses
  `opts.aiSalesMode ?? getAiSalesMode()`; `SocialProcessorOptions` accepts an
  explicit `aiSalesMode` override so the ACTIVE branch is testable without
  mutating `process.env`.
- `src/backend/routes/ai.routes.ts` — `/api/ai/message` gate reads the mode
  dynamically per request.
- Unknown/missing values always fall back to **PAUSED**.

### 2. Pre-existing failing tests fixed (honest, deterministic suites)
`src/backend/ai/tests/adversarial-social.test.ts` — Phase 19AB realistically
exercises the **ACTIVE** branch with a mocked transport and now injects
`aiSalesMode: "ACTIVE"` explicitly. PAUSED behavior stays covered by
`meta-processor-pause.test.ts`. Result: `adversarial-social` green for the first
time (was 2 failing assertions in the baseline).

### 3. Privacy: no more PII firehose in default logs
`src/backend/ai/debug.ts` (new) — `aiDebug()` emits ONLY when `AI_DEBUG=1|true`
and redacts sensitive-shaped keys. Replaced dozens of unconditional
`[DIAGNOSTIC-*]` logs (50-char customer message previews, sender-ID prefixes,
reply previews, body structures) across:
- `processor.ts`, `orchestrator.ts`, `messenger.ts`, `mongoDedup.ts`,
  `meta.routes.ts`
Genuine failure errors are kept but stripped of customer content. Default
production logs are now quiet and PII-free.

### 4. RegExp DoS hardening — inbound length cap
`src/backend/ai/core/orchestrator.ts` — exported `MAX_MESSAGE_LENGTH = 2000`.
The Meta webhook path had no upstream length limit, so a huge payload would force
the intent/guardrail regexes to scan it. Oversized input is now rejected before
any regex with a safe fallback and `validation: "blocked"` (truncated 400-char
trace is stored only). The web route already enforced the same 2000 bound.

### 5. Anonymous web conversations no longer share memory
`src/backend/routes/ai.routes.ts` — id-less chat requests previously all landed
in one shared `"web:anon"` bucket, leaking user A's context into user B's turns.
They now get a per-day slot (`web:anon:YYYY-MM-DD`), bounding cross-user memory
pollution while keeping stored conversations countable.

### 6. Bounded conversation persistence
`src/backend/ai/core/memory.ts` — `MongooseConversationStore.append` grew
Message documents without limit. It now best-effort prunes to
`MAX_STORED_MESSAGES` (40) per conversation after each append (never throws; the
write path is unaffected). The in-memory store already enforced the cap.

### 7. Shipping-invention false positives reduced
`src/backend/ai/core/guardrails.ts` — `checkShippingInvention` only challenges
numeric figures that appear **near** a shipping term (`±20`/`+30` chars), so an
already-allowlisted product price elsewhere in a multi-fact reply is no longer
mistaken for an invented shipping fee. Fabricated fees attached to a shipping
term are still blocked.

## Tests
`src/backend/ai/tests/phase3-hardening.test.ts` (new, 14 tests, DB-free):
- dynamic mode default/edge cases + processor override (no `process.env` pokes);
- inbound length cap (over-limit blocked, at-limit unaffected);
- in-memory store trims to `MAX_STORED_MESSAGES`;
- scoped shipping-fee checks (near flagged, far not);
- `aiDebug` emits nothing unless `AI_DEBUG` is set.

## Verification
- AI suites: **12/12 suites, 229/229 tests passing**.
- Slug suite: passing.
- Full run: **30/33 suites, 496/525 tests passing** — only `product`, `order`,
  `seed` fail, all `MongooseError ... buffering timed out` (no local MongoDB),
  unchanged environmental failures.
- `npm run typecheck`: clean. `npm run build:backend`: clean.

## Owner action required (unchanged, outside this phase)
- Set `AI_SALES_MODE=ACTIVE` only after operator review; defaults to PAUSED.
- `META_*` env vars + page ID to go live with Instagram/Facebook messaging.
- `AI_DEBUG=1` only during incident debugging (privacy).

**AI SALES MODE: PAUSED — NOT ACTIVATED.**