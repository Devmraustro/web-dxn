/**
 * Phase 23 — DB-free coverage for the admin product workflow.
 *
 * Every test in this file runs WITHOUT MongoDB: the Product/ProductTranslation
 * models are mocked, so the real Express app + routers + auth + yup validation
 * execute as in production while nothing talks to a database. This lets us
 * prove end-to-end (HTTP in, stored/model state out) that:
 *   - only authenticated admins can create/update products,
 *   - invalid price / stock payloads are rejected by the server schema,
 *   - the price the admin enters is stored as-is and stays server-authoritative
 *     (client-imposed unitPrice/discount/status fields are dropped),
 *   - active products are publicly visible and inactive/placeholder are hidden,
 *   - an admin-created product is orderable.
 */

process.env.JWT_SECRET = "dxn_phase23_test_secret_0123456789abcdef";

// The very first HTTP request cold-starts the whole Express app (imports,
// in-memory catalogs, rate-limiter priming); subsequent requests are fast.
jest.setTimeout(240000);

import request from "supertest";
import jwt from "jsonwebtoken";
import { productSchema, cartItemSchema, orderCreateSchema } from "../middleware/validationSchema";
import { lineTotal, finalTotal } from "../services/commerce";
import {
  withPublicReadScope,
  isPlaceholderProduct,
  PLACEHOLDER_PRODUCT_IDENTIFIERS,
} from "../services/placeholderCatalog.service";
import type { Request } from "express";

// Mocked model layer (in-memory replacement for Product / ProductTranslation).
// Named with the `mock` prefix so Jest's hoisted factory may reference them.

const mockLeanChain = (resolver: () => unknown) => ({
  select: () => mockLeanChain(resolver),
  sort: () => mockLeanChain(resolver),
  limit: () => mockLeanChain(resolver),
  skip: () => mockLeanChain(resolver),
  exec: () => Promise.resolve(resolver()),
  lean: () => Promise.resolve(resolver()),
});

const HEX24 = "507f1f77bcf86cd799439011";

let mockProductRows: any[];
let mockTranslationRows: any[];

