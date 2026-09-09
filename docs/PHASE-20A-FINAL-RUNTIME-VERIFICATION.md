# Phase 20A — Final Runtime Verification (owner / local Windows)

This document records the **final runtime validation and test hygiene** results
for Phase 20A. Every item below was **actually executed** on this environment
(no item is marked `PENDING` without a reason). Status labels used are limited
to: `VERIFIED`, `FIXED`, `PASS`, `FAIL`, `PENDING ONLY`.

All paths are relative to the repository root:
`C:\Users\Utilisateur\Documents\web dxn`.

---

## Environment used for this round

- Host: Windows / PowerShell 7.
- MongoDB: Docker container `dxn-mongo` (`mongo:7.0`), published on
  `localhost:27017`, `Up`.
- Docker: Docker Desktop 4.83.0, engine 29.6.2 (recovered this round — see
  item 1).
- Node runtime for local smoke: `node dist/index.js` (built output).

---

## 13 runtime verification items

### 1. Docker Desktop / engine running
- **Status: VERIFIED (recovered).**
- The engine was wedged at the start of this round (every `docker` command hung
  indefinitely). Restart procedure applied with owner approval:
  `wsl --terminate docker-desktop` → stop all `Docker Desktop` /
  `com.docker.backend` / `com.docker.build` processes → relaunch
  `C:\Users\Utilisateur\AppData\Local\Programs\DockerDesktop\Docker Desktop.exe`.
- After restart, `docker version` returned a server section
  (Docker Desktop 4.83.0 / Engine 29.6.2). All subsequent `docker` commands
  were responsive.

### 2. MongoDB running
- **Status: PASS.**
- `docker ps` → `dxn-mongo` (`mongo:7.0`) `Up`.
- `Test-NetConnection localhost -27017` → `TcpTestSucceeded True`.
- Used by both the local `node dist/index.js` server and the runtime container.

### 3. npm install / dependency lockfile
- **Status: FIXED / VERIFIED.**
- Root cause of the prior **Docker build `npm ci` failure**: `package-lock.json`
  was out of sync for the Linux / npm target (`Missing: @emnapi/core@1.11.3 /
  @emnapi/runtime@1.11.3 from lock file`).
- **Fix:** regenerated `package-lock.json` inside a `node:20-alpine` container
  so `npm ci` in the Docker builder stage no longer fails on lockfile sync.
- `npm ci` (inside Docker) and `npm install` (host) now succeed.

### 4. tsc / typecheck
- **Status: PASS.**
- Command: `npx tsc -p tsconfig.json --noEmit` → **exit 0, 0 errors**.
- No `@ts-ignore` / `@ts-nocheck` used; TypeScript not weakened.

### 5. Production build
- **Status: PASS.**
- Command: `npm run build` (= `tsc -p tsconfig.json`) → **exit 0**. Emits
  `dist\index.js` and `dist\backend\index.js`. `dist/index.js` bootstraps the
  server and is the Dockerfile `CMD` entry.

### 6. Main Jest suite (`jest.config.js`)
- **Status: PASS (FIXED from 69 passed / 15 failed → 87 passed / 0 failed).**
- Full command: `npx jest --config jest.config.js --runInBand`.
- **Result: 7/7 suites PASS, 87/87 tests PASS, exit 0** with clean teardown (no
  "Jest did not exit one second after the test run has completed", no hook
  timeout, no "Cannot log after tests are done").
- Teardown fix: `src/backend/tests/setup.ts` no longer calls
  `afterAll(dropDatabase())` and no longer clears all collections in a global
  `beforeEach`; `afterAll` now just closes the Mongoose connection. This removed
  the `>5s` hook timeout.
- Legacy test updates (see "Test fixtures updated" below).

### 7. AI Jest suite (`jest.ai.config.js`)
- **Status: PASS.**
- Command: `npx jest --config jest.ai.config.js --runInBand` →
  **59/59 PASS, exit 0** (4 suites).

### 8. Server startup (local)
- **Status: PASS.**
- `node dist/index.js` starts, connects to Mongo
  (`MongoDB Connected: localhost`) and serves on port 5000.
- The previously-confirmed security-middleware `req.query` fix holds; every
  request passes the middleware chain.

### 9. GET /api/health
- **Status: PASS.**
- `GET /api/health` → **HTTP 200**
  `{"status":"ok","timestamp":"..."}` (verified both locally and in the
  runtime container).

### 10. GET /api/ai/health
- **Status: PASS.**
- `GET /api/ai/health` → **HTTP 200**
  `{"provider":"deterministic","healthy":true}` (local and container).

### 11. Core API smoke tests
- **Status: PASS.**
- Local run against `node dist/index.js`:
  - `GET /api/products` → 200
  - `GET /api/packs` → 200
  - `GET /api/offers` → 200
  - `GET /api/shipping/wilayas` → 200
  - `GET /api/orders` (no token) → **401** (auth enforced)
  - `GET /api/products/<invalid-id>` → **400** (CastError handler; previously 500)
  - `POST /api/ai/message` → 200 with a response.
- Pre-existing route-shape notes: `GET /api/users` → 404 (no such GET handler
  mounted there) — unchanged.

