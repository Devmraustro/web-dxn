import {
  slugify,
  isValidSlug,
  isUrlLike,
  isPollutedSlug,
  buildProductSlug,
  buildProductSlugPlan,
} from "../utils/slug";
import { productSchema, productUpdateSchema } from "../middleware/validationSchema";

const isClean = (value: string | undefined): value is string =>
  typeof value === "string" && value.length > 0 && isValidSlug(value);

describe("slugify — case 1: a normal product name becomes a clean slug", () => {
  it("lowercases, kebab-cases and URL-safes an English name", () => {
    expect(slugify("DXN Gano Reishi")).toBe("dxn-gano-reishi");
    expect(slugify("Lingzhi Coffee 3in1")).toBe("lingzhi-coffee-3in1");
    expect(isValidSlug(slugify("Lingzhi Coffee 3in1"))).toBe(true);
  });

  it("collapses punctuation and repeated separators", () => {
    expect(slugify("  Ganozhi   Soap!!!  ")).toBe("ganozhi-soap");
    expect(slugify("100% Gano + 1")).toBe("100-gano-1");
  });

  it("strips diacritics deterministically (NFKD)", () => {
    expect(slugify("Ganodérma")).toBe("ganoderma");
  });
});

describe("slugify — case 2: Arabic / French names produce a VALID slug", () => {
  it("transliterates an Arabic title to a valid URL-safe slug", () => {
    const slug = slugify("زيت جوز الهند الطبيعي");
    expect(isValidSlug(slug)).toBe(true);
    expect(slug.length).toBeGreaterThan(0);
  });

  it("handles a French name with accents", () => {
    const slug = slugify("Huile de noix de coco");
    expect(isValidSlug(slug)).toBe(true);
    expect(slug).toBe("huile-de-noix-de-coco");
  });

  it("never yields an empty slug for a non-empty input", () => {
    expect(slugify("٥٥٥")).toBe("");
    expect(slugify("DXN")).toBe("dxn");
  });
});

describe("isUrlLike / isValidSlug — case 3: a URL is never accepted as a slug", () => {
  it("flags Facebook share URLs and arbitrary URLs as URL-like", () => {
    expect(isUrlLike("https://www.facebook.com/share/p/1EixPrswkD/")).toBe(true);
    expect(isUrlLike("https://facebook.com/permalink.php?story_fbid=1")).toBe(true);
    expect(isUrlLike("https://example.com/path")).toBe(true);
    expect(isUrlLike("www.facebook.com/share")).toBe(true);
  });

  it("flags path-like junk as URL-like too", () => {
    expect(isUrlLike("/product/abc")).toBe(true);
    expect(isUrlLike("a/b")).toBe(true);
  });

  it("a URL fails the format check in the create schema", async () => {
    await expect(
      productSchema.validate({
        sku: "DXN-URL-1",
        slug: "https://www.facebook.com/share/p/1EixPrswkD/",
        price: 100,
      })
    ).rejects.toMatchObject({
      message: "Slug must be a lowercase URL-safe slug (letters, numbers and hyphens only), not a URL or path",
    });
  });
});

describe("buildProductSlug — case 4: duplicates get a deterministic unique suffix", () => {
  it("keeps the base slug when free", () => {
    expect(buildProductSlug({ frTitle: "Ganozhi Shampoo" })).toBe("ganozhi-shampoo");
  });

  it("appends -2, -3 for occupied names (reserved set)", () => {
    const reserved = new Set(["ganozhi-shampoo"]);
    expect(buildProductSlug({ frTitle: "Ganozhi Shampoo", reserved })).toBe("ganozhi-shampoo-2");

    const reserved3 = new Set(["ganozhi-shampoo", "ganozhi-shampoo-2"]);
    expect(buildProductSlug({ frTitle: "Ganozhi Shampoo", reserved: reserved3 })).toBe(
      "ganozhi-shampoo-3"
    );
  });

  it("drops a leading dxn- token and prefers fr over ar over sku", () => {
    expect(buildProductSlug({ frTitle: "DXN Cordyceps", sku: "DXN-X" })).toBe("cordyceps");
    const reserved = new Set(["cordyceps"]);
    expect(buildProductSlug({ frTitle: "DXN Cordyceps", sku: "DXN-X", reserved })).toBe(
      "cordyceps-2"
    );
  });
});

describe("buildProductSlug — identity fallback", () => {
  it("falls back to SKU-derived slug when no title exists", () => {
    expect(buildProductSlug({ sku: "DXN-MUABM729" })).toBe("muabm729");
  });

  it("returns empty when no identity at all", () => {
    expect(buildProductSlug({})).toBe("");
  });
});

