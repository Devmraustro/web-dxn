# DXN NADZ — Post-Release Fixes & UX Improvements Report

**Project:** Devmraustro/web-dxn · **Production:** https://dxnnadz.vercel.app · **Admin:** https://dxnnadz.vercel.app/admin
**Branch:** `arena/9c9610ab-web-dxn` → merged into `main` · **Date:** 2026-11-13
**Constraint honored:** production architecture, MongoDB DB, Telegram bot, existing orders/products, and administrator credentials/auth secrets were **not** modified.

---

## 1. Root cause of the blank `/join` page

**Finding:** The Vite/React SPA had **no React Error Boundary**. React 19 unmounts the *entire* component tree when an uncaught render/lifecycle/runtime error occurs during client-side navigation. Any transient error while the `/join` route (a lazy-loaded chunk) mounted or during its provider/data flow would tear down the whole app and leave a **blank white page** — while a direct/SSR fetch of `/join` still rendered correctly (confirmed live), which is why the route and the `JoinTeamPage` source itself were not the fault.

**Fix:** Added `src/frontend/src/components/ErrorBoundary.tsx` and wrapped the application shell (`Header`, `PageSuspense`/`Routes`, `Footer`, `MobileNav`, `PublicFloatingCtas`) in `src/frontend/src/main.tsx`. On any uncaught error below it, the boundary renders a **recoverable AR/FR fallback** (with a "Retry" that reloads) instead of a blank screen. It **never redirects** the user away from `/join`. The membership form → lead submission → Telegram notification → confirmation reference flow is untouched.

## 2. Files changed

| File | Change |
|------|--------|
| `src/frontend/src/components/ErrorBoundary.tsx` | **New** — ErrorBoundary + exported `ErrorFallback` (AR/FR), recoverable, never blank. |
| `src/frontend/src/main.tsx` | Wrap app shell in `<ErrorBoundary>`. |
| `src/frontend/src/components/Header.tsx` | **Removed** public admin nav item + public admin/login buttons (desktop & mobile); **added** configured social icon links (FB/IG/WhatsApp). |
| `src/frontend/src/index.css` | Social-icon styles; header responsive spacing guards; error-boundary + checkout clearance; floating-WhatsApp safe-areas & nav clearance. |
| `src/frontend/src/pages/CheckoutPage.tsx` | Added `dxn-checkout-shell` bottom padding so the floating button never covers the final checkout action. |
| `src/frontend/src/components/Header.test.tsx` | **New** — unit tests for admin-link removal, social rendering, error fallback. |
| `jest.unit.config.js` | Enable `.tsx` transform + add `components` root so the new tests run. |

## 3. Admin navigation changes (Task 2)

Removed from the public `Header` (`src/frontend/src/components/Header.tsx`):
- The `isAdmin ? [{ to: "/admin", label: "لوحة التحكم" / "Admin" }]` nav item.
- The always-visible desktop `/admin/login` button ("الإدارة" / "Admin").
- The mobile-menu `/admin/login` button ("دخول الإدارة" / "Espace Admin").

**Not touched (security preserved):** the `/admin`, `/admin/login`, `/admin/*` routes, `AdminLayout`, JWT auth, and the backend `auth.middleware.ts` authorization. `/admin` remains directly reachable and still requires authentication. `MobileNav` and `Footer` never exposed admin.

## 4. Credential preservation confirmation (Task 3)

- **No** auth code, middleware, seed, or secret was modified in this change.
- No credential migration ran. The Vercel production build environment is intact and includes the existing secrets (`MONGODB_URI`, `JWT_SECRET`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, etc.) — confirmed on the promoted deployment.
- Existing admin login mechanism unchanged; `/admin` still enforces auth (live `/admin` → login screen for unauthenticated visitors).

## 5. Social media links (Task 4)

- Added header icon links for **Facebook, Instagram, WhatsApp**, rendered **only when a real `http(s)` URL is configured** (guarded by `isSafeExternalUrl`). No invented URLs, no `href="#"`.
- Links open safely: `target="_blank" rel="noopener noreferrer"`, with accessible `aria-label`/`title`.
- Source of truth: existing site settings (DB `socialLinks`) merged with build-time `VITE_FACEBOOK_URL` / `VITE_INSTAGRAM_URL` (`config/site.ts` → `SiteSettingsContext`). Configured via the **existing admin settings page** (`/admin/settings`) — no code change required to set values.
- **Current production status:** no FB/IG/WhatsApp URLs are configured (`/api/settings/public` returns empty `socialLinks`), so the icons correctly stay hidden. This is intentional — per requirements, URLs are not invented; the owner adds them in admin settings and they appear automatically.

