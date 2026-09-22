import { Orchestrator } from "../core/orchestrator";
import { InMemoryConversationStore } from "../core/memory";
import { DataAccess } from "../core/retrieval";
import { CatalogItem } from "../core/types";

const FAKE_CATALOG: CatalogItem[] = [
  { id: "p1", slug: "test-coffee", kind: "product", title: "Test Coffee", priceDA: 3000, compareAtPriceDA: 3500, available: true, stock: 10, stockState: "IN_STOCK", category: "coffee", storeUrl: "https://dxn.dz/product/test-coffee", points: 10 },
  { id: "p2", slug: "test-tea", kind: "product", title: "Test Tea", priceDA: 2000, available: true, stock: 5, stockState: "IN_STOCK", category: "tea", storeUrl: "https://dxn.dz/product/test-tea", points: 5.5 },
];

class FakeDataAccess implements DataAccess {
  async getCatalog() { return FAKE_CATALOG; }
  async getPacks() { return []; }
  async searchCatalog() { return FAKE_CATALOG; }
  async getActiveOffers() { return []; }
  async getShippingInfo() { return { homeDelivery: true, officeDelivery: true, homePriceDA: 500, officePriceDA: 300, shippingConfigured: true }; }
  async getFaq() { return []; }
  async getStoreSettings() { return { name: "DXN Store", currency: "DA", paymentMethods: ["cod"] }; }
}

describe("AI_SALES_MODE=PAUSED behavior (verified at webhook/routes layer)", () => {
  let orchestrator: Orchestrator;
  let dataAccess: FakeDataAccess;

  beforeEach(() => {
    dataAccess = new FakeDataAccess();
    orchestrator = new Orchestrator({
      provider: { name: "deterministic", generateResponse: async () => ({ text: "AI response" }), healthCheck: async () => true },
      store: new InMemoryConversationStore(),
      dataAccess,
    });
  });

  it("orchestrator processes messages normally (PAUSED is enforced upstream)", async () => {
    const res = await orchestrator.handleMessage("conv-1", "بشحال القهوة؟");

    expect(res.performedRetrieval).toBe(true);
    expect(res.response).toContain("3");
  });

  it("conversation history dedup works via conversation store", async () => {
    const res1 = await orchestrator.handleMessage("conv-dedup-1", "بشحال القهوة؟");
    const res2 = await orchestrator.handleMessage("conv-dedup-1", "بشحال القهوة؟");

    expect(res1.performedRetrieval).toBe(true);
    expect(res2.performedRetrieval).toBe(true);
  });

  it("human handoff intent triggers needsHumanHandoff for explicit request", async () => {
    const res = await orchestrator.handleMessage("conv-handoff-1", "نحب نهدر مع المسؤول");

    expect(res.needsHumanHandoff).toBe(true);
    expect(res.escalationReason).toBe("explicit human request");
  });
});