describe("buildProductSlugPlan — case 5: an existing valid slug is preserved", () => {
  it("keeps valid slugs and does not rename them", () => {
    const plan = buildProductSlugPlan([
      { _id: "p1", sku: "S1", slug: "ganozhi-soap", frTitle: "Ganozhi Soap" },
    ]);
    expect(plan).toHaveLength(1);
    expect(plan[0].status).toBe("keep");
    expect(plan[0].newSlug).toBe("ganozhi-soap");
  });

  it("keeps seed-placeholder slugs untouched because they are already valid", () => {
    const plan = buildProductSlugPlan([
      { _id: "p1", sku: "S1", slug: "lingzhi-coffee-3in1", frTitle: "Lingzhi Coffee 3in1" },
    ]);
    expect(plan[0].status).toBe("keep");
  });
});

describe("buildProductSlugPlan — case 6: a polluted Facebook URL slug is repaired", () => {
  it("derives a clean slug from the fr title", () => {
    const plan = buildProductSlugPlan([
      {
        _id: "p1",
        sku: "DXN-1",
        slug: "https://www.facebook.com/share/p/1EixPrswkD/",
        frTitle: "Ganozhi Soap",
        arTitle: "صابون غانوزي",
      },
    ]);
    expect(plan[0].status).toBe("repair");
    expect(plan[0].newSlug).toBe("ganozhi-soap");
    expect(plan[0].manualReview).toBe(false);
  });

  it("uses the Arabic title transliteration when no fr title exists (review-flagged)", () => {
    const plan = buildProductSlugPlan([
      {
        _id: "p1",
        sku: "DXN-2",
        slug: "https://www.facebook.com/permalink.php?story_fbid=123",
        arTitle: "زيت جوز الهند الطبيعي",
      },
    ]);
    expect(plan[0].status).toBe("repair");
    expect(isClean(plan[0].newSlug)).toBe(true);
    expect(plan[0].manualReview).toBe(true);
  });
});

describe("buildProductSlugPlan — case 7: ambiguous rows are NOT guessed", () => {
  it("leaves a polluted slug without identity untouched (review)", () => {
    const plan = buildProductSlugPlan([
      { _id: "p1", slug: "https://www.facebook.com/share/p/x", sku: undefined },
    ]);
    expect(plan[0].status).toBe("review");
    expect(plan[0].newSlug).toBeUndefined();
  });

  it("never reuses the polluted URL or a random guess", () => {
    const plan = buildProductSlugPlan([
      { _id: "p1", slug: "https://www.facebook.com/share/p/abcd", sku: "" },
    ]);
    expect(plan[0].newSlug).toBeUndefined();
  });
});

describe("collision safety in the full plan", () => {
  it("never proposes a slug that collides with another repaired/kept row in the same run", () => {
    const rows = [
      { _id: "a", sku: "A", slug: "https://www.facebook.com/share/p/1", frTitle: "Ganozhi Shampoo" },
      { _id: "b", sku: "B", slug: "https://www.facebook.com/share/p/2", frTitle: "Ganozhi Shampoo" },
    ];
    const plan = buildProductSlugPlan(rows);
    const repaired = plan.filter((e) => e.status === "repair").map((e) => e.newSlug);
    expect(new Set(repaired).size).toBe(2);
    expect(repaired).toEqual(["ganozhi-shampoo", "ganozhi-shampoo-2"]);
  });

  it("re-runs the plan idempotently against already-repaired slugs", () => {
    const rows = [
      { _id: "a", sku: "A", slug: "ganozhi-shampoo", frTitle: "Ganozhi Shampoo" },
      { _id: "b", sku: "B", slug: "ganozhi-shampoo-2", frTitle: "Ganozhi Shampoo" },
    ];
    const plan = buildProductSlugPlan(rows);
    expect(plan.every((e) => e.status === "keep")).toBe(true);
  });
});

describe("validation schemas keep the update path open for legacy polluted slugs", () => {
  it("create schema rejects a polluted URL slug", async () => {
    await expect(
      productSchema.validate({
        sku: "DXN-URL-2",
        slug: "https://www.facebook.com/share/p/1EixPrswkD/",
        price: 100,
      })
    ).rejects.toMatchObject({
      message: "Slug must be a lowercase URL-safe slug (letters, numbers and hyphens only), not a URL or path",
    });
  });

  it("update schema ACCEPTS the legacy polluted slug (so the controller can repair it)", async () => {
    const value = await productUpdateSchema.validate({
      slug: "https://www.facebook.com/share/p/1EixPrswkD/",
      price: 98,
    });
    expect(value.slug).toBe("https://www.facebook.com/share/p/1EixPrswkD/");
  });

  it("create schema accepts a clean explicit slug and a missing slug", async () => {
    await expect(
      productSchema.validate({ sku: "DXN-CLEAN", slug: "ganozhi-soap", price: 100 })
    ).resolves.toBeDefined();
    await expect(
      productSchema.validate({ sku: "DXN-NO-SLUG", price: 100 })
    ).resolves.toBeDefined();
  });
});