/**
 * DB-free unit tests for the server-authoritative commerce math and for the
 * validation rules that protect it. These run without MongoDB.
 */
import {
  OrderValidationError,
  roundMoney,
  normalizeQuantity,
  assertValidUnitPrice,
  lineTotal,
  offerDiscountForLine,
  finalTotal,
} from "../services/commerce";
import { defaultShippingFee } from "../services/shipping.service";
import { offerCreateSchema, cartItemSchema } from "../middleware/validationSchema";
import { generateSitemap, generateRobotsTxt, ALGERIAN_WILAYAS } from "../seo/utils";

describe("commerce — money rounding", () => {
  it("roundMoney rounds to 2 decimals", () => {
    expect(roundMoney(1.005)).toBe(1.01);
    expect(roundMoney(10.999)).toBe(11);
    expect(roundMoney(0)).toBe(0);
  });
});

describe("commerce — normalizeQuantity", () => {
  it("accepts positive integers and numeric strings", () => {
    expect(normalizeQuantity(1)).toBe(1);
    expect(normalizeQuantity("12")).toBe(12);
    expect(normalizeQuantity(999)).toBe(999);
  });

  it("rejects zero, negatives, fractions, NaN and absurd values", () => {
    for (const bad of [0, -1, 1.5, NaN, Infinity, "abc", 1000, null, undefined]) {
      expect(() => normalizeQuantity(bad)).toThrow(OrderValidationError);
    }
  });
});

describe("commerce — lineTotal derives from server price only", () => {
  it("computes quantity * unitPrice", () => {
    expect(lineTotal(100, 2)).toEqual({ unitPrice: 100, quantity: 2, totalPrice: 200 });
  });

  it("rejects a negative/NaN server price", () => {
    expect(() => lineTotal(-5, 1)).toThrow(OrderValidationError);
    expect(() => lineTotal(NaN, 1)).toThrow(OrderValidationError);
  });
});

describe("commerce — offerDiscountForLine caps discounts per line", () => {
  it("caps percentage offers at 100%", () => {
    expect(offerDiscountForLine(1000, "percentage", 50)).toBe(500);
    expect(offerDiscountForLine(1000, "percentage", 150)).toBe(1000); // never > subtotal
  });

  it("caps fixed offers at the line subtotal (never negative)", () => {
    expect(offerDiscountForLine(500, "fixed", 100000)).toBe(500);
    expect(offerDiscountForLine(500, "fixed", 100)).toBe(100);
  });

  it("treats non-finite or negative offer values as zero discount", () => {
    expect(offerDiscountForLine(500, "percentage", NaN)).toBe(0);
    expect(offerDiscountForLine(500, "fixed", -10)).toBe(0);
  });
});

describe("commerce — finalTotal can never go negative", () => {
  it("computes subtotal + shipping - discount", () => {
    expect(finalTotal(1000, 400, 200)).toBe(1200);
  });

  it("floors at zero when discount exceeds subtotal + shipping", () => {
    expect(finalTotal(100, 50, 5000)).toBe(0);
  });
});

describe("shipping — env-driven default fee", () => {
  const OLD = process.env;

  afterEach(() => {
    process.env = OLD;
  });

  it("defaultShippingFee falls back to 0 when unset/invalid", () => {
    delete process.env.DEFAULT_SHIPPING_HOME;
    delete process.env.DEFAULT_SHIPPING_OFFICE;
    expect(defaultShippingFee("home")).toBe(0);
    expect(defaultShippingFee("office")).toBe(0);
  });

  it("defaultShippingFee reads valid env values and clamps negatives", () => {
    process.env.DEFAULT_SHIPPING_HOME = "700";
    process.env.DEFAULT_SHIPPING_OFFICE = "450";
    expect(defaultShippingFee("home")).toBe(700);
    expect(defaultShippingFee("office")).toBe(450);

    process.env.DEFAULT_SHIPPING_HOME = "-5";
    process.env.DEFAULT_SHIPPING_OFFICE = "abc";
    expect(defaultShippingFee("home")).toBe(0);
    expect(defaultShippingFee("office")).toBe(0);
  });
});

describe("validation — offer value bound depends on offer type", () => {
  it("percentage offers reject values above 100", async () => {
    await expect(
      offerCreateSchema.validate({ title: "T", slug: "s", type: "percentage", value: 120 })
    ).rejects.toThrow();
    await expect(
      offerCreateSchema.validate({ title: "T", slug: "s", type: "percentage", value: 100 })
    ).resolves.toBeDefined();
  });

  it("fixed offers accept values above 100 (DA amounts)", async () => {
    await expect(
      offerCreateSchema.validate({ title: "T", slug: "s", type: "fixed", value: 1500 })
    ).resolves.toBeDefined();
  });
});

describe("validation — cart lines must reference exactly one product OR pack", () => {
  const validLine = { productId: "507f1f77bcf86cd799439011", quantity: 1 };

  it("accepts product-only or pack-only lines", async () => {
    await expect(cartItemSchema.validate(validLine)).resolves.toBeDefined();
    await expect(
      cartItemSchema.validate({ packId: "507f1f77bcf86cd799439011", quantity: 2 })
    ).resolves.toBeDefined();
  });

  it("rejects both/neither identifiers", async () => {
    await expect(
      cartItemSchema.validate({ ...validLine, packId: "507f1f77bcf86cd799439011", quantity: 1 })
    ).rejects.toThrow(/exactly one/);
    await expect(cartItemSchema.validate({ quantity: 1 })).rejects.toThrow(/exactly one/);
  });
});

describe("seo — canonical wilaya data drives generated output", () => {
  it("ALGERIAN_WILAYAS has exactly 58 wilayas from the canonical dataset", () => {
    expect(ALGERIAN_WILAYAS).toHaveLength(58);
    expect(ALGERIAN_WILAYAS).toContain("Algiers");
    expect(ALGERIAN_WILAYAS).toContain("Tamanrasset");
  });

  it("generateSitemap contains only valid storefront/product URLs (no dead wilaya links)", () => {
    const sitemap = generateSitemap(
      [{ slug: "dxn-ganoderma", isActive: true, updatedAt: new Date("2026-01-01") }],
      "https://store.example"
    );
    expect(sitemap).toContain("https://store.example/");
    expect(sitemap).toContain("https://store.example/products");
    expect(sitemap).toContain("https://store.example/product/dxn-ganoderma");
    // No loc pointing to a route that does not exist in the storefront.
    expect(sitemap).not.toContain("/shipping");
    expect(sitemap).not.toContain("?wilaya=");
  });

  it("generateRobotsTxt disallows admin/api/meta and lists the sitemap", () => {
    const robots = generateRobotsTxt();
    expect(robots).toContain("Disallow: /admin");
    expect(robots).toContain("Disallow: /api/");
    expect(robots).toContain("Disallow: /meta/");
    expect(robots).toContain("Sitemap: https://dxn.dz/sitemap.xml");
  });
});
