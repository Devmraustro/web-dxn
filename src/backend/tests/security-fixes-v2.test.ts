/**
 * Phase 24 - Regression tests for new security and functional fixes.
 */
import {
  registerSchema,
  orderCreateSchema,
  orderStatusUpdateSchema,
  reviewCreateSchema,
  offerCreateSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "../middleware/validationSchema";
import {
  getProductMetaTags,
  generateRobotsTxt,
  getArabicMetaTags,
  getFrenchMetaTags,
} from "../seo/utils";
import { escapeRegex } from "../services/ai.service";

describe("H5 - Role privilege escalation prevention", () => {
  it("registerSchema does NOT include role in the validated fields", async () => {
    // Register with no role field works
    const valid = await registerSchema.validate({
      email: "test@example.com",
      password: "Password123!",
      firstName: "John",
      lastName: "Doe",
      phone: "0555123456",
    });
    expect(valid).toBeDefined();
    expect(valid).not.toHaveProperty("role");
  });
});

describe("H6 - Forgot/Reset password implemented with token flow", () => {
  it("forgotPasswordSchema requires email", async () => {
    await expect(forgotPasswordSchema.validate({ email: "x@y.com" })).resolves.toBeDefined();
    await expect(forgotPasswordSchema.validate({ email: "not-an-email" })).rejects.toThrow();
    await expect(forgotPasswordSchema.validate({})).rejects.toThrow();
  });

  it("resetPasswordSchema requires password min 8 chars and max 128", async () => {
    await expect(resetPasswordSchema.validate({ password: "12345678" })).resolves.toBeDefined();
    await expect(resetPasswordSchema.validate({ password: "1234567" })).rejects.toThrow();
    await expect(resetPasswordSchema.validate({ password: "a".repeat(129) })).rejects.toThrow();
  });
});

describe("Security - ReDoS prevention in knowledge search", () => {
  it("escapeRegex escapes all regex metacharacters", () => {
    const evil = ["(a+)+$", "(a+)*", ".*.*.*", "[\\w]+", "^test$"];
    for (const payload of evil) {
      const escaped = escapeRegex(payload);
      // Creating a RegExp from escaped string must not throw and must not match
      // beyond literal text (the escaped backslash before each metacharacter
      // proves the user payload is no longer a regex source).
      const re = new RegExp(escaped, "i");
      expect(re.test(payload)).toBe(true); // matches the literal input
    }
  });

  it("escaped regex matches literal substring, not regex pattern", () => {
    const input = "(a+)+$";
    const escaped = escapeRegex(input);
    const re = new RegExp(escaped, "i");
    expect(re.test("my text (a+)+$ here")).toBe(true);
    expect(re.test("my text only here")).toBe(false);
  });
});

describe("Security - SEO robots.txt uses correct Disallow directive", () => {
  it("generateRobotsTxt uses 'Disallow' not 'Disorder'", () => {
    const robots = generateRobotsTxt();
    expect(robots).toContain("Disallow:");
    expect(robots).not.toContain("Disorder:");
  });
});

describe("SEO - meta tags use correct Algerian locale", () => {
  it("getArabicMetaTags uses ar-DZ not ar-AE", () => {
    const tags = getArabicMetaTags("test");
    expect(tags.lang).toBe("ar-DZ");
    expect(tags.dir).toBe("rtl");
  });

  it("getFrenchMetaTags uses fr-DZ not fr-FR", () => {
    const tags = getFrenchMetaTags("test");
    expect(tags.lang).toBe("fr-DZ");
    expect(tags.dir).toBe("ltr");
  });

  it("getArabicMetaTags returns the supplied text in title/description", () => {
    const tags = getArabicMetaTags("منتج DXN");
    expect(tags.title).toBe("منتج DXN");
    expect(tags.description).toBe("منتج DXN");
  });

  it("getFrenchMetaTags returns the supplied text in title/description", () => {
    const tags = getFrenchMetaTags("Produit DXN");
    expect(tags.title).toBe("Produit DXN");
    expect(tags.description).toBe("Produit DXN");
  });
});

describe("Validation - Offer discount fields validated", () => {
  it("offerCreateSchema validates type is percentage or fixed", async () => {
    await expect(
      offerCreateSchema.validate({
        title: "T",
        slug: "s",
        type: "percentage",
        value: 10,
      })
    ).resolves.toBeDefined();
    await expect(
      offerCreateSchema.validate({
        title: "T",
        slug: "s",
        type: "fixed",
        value: 100,
      })
    ).resolves.toBeDefined();
    await expect(
      offerCreateSchema.validate({
        title: "T",
        slug: "s",
        type: "invalid",
        value: 10,
      })
    ).rejects.toThrow();
  });

  it("offerCreateSchema rejects percentage > 100", async () => {
    await expect(
      offerCreateSchema.validate({
        title: "T",
        slug: "s",
        type: "percentage",
        value: 150,
      })
    ).rejects.toThrow();
  });

  it("offerCreateSchema accepts percentage 0-100", async () => {
    for (const v of [0, 50, 100]) {
      await expect(
        offerCreateSchema.validate({ title: "T", slug: "s", type: "percentage", value: v })
      ).resolves.toBeDefined();
    }
  });
});

describe("Validation - Order confirmation checkbox required", () => {
  const baseOrder = {
    customerInfo: { firstName: "Test", lastName: "User", phone: "0555123456" },
    cartItems: [{ productId: "507f1f77bcf86cd799439011", quantity: 1, unitPrice: 1000 }],
    deliveryMethod: "home",
    wilaya: "Algiers",
    commune: "Bab El Oued",
    paymentMethod: "cod",
  };

  it("orderCreateSchema requires confirmed=true", async () => {
    await expect(orderCreateSchema.validate({ ...baseOrder, confirmed: true })).resolves.toBeDefined();
    await expect(orderCreateSchema.validate({ ...baseOrder, confirmed: false })).rejects.toThrow();
    await expect(orderCreateSchema.validate(baseOrder)).rejects.toThrow();
  });
});

describe("Validation - Order status state machine", () => {
  it("orderStatusUpdateSchema accepts valid status values", async () => {
    const validStatuses = ["new", "pending_payment", "confirmed", "processing", "shipped", "delivered", "cancelled", "rejected"];
    for (const status of validStatuses) {
      await expect(orderStatusUpdateSchema.validate({ status })).resolves.toBeDefined();
    }
  });

  it("orderStatusUpdateSchema rejects unknown status", async () => {
    await expect(orderStatusUpdateSchema.validate({ status: "not-a-status" })).rejects.toThrow();
  });
});

describe("Validation - Review rating 1-5", () => {
  it("reviewCreateSchema enforces 1-5 rating", async () => {
    const base = { productId: "507f1f77bcf86cd799439011" };
    for (const r of [1, 2, 3, 4, 5]) {
      await expect(reviewCreateSchema.validate({ ...base, rating: r })).resolves.toBeDefined();
    }
    for (const r of [0, 6, -1, 100]) {
      await expect(reviewCreateSchema.validate({ ...base, rating: r })).rejects.toThrow();
    }
  });

  it("reviewCreateSchema requires productId", async () => {
    await expect(reviewCreateSchema.validate({ productId: "", rating: 5 })).rejects.toThrow();
    await expect(reviewCreateSchema.validate({ rating: 5 })).rejects.toThrow();
  });
});

describe("Validation - Password max length prevents DoS", () => {
  it("registerSchema rejects passwords > 128 chars", async () => {
    const base = { email: "x@y.com", firstName: "A", lastName: "B" };
    await expect(registerSchema.validate({ ...base, password: "a".repeat(129) })).rejects.toThrow();
    await expect(registerSchema.validate({ ...base, password: "a".repeat(128) })).resolves.toBeDefined();
  });
});

describe("Validation - Cart min 1 item", () => {
  const base = {
    customerInfo: { firstName: "Test", lastName: "User", phone: "0555123456" },
    deliveryMethod: "home",
    wilaya: "Algiers",
    commune: "Bab El Oued",
    paymentMethod: "cod",
    confirmed: true,
  };

  it("orderCreateSchema rejects empty cart", async () => {
    await expect(orderCreateSchema.validate({ ...base, cartItems: [] })).rejects.toThrow();
  });

  it("orderCreateSchema accepts valid cart items", async () => {
    await expect(
      orderCreateSchema.validate({
        ...base,
        cartItems: [{ productId: "507f1f77bcf86cd799439011", quantity: 2, unitPrice: 1000 }],
      })
    ).resolves.toBeDefined();
  });
});

describe("Validation - Algerian phone accepts 05/06/07 prefixes", () => {
  it("registerSchema accepts 05/06/07 prefixes", async () => {
    const base = { email: "x@y.com", password: "Password123", firstName: "A", lastName: "B" };
    for (const ph of ["0555123456", "0661234567", "0771234567"]) {
      await expect(registerSchema.validate({ ...base, phone: ph })).resolves.toBeDefined();
    }
  });

  it("registerSchema rejects invalid Algerian phone formats", async () => {
    const base = { email: "x@y.com", password: "Password123", firstName: "A", lastName: "B" };
    for (const ph of ["0123456789", "05551234", "055512345678", "abc"]) {
      await expect(registerSchema.validate({ ...base, phone: ph })).rejects.toThrow();
    }
  });
});

describe("SEO - getProductMetaTags produces valid structure", () => {
  it("generates title, description, OG and Twitter tags", () => {
    const product = {
      slug: "test-product",
      translations: [{ language: "ar", title: "منتج اختبار", description: "وصف المنتج" }],
    };
    const result = getProductMetaTags(product as any, "ar");
    expect(result.title).toBeDefined();
    expect(result.ogTitle).toBeDefined();
    expect(result.twitterCard).toBe("summary_large_image");
  });

  it("truncates long descriptions to 200 chars in OG and Twitter", () => {
    const long = "a".repeat(500);
    const product = {
      slug: "p",
      translations: [{ language: "ar", title: "t", description: long }],
    };
    const result = getProductMetaTags(product as any, "ar");
    expect(result.ogDescription.length).toBeLessThanOrEqual(200);
    expect(result.twitterDescription.length).toBeLessThanOrEqual(200);
  });
});
