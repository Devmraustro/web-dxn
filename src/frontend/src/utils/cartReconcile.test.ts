import { reconcileCart, CatalogEntry } from "./cartReconcile";

const product = (id: string, price: number, stock: number, name?: string): CatalogEntry => ({
  id,
  price,
  stockQuantity: stock,
  name: name || `Product ${id}`,
});

describe("cartReconcile", () => {
  describe("product lines", () => {
    const products = new Map<string, CatalogEntry>([
      ["p1", product("p1", 100, 5, "Valid")],
      ["p2", product("p2", 250, 0, "Sold out")],
      ["p3", product("p3", 50, 2, "Low stock")],
    ]);

    it("keeps a valid in-stock product ok and refreshes its price", () => {
      const result = reconcileCart(
        [{ productId: "p1", name: "Old", unitPrice: 10, quantity: 2, totalPrice: 20 }],
        products,
        new Map()
      );
      expect(result.items[0].status).toBe("ok");
      expect(result.items[0].unitPrice).toBe(100);
      expect(result.items[0].totalPrice).toBe(200);
      expect(result.items[0].name).toBe("Valid");
      expect(result.subtotal).toBe(200);
      expect(result.invalidCount).toBe(0);
    });

    it("flags a nonexistent product as stale (missing from the public catalog)", () => {
      const result = reconcileCart(
        [{ productId: "ghost", name: "Gone", unitPrice: 9, quantity: 1, totalPrice: 9 }],
        products,
        new Map()
      );
      expect(result.items[0].status).toBe("stale");
      expect(result.items[0].reasons).toContain("missing");
      expect(result.subtotal).toBe(0);
      expect(result.invalidCount).toBe(1);
    });

    it("flags an inactive product as stale — inactive is never in the public catalog", () => {
      // A catalog that does NOT include the id is indistinguishable from a
      // deleted/inactive/placeholder id: all of them are absent from the
      // public, active-only catalog.
      const result = reconcileCart(
        [{ productId: "inactiveId", name: "Sleeping", unitPrice: 30, quantity: 1, totalPrice: 30 }],
        products,
        new Map()
      );
      expect(result.items[0].status).toBe("stale");
    });

    it("flags a placeholder-seed product as stale (never listed publicly)", () => {
      const result = reconcileCart(
        [{ productId: "seedSkuId", name: "Starter", unitPrice: 40, quantity: 1, totalPrice: 40 }],
        products,
        new Map()
      );
      expect(result.items[0].status).toBe("stale");
      expect(result.items[0].reasons).toContain("missing");
    });

    it("flags an out-of-stock product as unavailable", () => {
      const result = reconcileCart(
        [{ productId: "p2", name: "Sold out", unitPrice: 250, quantity: 1, totalPrice: 250 }],
        products,
        new Map()
      );
      expect(result.items[0].status).toBe("unavailable");
      expect(result.items[0].reasons).toContain("out-of-stock");
      expect(result.subtotal).toBe(0);
    });

    it("flags quantity exceeding stock as unavailable", () => {
      const result = reconcileCart(
        [{ productId: "p3", name: "Low stock", unitPrice: 50, quantity: 5, totalPrice: 250 }],
        products,
        new Map()
      );
      expect(result.items[0].status).toBe("unavailable");
      expect(result.items[0].reasons).toContain("quantity-exceeds-stock");
    });
  });

  describe("mixed cart", () => {
    const products = new Map<string, CatalogEntry>([
      ["p1", product("p1", 100, 5, "Valid")],
    ]);

    it("marks only invalid lines invalid and totals only valid lines", () => {
      const result = reconcileCart(
        [
          { productId: "p1", name: "Valid", unitPrice: 0, quantity: 2, totalPrice: 0 },
          { productId: "ghost", name: "Stale", unitPrice: 0, quantity: 1, totalPrice: 0 },
          { productId: "p2", name: "Oos", unitPrice: 0, quantity: 1, totalPrice: 0 },
        ],
        products,
        new Map()
      );
      const statuses = result.items.map((i) => i.status);
      expect(statuses).toEqual(["ok", "stale", "stale"]);
      expect(result.validCount).toBe(1);
      expect(result.invalidCount).toBe(2);
      expect(result.subtotal).toBe(200); // 2 × refreshed price 100
    });
  });

  describe("all-invalid cart", () => {
    it("returns zero subtotal and every line invalid", () => {
      const result = reconcileCart(
        [
          { productId: "a", name: "A", unitPrice: 1, quantity: 1, totalPrice: 1 },
          { productId: "b", name: "B", unitPrice: 1, quantity: 1, totalPrice: 1 },
        ],
        new Map(),
        new Map()
      );
      expect(result.validCount).toBe(0);
      expect(result.invalidCount).toBe(2);
      expect(result.subtotal).toBe(0);
    });
  });

  describe("total recalculation after invalid item removal", () => {
    it("removing the invalid line restores the subtotal to the valid remainder", () => {
      const products = new Map<string, CatalogEntry>([["p1", product("p1", 100, 5, "Valid")]]);
      const before = reconcileCart(
        [
          { productId: "p1", name: "Valid", unitPrice: 0, quantity: 2, totalPrice: 0 },
          { productId: "ghost", name: "Stale", unitPrice: 0, quantity: 3, totalPrice: 0 },
        ],
        products,
        new Map()
      );
      expect(before.subtotal).toBe(200);

      // CartPage removes the invalid index, then reconciliation runs again.
      const remaining = before.items.filter((i) => i.status === "ok").map((i) => ({
        productId: i.productId,
        name: i.name,
        unitPrice: i.unitPrice,
        quantity: i.quantity,
        totalPrice: i.totalPrice,
      }));
      const after = reconcileCart(remaining, products, new Map());
      expect(after.invalidCount).toBe(0);
      expect(after.subtotal).toBe(200);
    });
  });

  describe("catalog availability", () => {
    it("never marks items stale when the authoritative list could not be fetched", () => {
      const result = reconcileCart(
        [{ productId: "p1", name: "Anything", unitPrice: 100, quantity: 1, totalPrice: 100 }],
        new Map(),
        new Map(),
        false
      );
      expect(result.items[0].status).toBe("ok");
      expect(result.invalidCount).toBe(0);
      expect(result.subtotal).toBe(100);
    });
  });

  describe("pack lines", () => {
    it("keeps a listed pack ok with refreshed price", () => {
      const packs = new Map<string, CatalogEntry>([
        ["pack1", { id: "pack1", price: 500, stockQuantity: 1, name: "Pack Star" }],
      ]);
      const result = reconcileCart(
        [{ packId: "pack1", name: "Old pack", unitPrice: 1, quantity: 1, totalPrice: 1 }],
        new Map(),
        packs
      );
      expect(result.items[0].status).toBe("ok");
      expect(result.items[0].name).toBe("Pack Star");
      expect(result.items[0].totalPrice).toBe(500);
    });

    it("flags a missing pack as stale", () => {
      const result = reconcileCart(
        [{ packId: "zzz", name: "Gone pack", unitPrice: 1, quantity: 1, totalPrice: 1 }],
        new Map(),
        new Map()
      );
      expect(result.items[0].status).toBe("stale");
      expect(result.items[0].reasons).toContain("missing");
    });
  });
});