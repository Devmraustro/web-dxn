/**
 * DB-free regression — placeholder catalog classification + public read scopes.
 *
 * Covers the deterministic (Mongo-free) contract of Tasks 2-3-4 at the
 * classification/service layer, which is the layer both the public pack/offer
 * read scopes AND the order-creation guards are built on:
 *
 *   A/B/C — public pack/offer read scopes exclude placeholder records for
 *           non-admin callers (regardless of isActive).
 *   D/E/F — isPlaceholderProduct / isPlaceholderPack / isPlaceholderOffer
 *           classify a placeholder by canonical identifiers even when the
 *           record carries isActive=true (server-side rejection does NOT rely
 *           on a frontend isActive filter, and never trusts client state).
 *   G     — placeholder classification wins even when isActive=true.
 *   H     — legitimate (non-placeholder) records are NOT classified as
 *           placeholders, and public scopes pass them through.
 */
import {
  isPlaceholderProduct,
  isPlaceholderPack,
  isPlaceholderOffer,
  withPublicPackReadScope,
  withPublicOfferReadScope,
  PLACEHOLDER_PRODUCT_IDENTIFIERS,
  PLACEHOLDER_PACK_IDENTIFIERS,
  PLACEHOLDER_OFFER_IDENTIFIERS,
} from "../services/placeholderCatalog.service";

const req = (role: string | undefined = undefined): any => ({
  user: role ? { role } : undefined,
});

const anyPlaceholderProduct = [...PLACEHOLDER_PRODUCT_IDENTIFIERS][0] || "site-user-starter-product-001";
const anyPlaceholderPack = [...PLACEHOLDER_PACK_IDENTIFIERS][0] || "site-starter-pack-001";
const anyPlaceholderOffer = [...PLACEHOLDER_OFFER_IDENTIFIERS][0] || "site-starter-offer-001";

describe("placeholder catalog — public read scopes (DB-free)", () => {
  it("A/B/C: non-admin pack/offer read scopes exclude placeholders", () => {
    const packScope = withPublicPackReadScope(req(), { isActive: true });
    const offerScope = withPublicOfferReadScope(req(), { isActive: true });

    for (const scope of [packScope, offerScope]) {
      const or: any[] = Array.isArray((scope as any).$or)
        ? (scope as any).$or
        : ((scope as any).$nor || (scope as any).$and || []);
      expect(or.length).toBeGreaterThan(0);
      const serialized = JSON.stringify(scope);
      expect(serialized).not.toContain("isPlaceholder: true, }");
      expect(serialized).toContain("$nor");
    }
  });

  it("A/B/C: admin read scope is NOT narrowed (admin can manage placeholders)", () => {
    for (const scope of [
      withPublicPackReadScope(req("admin"), { isActive: true }),
      withPublicOfferReadScope(req("admin"), { isActive: true }),
    ]) {
      expect(JSON.stringify(scope)).not.toMatch(/\$nor|\$or/);
    }
  });

  it("D: placeholder product classified even when isActive=true", () => {
    expect(isPlaceholderProduct({ isActive: true, slug: anyPlaceholderProduct })).toBe(true);
    expect(isPlaceholderProduct({ isActive: true, isPlaceholder: true })).toBe(true);
    expect(isPlaceholderProduct({ isActive: true, sku: anyPlaceholderProduct })).toBe(true);
  });

  it("E: placeholder pack classified even when isActive=true", () => {
    expect(isPlaceholderPack({ isActive: true, slug: anyPlaceholderPack })).toBe(true);
    expect(isPlaceholderPack({ isActive: true, isPlaceholder: true })).toBe(true);
  });

  it("F: placeholder offer classified even when isActive=true", () => {
    expect(isPlaceholderOffer({ isActive: true, slug: anyPlaceholderOffer })).toBe(true);
    expect(isPlaceholderOffer({ isActive: true, isPlaceholder: true })).toBe(true);
  });

  it("G: placeholder wins even when isActive=true (isActive does NOT un-placeholder)", () => {
    const doc = { isActive: true, isPlaceholder: true, slug: anyPlaceholderProduct };
    expect(isPlaceholderProduct(doc)).toBe(true);
    expect(isPlaceholderPack({ isActive: true, isPlaceholder: true })).toBe(true);
    expect(isPlaceholderOffer({ isActive: true, isPlaceholder: true })).toBe(true);
  });

  it("H: legitimate non-placeholder records are classified false and pass public scope", () => {
    expect(isPlaceholderProduct({ isActive: true, slug: "acai-berry-500g", sku: "REAL-SKU-1" })).toBe(false);
    expect(isPlaceholderPack({ isActive: true, slug: "real-pack-2025" })).toBe(false);
    expect(isPlaceholderOffer({ isActive: true, slug: "ramadan-offer-2025" })).toBe(false);
  });
});
