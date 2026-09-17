/**
 * Launch-prep — focused regression + contract tests (mostly DB-free).
 *
 * Covers the changes landing in this batch:
 *  1. BaridiMob is rejected for NEW orders (COD only) while historical
 *     BaridiMob orders stay readable.
 *  2. Placeholder cleanup only ever selects placeholder/seed records.
 *  3. The admin status UI derives from the same authoritative transition
 *     model the backend enforces.
 *  4. Footer contact/social configuration is factual (real email, no fake
 *     social URLs) and both languages provide labels.
 *
 * Each suite is deterministic and does not require MongoDB unless it says
 * CONFIGURATION REQUIRED.
 */
import {
  orderCreateSchema,
  orderStatusUpdateSchema,
} from "../middleware/validationSchema";

describe("launch-prep — payment method contract (DB-free)", () => {
  const baseOrder = {
    customerInfo: {
      firstName: "Ahmed",
      lastName: "Benali",
      phone: "0551234567",
    },
    cartItems: [
      {
        productId: "507f1f77bcf86cd799439011",
        quantity: 2,
      },
    ],
    deliveryMethod: "home",
    wilaya: "Alger",
    commune: "Bab Ezzouar",
    address: "12 Rue des Oliviers",
    confirmed: true,
  };

  it("accepts COD as the only new-order payment method", async () => {
    await expect(
      orderCreateSchema.validate({ ...baseOrder, paymentMethod: "cod" })
    ).resolves.toBeDefined();
  });

  it("rejects BaridiMob for new orders with a clear error", async () => {
    let message = "";
    try {
      await orderCreateSchema.validate({ ...baseOrder, paymentMethod: "baridimob" });
    } catch (err: any) {
      message = err?.message ?? "";
    }
    expect(message).toMatch(/Only Cash on Delivery/i);
  });

  it("rejects an unknown payment method", async () => {
    let message = "";
    try {
      await orderCreateSchema.validate({ ...baseOrder, paymentMethod: "stripe" });
    } catch (err: any) {
      message = err?.message ?? "";
    }
    expect(message).toMatch(/Invalid payment method/i);
  });

  it("orderStatusUpdateSchema still accepts every canonical status", async () => {
    for (const status of [
      "new",
      "pending_payment",
      "confirmed",
      "processing",
      "shipped",
      "delivered",
      "cancelled",
      "rejected",
    ]) {
      await expect(orderStatusUpdateSchema.validate({ status })).resolves.toBeDefined();
    }
  });
});

describe("launch-prep — historical BaridiMob orders remain readable", () => {
  // Import lazily: Models = mongoose schemas only (no connection required).
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { Order } = require("../../Database/Models") as typeof import("../../Database/Models");

  it("keeps baridimob in the order paymentMethod enum (historical reads)", () => {
    const enumValues: string[] | undefined = (
      Order.schema.path("paymentMethod") as any
    )?.enumValues;
    expect(enumValues).toEqual(expect.arrayContaining(["cod", "baridimob"]));
  });

  it("keeps the canonical order status enum", () => {
    const enumValues: string[] | undefined = (Order.schema.path("status") as any)?.enumValues;
    expect(enumValues).toEqual(
      expect.arrayContaining([
        "new",
        "pending_payment",
        "confirmed",
        "processing",
        "shipped",
        "delivered",
        "cancelled",
        "rejected",
      ])
    );
  });
});

describe("launch-prep — placeholder cleanup only targets placeholders (DB-free)", () => {
  const {
    placeholderProductSelectionQuery,
    placeholderPackSelectionQuery,
    placeholderOfferSelectionQuery,
  } = require("../services/catalogCleanup.service") as typeof import("../services/catalogCleanup.service");
  const {
    PLACEHOLDER_PRODUCT_IDENTIFIERS,
    PLACEHOLDER_PACK_IDENTIFIERS,
    PLACEHOLDER_OFFER_IDENTIFIERS,
  } = require("../services/placeholderCatalog.service") as typeof import("../services/placeholderCatalog.service");

  it("product cleanup query uses exactly the placeholder identifiers", () => {
    const q = placeholderProductSelectionQuery() as any;
    expect(q).toBeDefined();
    expect(Array.isArray(q.$or)).toBe(true);
    const skuIn: string[] = q.$or.find((c: any) => c.sku)?.sku?.$in ?? [];
    const slugIn: string[] = q.$or.find((c: any) => c.slug)?.slug?.$in ?? [];
    expect(skuIn.sort()).toEqual([...PLACEHOLDER_PRODUCT_IDENTIFIERS].sort());
    expect(slugIn.sort()).toEqual([...PLACEHOLDER_PRODUCT_IDENTIFIERS].sort());
  });

  it("pack/offer cleanup queries use their own placeholder identifier sets", () => {
    const packQ = placeholderPackSelectionQuery() as any;
    const packSlugIn: string[] = packQ.$or.find((c: any) => c.slug)?.slug?.$in ?? [];
    expect(packSlugIn.sort()).toEqual([...PLACEHOLDER_PACK_IDENTIFIERS].sort());

    const offerQ = placeholderOfferSelectionQuery() as any;
    const offerSlugIn: string[] = offerQ.$or.find((c: any) => c.slug)?.slug?.$in ?? [];
    expect(offerSlugIn.sort()).toEqual([...PLACEHOLDER_OFFER_IDENTIFIERS].sort());
  });

  it("cleanup queries never match arbitrary real catalog sku/slug values", () => {
    const q = JSON.stringify(placeholderProductSelectionQuery());
    expect(q).not.toContain("REAL-SKU-1");
    expect(q).not.toContain("acai-berry-500g");
    expect(q).not.toContain("ramadan-offer-2025");
  });
});

