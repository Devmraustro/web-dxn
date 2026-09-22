import { Orchestrator } from "../core/orchestrator";
import { InMemoryConversationStore } from "../core/memory";
import { DataAccess } from "../core/retrieval";
import { CatalogItem } from "../core/types";
import { findBestMatches } from "../core/catalogSearch";

const POINTS_CATALOG: CatalogItem[] = [
  { id: "p1", slug: "reishi-gano", kind: "product", title: "DXN Reishi Gano", priceDA: 3500, available: true, stock: 10, stockState: "IN_STOCK", category: "mushroom", storeUrl: "https://dxn.dz/product/reishi-gano", points: 10 },
  { id: "p2", slug: "spirulina", kind: "product", title: "DXN Spirulina", priceDA: 4200, available: true, stock: 5, stockState: "IN_STOCK", category: "supplement", storeUrl: "https://dxn.dz/product/spirulina", points: 15.5 },
  { id: "p3", slug: "morinzhi", kind: "product", title: "DXN Morinzhi", priceDA: 4800, available: true, stock: 3, stockState: "IN_STOCK", category: "mushroom", storeUrl: "https://dxn.dz/product/morinzhi", points: 12.75 },
];

class ProductPointsDataAccess implements DataAccess {
  async getCatalog() { return POINTS_CATALOG; }
  async getPacks() { return []; }
  async searchCatalog(query: string) {
    const matches = findBestMatches(POINTS_CATALOG, query, { minScore: 0.3, maxResults: 5 });
    return matches.map(m => m.item);
  }
  async getActiveOffers() { return []; }
  async getShippingInfo() { return { homeDelivery: true, officeDelivery: true, homePriceDA: 500, officePriceDA: 300, shippingConfigured: true }; }
  async getFaq() { return []; }
  async getStoreSettings() { return { name: "DXN Store", currency: "DA", paymentMethods: ["cod"] }; }
}

describe("DXN Product Points - AI retrieval & responses", () => {
  let orchestrator: Orchestrator;
  let dataAccess: ProductPointsDataAccess;

  beforeEach(() => {
    dataAccess = new ProductPointsDataAccess();
    orchestrator = new Orchestrator({
      provider: { name: "deterministic", generateResponse: async () => ({ text: "AI response" }), healthCheck: async () => true },
      store: new InMemoryConversationStore(),
      dataAccess,
    });
  });

  describe("AI retrieves authoritative points from catalog", () => {
    it("includes points for reishi/gano alias", async () => {
      const res = await orchestrator.handleMessage("conv-pts-1", "gano");

      expect(res.response).toContain("10");
      expect(res.response.toLowerCase()).toMatch(/نقاط|points/);
      expect(res.performedRetrieval).toBe(true);
    });

    it("includes decimal points for spirulina alias", async () => {
      const res = await orchestrator.handleMessage("conv-pts-2", "سبيرولينا");

      expect(res.response).toContain("15.5");
      expect(res.response.toLowerCase()).toMatch(/نقاط|points/);
    });

    it("includes points for morinzhi alias", async () => {
      const res = await orchestrator.handleMessage("conv-pts-3", "مورينزي");

      expect(res.response).toContain("12.75");
      expect(res.response.toLowerCase()).toMatch(/نقاط|points/);
    });
  });

  describe("AI response wording for points", () => {
    it("does not claim website deposits points into customer DXN account", async () => {
      const res = await orchestrator.handleMessage("conv-pts-4", "هل سيضيف المتجر نقاط لحسابي DXN؟");

      const lower = res.response.toLowerCase();
      expect(lower).not.toContain("يضيف");
      expect(lower).not.toContain("يودع");
      expect(lower).not.toContain("deposit");
    });

    it("states displayed value is DXN point value associated with product", async () => {
      const res = await orchestrator.handleMessage("conv-pts-5", "ما معنى نقاط DXN على المنتج؟");

      const lower = res.response.toLowerCase();
      expect(lower).toContain("نقاط");
      expect(lower).toContain("منتج");
      expect(lower).not.toContain("حساب");
    });
  });
});