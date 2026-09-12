/**
 * Regression tests for the production bug where GET /api/products returned
 * zero rows even though real, active products existed.
 *
 * ROOT CAUSE (confirmed): getProducts unconditionally injected optional query
 * keys into the MongoDB filter:
 *     ...query,
 *     isFeatured: query.isFeatured,   // undefined when ?featured absent
 *     sortOrder: query.sortOrder,     // undefined when ?sortOrder absent
 * MongoDB treats those `undefined` keys as null-equivalent predicates, so a
 * document with `isFeatured: false` / `sortOrder: 0` never matches — hence
 * count 0 while `findOne({ slug, isActive:true })` still returned the product.
 *
 * These tests are DB-free: `../../Database/Models` is mocked with a `find` that
 * faithfully applies MongoDB filter semantics (undefined/null keys only match
 * fields that are null or missing), so the regression is caught without a real
 * database. The real Express app + routers + withPublicReadScope execute as in
 * production.
 */

process.env.JWT_SECRET = "dxn_product_list_regression_secret_0123456789abcdef";

jest.setTimeout(240000);

import request from "supertest";
import {
  withPublicReadScope,
  PLACEHOLDER_PRODUCT_IDENTIFIERS,
} from "../services/placeholderCatalog.service";
import type { Request } from "express";

// --- Mocked model layer (in-memory replacement for Product / Translation) ----

let mockProductRows: any[];
let mockTranslationRows: any[];
let lastFindQuery: any;
let sortCalls: any[] = [];

const leanChain = (rows: any[]): any => ({
  select: () => leanChain(rows),
  sort: (sort: any) => {
    sortCalls.push(sort);
    return leanChain(rows);
  },
  limit: () => leanChain(rows),
  skip: () => leanChain(rows),
  exec: () => Promise.resolve(rows),
  lean: () => Promise.resolve(rows),
});

jest.mock("../../Database/Models", () => {
  const generic = () => ({
    find: jest.fn(),
    findOne: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findOneAndUpdate: jest.fn(),
    countDocuments: jest.fn().mockResolvedValue(0),
    aggregate: jest.fn().mockResolvedValue([]),
  });

  const models: Record<string, unknown> = {};
  for (const name of [
    "User", "Customer", "Pack", "PackItem", "Offer", "Order",
    "Wilaya", "ShippingRate", "Review", "AIKnowledge", "Conversation",
    "Message", "SocialAccount", "WebhookEvent", "AdminNote",
  ]) {
    models[name] = generic();
  }

  const Product = generic();
  const ProductTranslation = generic();
  models.Product = Product;
  models.ProductTranslation = ProductTranslation;

  return {
    ...models,
    default: models,
    __esModule: true,
  };
});

const { Product } = jest.requireMock("../../Database/Models") as any;
const { ProductTranslation } = jest.requireMock("../../Database/Models") as any;

const unsignedRequest = (): Request => ({ user: undefined } as unknown as Request);

// Mongo-style single-condition matcher. An `undefined`/`null` value only
// matches a field that is itself null or missing (this is what made the bug
// exclude `isFeatured: false` and `sortOrder: 0` documents).
const conditionMatches = (row: any, key: string, value: any): boolean => {
  if (value && typeof value === "object" && "$in" in value) {
    return (value.$in as unknown[]).includes(row[key]);
  }
  if (value && typeof value === "object" && "$regex" in value) {
    const flags = typeof (value as any).$options === "string" ? (value as any).$options : "";
    return new RegExp((value as any).$regex as string, flags).test(String(row[key] ?? ""));
  }
  if (value === undefined || value === null) {
    return row[key] === undefined || row[key] === null;
  }
  return row[key] === value;
};

const branchMatches = (row: any, branch: Record<string, any>): boolean =>
  Object.entries(branch).every(([k, v]) => conditionMatches(row, k, v));

// Applies MongoDB semantics to the mocked find: all top-level conditions are
// ANDed; $nor requires every branch to fail; $or requires one branch to match.
const applyFilter = (rows: any[], query: Record<string, any> | undefined): any[] => {
  if (!query) return rows;
  return rows.filter((row) =>
    Object.entries(query).every(([key, value]) => {
      if (key === "$nor") {
        const branches = value as Record<string, any>[];
        return !branches.some((b) => branchMatches(row, b));
      }
      if (key === "$or") {
        const branches = value as Record<string, any>[];
        return branches.some((b) => branchMatches(row, b));
      }
      return conditionMatches(row, key, value);
    })
  );
};

const resetState = () => {
  mockProductRows = [];
  mockTranslationRows = [];
  lastFindQuery = undefined;
  sortCalls = [];

  Object.values(Product).forEach((fn: any) => fn.mockReset());
  Object.values(ProductTranslation).forEach((fn: any) => fn.mockReset());

  Product.find.mockImplementation((query: any) => {
    lastFindQuery = query;
    return leanChain(applyFilter(mockProductRows, query));
  });
  ProductTranslation.find.mockImplementation((query: any) =>
    leanChain(applyFilter(mockTranslationRows, query))
  );
  ProductTranslation.findOneAndUpdate.mockImplementation(async (q: any, update: any) => {
    const existing = mockTranslationRows.find(
      (r) => String(r.productId) === String(q.productId) && r.language === q.language
    );
    const patch = update?.$set || {};
    if (existing) {
      Object.assign(existing, patch);
      return { ...existing };
    }
    const doc = { productId: q.productId, language: q.language, ...patch };
    mockTranslationRows.push(doc);
    return doc;
  });
};

// --- HTTP app (lazily required after mocks) ---

