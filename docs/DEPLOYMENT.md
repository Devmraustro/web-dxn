# Deployment — DXN Store (Phase 19 AI & Meta)

## Prerequisites to go fully live

The AI assistant works in **deterministic mode** with zero external setup.
Going live with an real LLM and Instagram/Facebook requires the external items
listed in `docs/EXTERNAL-CONFIGURATION.md`.

## Build & typecheck

```
npm run build          # tsc -p tsconfig.json
npm run typecheck      # tsc --noEmit
```

> Note: the repository contains pre-existing legacy TypeScript errors across
> older modules (broken import paths, missing referenced files) that are
> unrelated to Phase 19. The AI/Meta module and its routes typecheck cleanly
> (see `src/backend/ai/tsconfig.json` and targeted checks).

## Tests

```
npm test -- --config jest.ai.config.js --runInBand
```

The AI suite (59 tests) runs **without MongoDB and without external
credentials**, so it can run in CI.

## Environment

Copy `.env.example` → `.env` and set values. For Phase 19:

```
AI_PROVIDER=deterministic            # or openai / anthropic
OPENAI_API_KEY=                      # if openai
ANTHROPIC_API_KEY=                   # if anthropic
STORE_URL_BASE=https://dxn.dz/product
META_VERIFY_TOKEN=
META_APP_SECRET=
META_PAGE_ACCESS_TOKEN=
META_GRAPH_VERSION=v19.0
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
MONGODB_URI=mongodb://<host>:27017/dxn_store
```

## Run

```
npm run dev       # ts-node (dev)
npm start         # compiled build
```

## Serve Meta webhooks

- Must be reachable at `https://<public-domain>/meta/webhook` over **HTTPS**
  (Meta requires TLS).
- Put Express behind a reverse proxy (nginx / Caddy / a PaaS) and set
  `app.set("trust proxy", 1)` so rate limiting and cookies use the real client
  IP.

## Production notes

- Use `AI_PROVIDER=openai|anthropic` only after verifying your API key, model
  and quota. Until then the deterministic fallback is safe and free.
- The Meta message dedup registry is in-memory (per-instance). For multi-replica
  deployments, back it with a persistent shared store to guarantee global
  idempotency.
- Escalation via Telegram is best-effort by design; it never affects orders.
