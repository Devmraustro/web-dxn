/**
 * Placeholder / seed-only catalog guard.
 *
 * WHY THIS EXISTS
 * - The idempotent starter seed (bootstrap.service.ts / seed script) populates
 *   a brand-new database with a *placeholder* DXN catalog
 *   (STARTER_PRODUCTS / STARTER_PACKS / STARTER_OFFERS in dxnCatalog.ts).
 *   Those records are meant as a development scaffold, NOT a sellable catalog.
 * - This module makes the code-versioned starter catalog the single source of
 *   truth for identifying placeholder records so that, server-side, they can
 *   never be publicly listed or purchased.
 *
 * HOW IT WORKS (no DB mutation, deterministic)
 * - `PLACEHOLDER_*_IDENTIFIERS` are derived from the exact seeded identifier
 *   sets. Records that already exist in production (created by an earlier seed)
 *   carry one of these sku/slug values, so they are recognized without touching
 *   the database.
 * - Explicit marker fields (`source: "seed"`, `isPlaceholder: true`) also
 *   identify placeholders for fresh seeds, and are authoritative when present.
 * - Public reads funnel through `withPublicReadScope(req, baseQuery)` which
 *   always excludes (a) placeholder records and (b) inactive records, unless
 *   the caller is an authenticated admin (existing `authenticate` + `adminOnly`
 *   token), in which case pass-through is allowed so admins can manage them.
 */

import { Request } from "express";
import {
  STARTER_PRODUCTS,
  STARTER_PACKS,
  STARTER_OFFERS,
} from "../data/dxnCatalog";

export const PLACEHOLDER_PRODUCT_IDENTIFIERS: ReadonlySet<string> = new Set(
  STARTER_PRODUCTS.flatMap((p: any) => [p.sku, p.slug].filter(Boolean))
);
export const PLACEHOLDER_PACK_IDENTIFIERS: ReadonlySet<string> = new Set(
  STARTER_PACKS.map((p: any) => p.slug).filter(Boolean)
);
export const PLACEHOLDER_OFFER_IDENTIFIERS: ReadonlySet<string> = new Set(
  STARTER_OFFERS.map((o: any) => o.slug).filter(Boolean)
);

/** True when a document carries an explicit seed-only marker. */
function hasSeedMarker(doc: any): boolean {
  return !!doc && (doc.source === "seed" || doc.isPlaceholder === true);
}

export function isPlaceholderProduct(doc: any): boolean {
  if (hasSeedMarker(doc)) return true;
  if (!doc) return false;
  return (
    PLACEHOLDER_PRODUCT_IDENTIFIERS.has(doc.sku) ||
    PLACEHOLDER_PRODUCT_IDENTIFIERS.has(doc.slug)
  );
}

export function isPlaceholderPack(doc: any): boolean {
  if (hasSeedMarker(doc)) return true;
  if (!doc) return false;
  return PLACEHOLDER_PACK_IDENTIFIERS.has(doc.slug);
}

export function isPlaceholderOffer(doc: any): boolean {
  if (hasSeedMarker(doc)) return true;
  if (!doc) return false;
  return PLACEHOLDER_OFFER_IDENTIFIERS.has(doc.slug);
}

/** Roles allowed to see placeholder/inactive records (matches adminOnly). */
const ADMIN_ROLES = new Set(["owner", "admin"]);

export function isAdminUser(role?: string): boolean {
  return !!role && ADMIN_ROLES.has(role);
}

function getRequestedRole(req: Request): string | undefined {
  const user = (req as any).user;
  return user && typeof user === "object" ? user.role : undefined;
}

/**
 * Merge a public scope into `base` so placeholders and inactive records are
 * hidden from everyone except authenticated admins.
 * - Admin reads keep seeing everything (manage/query keeps working).
 * - Anonymous/storefront readers only ever see active, non-placeholder rows.
 * - `includeInactive` picks the explicit (admin) vs implicit (public) mode for
 *   list endpoints that already filter `isActive`.
 */
export function withPublicReadScope(
  req: Request,
  base: Record<string, unknown>,
  opts: { includeBefore?: boolean } = {}
): Record<string, unknown> {
  const admin = isAdminUser(getRequestedRole(req));
  if (admin) return { ...base };

  const out: Record<string, unknown> = { isActive: true, ...base };
  if (opts.includeBefore && base.isActive === undefined) {
    delete out.isActive;
  }
  out.isActive = true;
  return {
    ...out,
    $nor: [
      { sku: { $in: [...PLACEHOLDER_PRODUCT_IDENTIFIERS] } },
      { slug: { $in: [...PLACEHOLDER_PRODUCT_IDENTIFIERS] } },
      { isPlaceholder: true },
      { source: "seed" },
    ],
  };
}

/**
 * Public read scope for packs. Mirrors `withPublicReadScope` but excludes the
 * seed-only PACK placeholder identifiers (and any explicit placeholder/seed
 * markers) so starter packs are never visible to non-admins. Admins keep
 * pass-through so the protected admin catalog can manage them.
 */
export function withPublicPackReadScope(
  req: Request,
  base: Record<string, unknown>
): Record<string, unknown> {
  if (isAdminUser(getRequestedRole(req))) return { ...base };
  return {
    ...base,
    isActive: true,
    $nor: [
      { slug: { $in: [...PLACEHOLDER_PACK_IDENTIFIERS] } },
      { isPlaceholder: true },
      { source: "seed" },
    ],
  };
}

/**
 * Public read scope for offers. Mirrors `withPublicReadScope` but excludes the
 * seed-only OFFER placeholder identifiers (and any explicit placeholder/seed
 * markers) so starter offers are never visible to non-admins. Admins keep
 * pass-through so the protected admin catalog can manage them.
 */
export function withPublicOfferReadScope(
  req: Request,
  base: Record<string, unknown>
): Record<string, unknown> {
  if (isAdminUser(getRequestedRole(req))) return { ...base };
  return {
    ...base,
    isActive: true,
    $nor: [
      { slug: { $in: [...PLACEHOLDER_OFFER_IDENTIFIERS] } },
      { isPlaceholder: true },
      { source: "seed" },
    ],
  };
}
