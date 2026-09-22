import { processWebhookEvent, DedupRegistry, InMemoryDedupRegistry } from "../meta/processor";
import { Orchestrator } from "../core/orchestrator";
import { InMemoryConversationStore } from "../core/memory";
import { MetaMessenger } from "../meta/messenger";
import { DataAccess } from "../core/retrieval";
import { CatalogItem } from "../core/types";
import { findBestMatches } from "../core/catalogSearch";
import { TelegramSink, notifyHumanHandoff } from "../core/escalation";

const CATALOG: CatalogItem[] = [
  { id: "p1", slug: "test-coffee", kind: "product", title: "Test Coffee", priceDA: 3000, available: true, stock: 10, stockState: "IN_STOCK", category: "coffee", storeUrl: "https://dxn.dz/product/test-coffee", points: 10 },
];

class FakeDataAccess implements DataAccess {
  async getCatalog() { return CATALOG; }
  async getPacks() { return []; }
  async searchCatalog(query: string) { return findBestMatches(CATALOG, query, { minScore: 0.3, maxResults: 5 }).map(m => m.item); }
  async getActiveOffers() { return []; }
  async getShippingInfo() { return { homeDelivery: true, officeDelivery: true, homePriceDA: 500, officePriceDA: 300, shippingConfigured: true }; }
  async getFaq() { return []; }
  async getStoreSettings() { return { name: "DXN Store", currency: "DA", paymentMethods: ["cod"] }; }
}

const fakeDataAccess = new FakeDataAccess();
const orchestrator = new Orchestrator({
  provider: { name: "deterministic", generateResponse: async () => ({ text: "AI response" }), healthCheck: async () => true },
  store: new InMemoryConversationStore(),
  dataAccess: fakeDataAccess,
});

const fakeMessenger = {
  sendText: jest.fn(async () => ({ success: true, messageId: "mid.test" })),
} as unknown as MetaMessenger;

const mockTelegramSink: TelegramSink = {
  send: jest.fn(async () => true),
} as unknown as TelegramSink;

function makeInstagramWebhook(senderId: string, text: string, messageId: string, pageId = "PAGE_123") {
  return {
    object: "instagram",
    entry: [{
      id: pageId,
      time: Date.now(),
      messaging: [{
        sender: { id: senderId },
        recipient: { id: pageId },
        timestamp: Date.now(),
        message: {
          mid: messageId,
          text,
        },
      }],
    }],
  };
}

describe("Meta processor — AI_SALES_MODE=PAUSED regression", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (process.env as any).AI_SALES_MODE = "PAUSED";
  });

  it("PAUSED: incoming webhook → orchestrator processes → NO messenger.sendText called → replySent=false", async () => {
    const result = await processWebhookEvent(
      makeInstagramWebhook("SENDER_123", "بشحال القهوة؟", "mid_test"),
      {
        orchestrator,
        dedup: new InMemoryDedupRegistry(),
        messenger: fakeMessenger,
        telegramSink: undefined,
      }
    );

    expect(result.handled).toBe(true);
    expect(result.duplicate).toBe(false);
    expect(result.replySent).toBe(false);
    expect(result.text).toBe("");
    expect(fakeMessenger.sendText).not.toHaveBeenCalled();
  });

  it("PAUSED: human handoff triggered → escalation occurs → NO messenger.sendText called → replySent=false, humanEscalated=true (with telegramSink)", async () => {
    const result = await processWebhookEvent(
      makeInstagramWebhook("SENDER_456", "نحب نهدر مع المسؤول", "mid_test_2"),
      {
        orchestrator,
        dedup: new InMemoryDedupRegistry(),
        messenger: fakeMessenger,
        telegramSink: mockTelegramSink,
      }
    );

    expect(result.handled).toBe(true);
    expect(result.duplicate).toBe(false);
    expect(result.replySent).toBe(false);
    expect(result.text).toBe("");
    expect(result.humanEscalated).toBe(true);
    expect(fakeMessenger.sendText).not.toHaveBeenCalled();
    expect(mockTelegramSink.send).toHaveBeenCalled();
  });

  it("PAUSED: duplicate message → dedup works → NO messenger.sendText called", async () => {
    const dedup = new InMemoryDedupRegistry();
    const body = makeInstagramWebhook("SENDER_789", "بشحال القهوة؟", "mid_test_3");

    const r1 = await processWebhookEvent(body, { orchestrator, dedup, messenger: fakeMessenger, telegramSink: undefined });
    const r2 = await processWebhookEvent(body, { orchestrator, dedup, messenger: fakeMessenger, telegramSink: undefined });

    expect(r1.duplicate).toBe(false);
    expect(r2.duplicate).toBe(true);
    expect(r1.replySent).toBe(false);
    expect(r2.replySent).toBe(false);
    expect(fakeMessenger.sendText).not.toHaveBeenCalled();
  });
});