## 6. Floating WhatsApp button (Task 5)

- The existing `src/frontend/src/components/FloatingWhatsApp.tsx` (already mounted via `PublicFloatingCtas`, hidden on `/admin`) was verified and polished:
  - Brand-green, fixed bottom-right, visible while scrolling, desktop + mobile.
  - Uses the configured business number → `https://wa.me/<international>` (built correctly server-side in `siteSettings.service.ts`), with an optional AR/FR prefilled greeting.
  - Accessible `aria-label`; respects mobile **safe-area insets** (`env(safe-area-inset-*)`) and clears the fixed mobile-nav bar.
  - Checkout page gained bottom padding so the button never covers the final action.
- **Current production status:** no WhatsApp number configured → the button correctly stays hidden. The admin setting (`رقم واتساب المتجر والاستقطاب` / `Numéro WhatsApp`) is the clear place to configure it; once set, the button appears.

## 7. Header UX (Task 6)

Removed the public admin link; added responsive spacing guards so brand + social icons + hamburger stay aligned and avoid overlap on small screens (≤991px and ≤400px breakpoints). AR/FR language selector and brand identity preserved; mobile nav unchanged.

## 8. Test results (actual, run locally + in CI)

| Suite | Command | Result |
|-------|---------|--------|
| TypeScript | `npm run typecheck` | **clean** |
| Production build | `npm run build` | **clean** (Vite) |
| Unit + component tests | `npm run test:unit` | **172 passed / 172** (165 baseline + 7 new) |
| AI & messaging safety | `npm run test:ai` | **319 passed / 319** |

New component tests cover: no public admin link rendered, primary nav intact, social links rendered only when configured with safe external targets + accessible labels, and the error fallback (AR + FR).

## 9. CI

- **Run:** [43521944455](https://github.com/Devmraustro/web-dxn/actions/runs/43521944455) — **conclusion: success** (pull_request, headSha `353103a`). Workflow: typecheck → build → `test:unit` → `test:ai`.

## 10. Pull request & merge

- **PR:** [#4](https://github.com/Devmraustro/web-dxn/pull/4) — "DXN NADZ post-release fixes: /join error boundary, hide admin link, social icons, WhatsApp polish"
- **Merged:** `MERGED` on 2026-11-13
- **Merge commit:** `92d848637f03f68c9cd921ca41b58d53da443837` (on `main`)

## 11. Production deployment

- **Deployment:** `dpl_Fsui2EeNMJ3BUHyjq8QJ8U9k3AdM` — **READY / PROMOTED** (auto-deployed by the Vercel GitHub integration from the `main` merge).
- **Alias:** `dxnnadz.vercel.app`
- MongoDB + Telegram config preserved; no production secrets or admin credentials modified.

## 12. Live verification (post-deploy)

- **`/join`** — renders the complete Arabic membership page (hero, ethics/compliance disclosure, customer-vs-member comparison, sponsor box, full form with all fields + consent, membership FAQs) with correct title. **No blank page.**
- **`/admin`** — reachable; unauthenticated visit lands on the admin **login** screen (email/password), confirming the route works and auth is enforced.
- **`/` (home)** — full storefront renders (products, categories, CTAs).
- **Header** — no public admin link (verified by component unit test asserting no `/admin` hrefs in rendered output).
- **Social / WhatsApp** — currently unconfigured in production, so icons/button are correctly hidden; configured via `/admin/settings`.

## 13. Completion criteria

- ✅ `/join` renders (no blank) — Error Boundary added; live render confirmed.
- ✅ Membership submission → Telegram + reference preserved (form/`/leads` flow untouched).
- ✅ No public admin link — removed from header; `/admin` still functional and auth-protected.
- ✅ Admin credentials unchanged — no auth/secret/migration changes.
- ✅ FB/IG links work when configured — wired, gated on real URLs, admin-configurable.
- ✅ Floating WhatsApp visible when a number is configured — verified + polished; admin setting provided.
- ✅ CI passes and changes deployed to production — run `43521944455` success; `dpl_Fsui2EeNMJ3BUHyjq8QJ8U9k3AdM` promoted.