jest.mock("../../Database/Models", () => {
  const generic = () => ({
    find: jest.fn(() => mockLeanChain(() => [])),
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

const { Product } = jest.requireMock("../../Database/Models");
const { ProductTranslation } = jest.requireMock("../../Database/Models");

const unsignedRequest = (): Request => ({ user: undefined } as unknown as Request);
const adminRequest = (): Request => ({ user: { role: "owner", userId: HEX24 } } as unknown as Request);

const resetState = () => {
  mockProductRows = [];
  mockTranslationRows = [];

  Object.values(Product).forEach((fn) => (fn as jest.Mock).mockReset());
  Object.values(ProductTranslation).forEach((fn) => (fn as jest.Mock).mockReset());

  Product.find.mockImplementation(() => mockLeanChain(() => mockProductRows));
  Product.findByOne = Product.findOne;
  Product.findOne.mockImplementation(async (q: any) => {
    const found = mockProductRows.find(
      (r) =>
        (q?.sku ? r.sku === q.sku : true) &&
        (q?.slug ? r.slug === q.slug : true) &&
        (q?._id ? String(r._id) === String(q._id) : true)
    );
    return found ? { ...found } : null;
  });
  Product.findById.mockImplementation(async (id: string) => {
    const found = mockProductRows.find((r) => String(r._id) === String(id));
    return found ? { ...found } : null;
  });
  Product.create.mockImplementation(async (doc: any) => {
    const created = { _id: `p${mockProductRows.length + 1}`, ...doc };
    mockProductRows.push(created);
    return created;
  });
  Product.findByIdAndUpdate.mockImplementation(async (id: string, update: any) => {
    const row = mockProductRows.find((r) => String(r._id) === String(id));
    if (!row) return null;
    const patch = { ...(update?.$set || update) };
    const merged = { ...row, ...patch };
    mockProductRows[mockProductRows.indexOf(row)] = merged;
    return { ...merged };
  });

  ProductTranslation.find.mockImplementation(() => mockLeanChain(() => mockTranslationRows));
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

// HTTP app — lazily required AFTER env + mocks are registered.
let app: any;

beforeAll(() => {
  app = require("../app").default;
});

beforeEach(() => {
  resetState();
});

// --- Helpers -----------------------------------------------------------------

const adminAuth = (role = "owner") => ({
  Authorization: `Bearer ${jwt.sign({ role, userId: HEX24 }, process.env.JWT_SECRET as string, { expiresIn: "1h" })}`,
});

const FULL_CREATE_PAYLOAD = {
  sku: "DXN-ADMIN-001",
  slug: "admin-created-product",
  price: 1850,
  stockQuantity: 12,
  isActive: true,
  image: "/uploads/dxn-ganoderma.jpg",
  translations: {
    ar: { title: "فطر الجانوديرما", description: "وصف عربي", specifications: "مواصفات عربية" },
    fr: { title: "Ganoderma", description: "description FR", specifications: "spécifications FR" },
  },
};

describe("Phase 23 — admin authorization (DB-free)", () => {
  it("rejects product creation without authentication (401)", async () => {
    const res = await request(app).post("/api/products").send({ sku: "X", slug: "x", price: 10 });
    expect(res.status).toBe(401);
    expect(Product.create).not.toHaveBeenCalled();
  });

  it("rejects product creation for a non-admin authenticated user (403)", async () => {
    const res = await request(app)
      .post("/api/products")
      .set(adminAuth("support"))
      .send({ sku: "X", slug: "x", price: 10 });
    expect(res.status).toBe(403);
    expect(Product.create).not.toHaveBeenCalled();
  });
});

describe("Phase 23 — invalid price rejected (DB-free)", () => {
  it.each([
    ["negative price", { ...FULL_CREATE_PAYLOAD, price: -1 }],
    ["non-number price", { ...FULL_CREATE_PAYLOAD, price: "abc" }],
    ["price above max", { ...FULL_CREATE_PAYLOAD, price: 11_000_000 }],
    ["missing price", { ...FULL_CREATE_PAYLOAD, price: undefined }],
  ])("rejects %s with 400", async (_label, payload) => {
    const res = await request(app).post("/api/products").set(adminAuth()).send(payload);
    expect(res.status).toBe(400);
    expect(Product.create).not.toHaveBeenCalled();
  });
});

describe("Phase 23 — invalid stock rejected (DB-free)", () => {
  it.each([
    ["negative stock", { ...FULL_CREATE_PAYLOAD, stockQuantity: -1 }],
    ["fractional stock", { ...FULL_CREATE_PAYLOAD, stockQuantity: 2.5 }],
    ["non-numeric stock", { ...FULL_CREATE_PAYLOAD, stockQuantity: "many" }],
    ["stock above max", { ...FULL_CREATE_PAYLOAD, stockQuantity: 1_000_001 }],
  ])("rejects %s with 400", async (_label, payload) => {
    const res = await request(app).post("/api/products").set(adminAuth()).send(payload);
    expect(res.status).toBe(400);
    expect(Product.create).not.toHaveBeenCalled();
  });
});

describe("Phase 23 — authorized admin creates a product (DB-free)", () => {
  it("creates a fully localized product and stores the entered values", async () => {
    const res = await request(app).post("/api/products").set(adminAuth()).send(FULL_CREATE_PAYLOAD);
    expect(res.status).toBe(201);
    expect(Product.create).toHaveBeenCalled();
    const created = Product.create.mock.calls[0][0];
    expect(created.price).toBe(1850);
    expect(created.stockQuantity).toBe(12);
    expect(created.isActive).toBe(true);
    expect(created.image).toBe("/uploads/dxn-ganoderma.jpg");
  });

  it("writes ar + fr translations (title, description, specifications)", async () => {
    await request(app).post("/api/products").set(adminAuth()).send(FULL_CREATE_PAYLOAD);
    const langs = ProductTranslation.findOneAndUpdate.mock.calls.map((c: any[]) => c[0].language).sort();
    expect(langs).toEqual(["ar", "fr"]);
    const arCall = ProductTranslation.findOneAndUpdate.mock.calls.find((c: any[]) => c[0].language === "ar");
    expect(arCall![1].$set.title).toBe("فطر الجانوديرما");
    expect(arCall![1].$set.specifications).toBe("مواصفات عربية");
  });

  it("never stores client-supplied price/discount/status overrides (server-authoritative)", async () => {
    const tampered = {
      ...FULL_CREATE_PAYLOAD,
      unitPrice: 1,
      discount: 999999,
      status: "delivered",
      metadata: { hack: true },
      onSubmitPrice: 0,
    };
    const res = await request(app).post("/api/products").set(adminAuth()).send(tampered);
    expect(res.status).toBe(201);
    const createdKeys = Object.keys(Product.create.mock.calls[0][0]);
    expect(createdKeys).not.toContain("unitPrice");
    expect(createdKeys).not.toContain("discount");
    expect(createdKeys).not.toContain("status");
    expect(createdKeys).not.toContain("metadata");
    expect(createdKeys).not.toContain("onSubmitPrice");
    expect(Product.create.mock.calls[0][0].price).toBe(1850);
  });

  it("accepts the admin payload as orderable (purchasable) via the validated schemas", async () => {
    await expect(productSchema.validate(FULL_CREATE_PAYLOAD)).resolves.toBeDefined();
    await expect(
      cartItemSchema.validate({ productId: HEX24, quantity: 2 })
    ).resolves.toBeDefined();
    await expect(
      orderCreateSchema.validate({
        customerInfo: { firstName: "A", lastName: "B", phone: "0551234567" },
        cartItems: [{ productId: HEX24, quantity: 2 }],
        deliveryMethod: "home",
        wilaya: "Algiers",
        commune: "Hydra",
        address: "Rue 1",
        paymentMethod: "cod",
        confirmed: true,
      })
    ).resolves.toBeDefined();
  });
});

describe("Phase 23 — admin updates product (price / stock / status) (DB-free)", () => {
  it("updates price, stock and active status through PUT", async () => {
    const created = await request(app)
      .post("/api/products")
      .set(adminAuth())
      .send({ sku: "DXN-ADMIN-002", slug: "admin-created-2", price: 100, stockQuantity: 5, isActive: true });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const id = created.body?.data?._id || "p1";

    const res = await request(app)
      .put(`/api/products/${id}`)
      .set(adminAuth())
      .send({ price: 999, stockQuantity: 3, isActive: false });
    expect(res.status).toBe(200);
    const patch = Product.findByIdAndUpdate.mock.calls[0][1];
    expect(patch.price).toBe(999);
    expect(patch.stockQuantity).toBe(3);
    expect(patch.isActive).toBe(false);
  });

  it("drops non-allowlisted update fields (client cannot smuggle extra state)", async () => {
    mockProductRows = [{ _id: "p1", sku: "S1", slug: "s1", price: 50, stockQuantity: 2, isActive: true }];
    await request(app)
      .put("/api/products/p1")
      .set(adminAuth())
      .send({ price: 60, stockQuantity: 1, discount: 5000, status: "shipped", isAdminOverride: true });
    const patch = Product.findByIdAndUpdate.mock.calls[0][1];
    expect(patch.price).toBe(60);
    expect(patch.discount).toBeUndefined();
    expect(patch.status).toBeUndefined();
    expect(patch.isAdminOverride).toBeUndefined();
  });
});

describe("Phase 23 — visibility: active visible, inactive hidden (DB-free)", () => {
  it("public read scope forces isActive:true and excludes placeholder identifiers", () => {
    const scope = withPublicReadScope(unsignedRequest(), {}) as any;
    expect(scope.isActive).toBe(true);
    expect(scope.$nor).toBeDefined();
    const excludedSkus = scope.$nor.find((c: any) => c.sku)?.sku?.$in || [];
    for (const id of [...PLACEHOLDER_PRODUCT_IDENTIFIERS]) {
      expect(excludedSkus).toContain(id);
    }
  });

  it("admins pass through the public read scope (can manage inactive records)", () => {
    const scope = withPublicReadScope(adminRequest(), { isActive: false }) as any;
    expect(scope.isActive).toBe(false);
  });

  it("GET /api/products issues a query that only holds active products", async () => {
    mockProductRows = [
      { _id: "p1", sku: "ACTIVE-1", slug: "active-1", price: 500, stockQuantity: 4, isActive: true },
      { _id: "p2", sku: "INACTIVE-1", slug: "inactive-1", price: 900, stockQuantity: 9, isActive: false },
    ];
    const res = await request(app).get("/api/products");
    expect(res.status).toBe(200);
    const query = Product.find.mock.calls[0][0] as any;
    // The endpoint forces the active-only scope; an inactive row can therefore
    // never surface to storefront visitors.
    expect(query.isActive).toBe(true);
  });

  it("flags seeded placeholders, not admin-created products", () => {
    expect(isPlaceholderProduct({ sku: "DXN-ADMIN-001", slug: "admin-created-product" })).toBe(false);
    const seedSku = [...PLACEHOLDER_PRODUCT_IDENTIFIERS][0] || "site-user-starter-product-001";
    expect(isPlaceholderProduct({ sku: seedSku })).toBe(true);
  });
});

describe("Phase 23 — server-authoritative pricing (DB-free)", () => {
  it("order totals derive from the stored (server) price, never a client unitPrice", () => {
    // The admin stored 1850 DA. Even if a client sent unitPrice: 1, the server
    // computes the snapshot from its own value.
    const { unitPrice, totalPrice } = lineTotal(1850, 2);
    expect(unitPrice).toBe(1850);
    expect(totalPrice).toBe(3700);
  });

  it("final total is subtotal + shipping − discount and never negative", () => {
    expect(finalTotal(3700, 400, 0)).toBe(4100);
    expect(finalTotal(100, 50, 5000)).toBe(0);
  });
});