### 12. Docker build
- **Status: FIXED / PASS.**
- Command: `docker build -t dxn-store .` → **exit 0**; image `dxn-store:latest`
  created.
- Two genuine Dockerfile problems fixed this round:
  1. **`chown -R appuser:appgroup /app` stalled over WSL2 overlayfs** on the
     large `node_modules`, hanging the build at the last runtime step. Replaced
     with a plain world-readable `COPY` of `node_modules`/`dist` (node only needs
     read/execute at runtime).
  2. **`appuser` had no writable target for the Winston `logs/` directory**, so
     the container crashed at startup with
     `EACCES: permission denied, mkdir 'logs'`. Added
     `RUN mkdir -p /app/logs && chown appuser:appgroup /app/logs` (non-recursive,
     fast) before `USER appuser`.
- The builder `npm ci` now succeeds because of item 3 (lockfile).

### 13. Docker runtime
- **Status: PASS.**
- Ran the image as a container (`-p 5000:5000`,
  `MONGODB_URI=mongodb://host.docker.internal:27017/dxn_store`) connecting to
  the existing `dxn-mongo`.
- Container state after fix: **Up and `healthy`** (own HEALTHCHECK passing).
- Endpoints from the container: `/api/health` → 200,
  `/api/ai/health` → 200, `/api/products` → 200, `/api/packs` → 200,
  `/api/offers` → 200, `/api/shipping/wilayas` → 200.

---

## Application bugs fixed (do not weaken prod to satisfy obsolete tests)

Each fix below addresses a **real application defect**, not a test-only
change; tests were updated to the current intended business behavior.

- `src/Database/Models.ts` — **Product** gained a required `price` (default 0)
  and `compareAtPrice`; pricing middleware/controller read `product.price`
  which was missing.
- `src/Database/Models.ts` — **ProductTranslation** removed `_id: false`
  (standalone model, not a subdocument) so `Model.create()` works.
- `src/Database/Models.ts` — **Order** totals and delivery/payment fields moved
  from inside `customerInfo` to top-level, matching `createOrder` output and
  the `telegram.service` / `dashboard.controller` reads.
- `src/backend/controllers/product.controller.ts` /
  `order.controller.ts` — `getProductById` / `getOrderById` now return
  **HTTP 400** on invalid ObjectId format (CastError) instead of a 500.
- `src/backend/middleware/inventory.middleware.ts` —
  `validateOrderPricing` used falsy checks (`!shippingFee`), rejecting a
  legitimate **free-shipping** order (`shippingFee: 0`). Changed to
  `typeof ... === "number"` checks.
- `src/backend/middleware/inventory.middleware.ts` (shipping lookup) — the
  shipping fee lookup was in `order.controller.ts` (`ShippingRate.findOne({
  wilayaId: wilaya })` where `wilayaId` is an ObjectId); passing a wilaya name
  string threw a CastError and 500'd every createOrder. `createOrder` now
  resolves the shipping rate by wilaya ObjectId **or** wilaya name, so it never
  throws the cast error and shippingFee degrades to 0 when no rate matches.

## Test fixture updates (documented)

- `src/backend/tests/setup.ts` — removed the teardown `dropDatabase()` and the
  global collection-clearing `beforeEach`; `afterAll` only closes the
  connection (kills the hook-timeout failure).
- `src/backend/tests/order.test.ts` (rewritten) — real Products with prices,
  valid ObjectIds, full pricing fields (`subtotal/shippingFee/discount/total`),
  JWT `authHeader(role)` helper, route-protection (401) assertions, invalid-ID
  400 assertions, immutable-pricing snapshot assertions. `process.env.JWT_SECRET`
  is set explicitly so the token signer and `authenticate` agree (the runtime
  previously used two different hard-coded default secrets).
- `src/backend/tests/product.test.ts` (rewritten) — real ObjectIds, `price`
  fields, valid-format-nonexistent → 404, invalid format → 400, translations via
  `ProductTranslation.create`, POST/PUT/DELETE coverage.

---

## Summary status table

| # | Item | Status |
|---|------|--------|
| 1 | Docker Desktop / engine | VERIFIED (recovered) |
| 2 | MongoDB (`dxn-mongo`) | PASS |
| 3 | npm install / lockfile sync | FIXED / VERIFIED |
| 4 | tsc --noEmit | PASS (0 errors) |
| 5 | npm run build | PASS |
| 6 | main Jest suite | PASS (87/87, 7/7 suites) |
| 7 | AI Jest suite | PASS (59/59) |
| 8 | server startup | PASS |
| 9 | GET /api/health | PASS (200) |
| 10 | GET /api/ai/health | PASS (200) |
| 11 | Core API smoke | PASS |
| 12 | Docker build | FIXED / PASS |
| 13 | Docker runtime | PASS (container healthy) |

**Phase 20A final runtime validation: all 13 items PASS / VERIFIED / FIXED.**
No Meta or LLM (provider) configuration was touched; no unrelated changes were
made. The full Jest suite went from the reported `69 passed / 15 failed`
baseline to **87 passed / 0 failed** (main) plus **59/59** (AI).