describe("launch-prep — admin status model derives from the backend (DB-free)", () => {
  const {
    ORDER_STATUSES,
    VALID_TRANSITIONS,
    TERMINAL_STATUSES,
    RESTOCK_ON_STATUS,
  } = require("../../shared/orderStatus") as typeof import("../../shared/orderStatus");
  const frontendStatus = require("../../frontend/src/utils/orderStatus") as typeof import("../../frontend/src/utils/orderStatus");

  it("backend exposes exactly the 8 canonical statuses", () => {
    expect(ORDER_STATUSES).toEqual([
      "new",
      "pending_payment",
      "confirmed",
      "processing",
      "shipped",
      "delivered",
      "cancelled",
      "rejected",
    ]);
  });

  it("frontend NEXT_STATUSES exactly matches backend VALID_TRANSITIONS", () => {
    for (const status of ORDER_STATUSES) {
      expect(frontendStatus.NEXT_STATUSES[status]).toEqual(VALID_TRANSITIONS[status]);
    }
  });

  it("every status has an AR and a FR label plus a badge variant", () => {
    const allowedVariants = new Set([
      "primary",
      "secondary",
      "success",
      "danger",
      "warning",
      "info",
      "dark",
    ]);
    for (const status of ORDER_STATUSES) {
      const [ar, fr] = frontendStatus.STATUS_LABELS[status] ?? [];
      expect(ar && ar.length > 0).toBe(true);
      expect(fr && fr.length > 0).toBe(true);
      expect(allowedVariants.has(frontendStatus.STATUS_VARIANTS[status])).toBe(true);
    }
  });

  it("terminal statuses and full coverage are consistent", () => {
    for (const terminal of TERMINAL_STATUSES) {
      expect(VALID_TRANSITIONS[terminal].length).toBe(0);
      expect(["delivered", "cancelled", "rejected"]).toContain(terminal);
    }
    expect(RESTOCK_ON_STATUS.has("cancelled")).toBe(true);
    expect(RESTOCK_ON_STATUS.has("rejected")).toBe(true);
    expect(frontendStatus.nextStatuses("confirmed")).toEqual(["processing", "cancelled"]);
    expect(frontendStatus.nextStatuses("delivered")).toEqual([]);
  });
});

describe("launch-prep — footer contact & social configuration (DB-free)", () => {
  const {
    STORE_EMAIL,
    STORE_EMAIL_MAILTO,
    readSiteSocialConfig,
  } = require("../../frontend/src/config/site") as typeof import("../../frontend/src/config/site");

  it("exposes the real store email and a correct mailto link", () => {
    expect(STORE_EMAIL).toBe("dxntraveldz@gmail.com");
    expect(STORE_EMAIL_MAILTO).toBe("mailto:dxntraveldz@gmail.com");
  });

  it("never invents social URLs when not configured by the owner", () => {
    const config = readSiteSocialConfig();
    expect(config.facebook === undefined || config.instagram === undefined).toBe(true);
    // With no VITE_* defines, the footer must render NO social button: the
    // values must be absent — never placeholder domains like example.com.
    expect(JSON.stringify(config)).not.toMatch(/example\.com/);
    expect(JSON.stringify(config)).not.toContain("facebook.com/undefined");
  });
});

describe("launch-prep — translation coverage for new UI strings", () => {
  const fs = require("fs") as typeof import("fs");
  const load = (name: string) =>
    JSON.parse(
      fs.readFileSync(
        (require as any).resolve(`../../frontend/src/locales/${name}`),
        "utf8"
      )
    );

  for (const file of ["ar.json", "fr.json"]) {
    it(`${file} contains the new footer/contact keys with non-empty values`, () => {
      const bundle: Record<string, string> = load(file);
      for (const key of ["contactUs", "email", "facebook", "instagram", "paymentOnDelivery"]) {
        expect(typeof bundle[key]).toBe("string");
        expect((bundle[key] || "").trim().length).toBeGreaterThan(0);
      }
    });
  }

  it("ar.json and fr.json expose the same key set (no drift)", () => {
    const ar = Object.keys(load("ar.json"));
    const fr = Object.keys(load("fr.json"));
    expect(ar.sort()).toEqual(fr.sort());
  });
});