let app: any;
beforeAll(() => {
  app = require("../app").default;
});

beforeEach(() => {
  resetState();
});

// --- Fixtures: exact production document shapes --------------------------------

const REAL_ACTIVE_PRODUCT = {
  _id: "507f1f77bcf86cd799439011",
  sku: "DXN-MTYAKDBP",
  slug: "yjyjyjyjyj",
  price: 2000,
  stockQuantity: 4,
  images: [],
  isActive: true,
  isFeatured: false,
  sortOrder: 0,
  title: "Un produit actif",
};

const FEATURED_PRODUCT = {
  _id: "507f1f77bcf86cd799439022",
  sku: "DXN-FEATURED-001",
  slug: "featured-product",
  price: 1500,
  stockQuantity: 9,
  images: [],
  isActive: true,
  isFeatured: true,
  sortOrder: 1,
};

const PLACEHOLDER_PRODUCT = {
  _id: "507f1f77bcf86cd799439033",
  sku: [...PLACEHOLDER_PRODUCT_IDENTIFIERS][0] || "DXN-LC3",
  slug: [...PLACEHOLDER_PRODUCT_IDENTIFIERS][1] || "lingzhi-coffee-3in1",
  price: 1200,
  stockQuantity: 50,
  images: [],
  isActive: true,
  isFeatured: true,
  sortOrder: 1,
};

describe("GET /api/products — undefined filter regression (DB-free)", () => {
  it("returns active real products with isFeatured:false and sortOrder:0 when no filters are supplied", async () => {
    mockProductRows = [REAL_ACTIVE_PRODUCT];
    const res = await request(app).get("/api/products").expect(200);
    expect(res.body.success).toBe(true);
    // count comes from the enriched rows: the product MUST be returned
    expect(res.body.count).toBe(1);
    expect(res.body.data[0].sku).toBe("DXN-MTYAKDBP");
    // The Mongo query must not carry undefined-valued keys
    expect(Object.prototype.hasOwnProperty.call(lastFindQuery, "isFeatured")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(lastFindQuery, "sortOrder")).toBe(false);
    expect(lastFindQuery.isActive).toBe(true);
  });

  it("does not drop a document with isFeatured:false and sortOrder:0 when ?featured is absent", async () => {
    mockProductRows = [
      REAL_ACTIVE_PRODUCT,
      { ...FEATURED_PRODUCT, isFeatured: false, sortOrder: 0 },
    ];
    const res = await request(app).get("/api/products").expect(200);
    expect(res.body.count).toBe(2);
    const skus = res.body.data.map((p: any) => p.sku);
    expect(skus).toContain("DXN-MTYAKDBP");
  });

  it("still filters by isFeatured when ?featured=true is explicitly supplied", async () => {
    mockProductRows = [REAL_ACTIVE_PRODUCT, FEATURED_PRODUCT];
    const res = await request(app).get("/api/products?featured=true").expect(200);
    expect(res.body.count).toBe(1);
    expect(res.body.data[0].sku).toBe(FEATURED_PRODUCT.sku);
    expect(lastFindQuery.isFeatured).toBe(true);
  });

  it("still filters by isFeatured=false when ?featured=false is explicitly supplied", async () => {
    mockProductRows = [REAL_ACTIVE_PRODUCT, FEATURED_PRODUCT];
    const res = await request(app).get("/api/products?featured=false").expect(200);
    expect(res.body.count).toBe(1);
    expect(res.body.data[0].sku).toBe(REAL_ACTIVE_PRODUCT.sku);
    expect(lastFindQuery.isFeatured).toBe(false);
  });

  it("never injects sortOrder into the filter and preserves result sorting", async () => {
    mockProductRows = [
      { ...REAL_ACTIVE_PRODUCT, sortOrder: 5 },
      FEATURED_PRODUCT,
    ];
    const res = await request(app).get("/api/products").expect(200);
    expect(res.body.count).toBe(2);
    expect(Object.prototype.hasOwnProperty.call(lastFindQuery, "sortOrder")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(lastFindQuery, "isFeatured")).toBe(false);
    // The endpoint sorts by sortOrder asc, createdAt desc (unchanged contract)
    expect(sortCalls).toContainEqual({ sortOrder: 1, createdAt: -1 });
  });

  it("still excludes placeholder seed products (protection unchanged)", async () => {
    mockProductRows = [REAL_ACTIVE_PRODUCT, PLACEHOLDER_PRODUCT];
    const res = await request(app).get("/api/products").expect(200);
    expect(res.body.count).toBe(1);
    expect(res.body.data[0].sku).toBe(REAL_ACTIVE_PRODUCT.sku);
    expect(res.body.data.some((p: any) => p.sku === PLACEHOLDER_PRODUCT.sku)).toBe(false);
  });

  it("keeps the $nor placeholder guard inside the query", () => {
    const scope = withPublicReadScope(unsignedRequest(), { isActive: true }) as Record<string, any>;
    expect(scope.isActive).toBe(true);
    expect(scope.$nor).toHaveLength(4);
    const skuLeg = scope.$nor.find((c: any) => c.sku)?.sku?.$in || [];
    expect(skuLeg).toContain([...PLACEHOLDER_PRODUCT_IDENTIFIERS][0]);
    // placeholder identifiers must be covered on sku and slug legs
    for (const id of [...PLACEHOLDER_PRODUCT_IDENTIFIERS]) {
      expect(scope.$nor.find((c: any) => c.sku)?.sku?.$in).toContain(id);
      expect(scope.$nor.find((c: any) => c.slug)?.slug?.$in).toContain(id);
    }
  });
});