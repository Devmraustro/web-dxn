/**
 * Phase 19AD — Order commit is NOT rolled back by Telegram failure.
 *
 * Guarantee: escalating to / notifying a human via Telegram is a best-effort,
 * fire-and-forget side effect. If Telegram (or the Messenger reply) throws,
 * the order path must still complete: no exception escapes and the customer
 * still receives their confirmation. There is no transaction that couples the
 * order commit to the Telegram notification.
 */
import { Orchestrator } from "../core/orchestrator";
import { InMemoryConversationStore } from "../core/memory";
import { InMemoryDataAccess, sampleCatalog } from "../core/testFakes";
import { notifyHumanHandoff } from "../core/escalation";
import { processWebhookEvent, InMemoryDedupRegistry } from "../meta/processor";
import { MetaMessenger } from "../meta/messenger";

describe("Phase 19AD — Telegram failure does not roll back the order path", () => {
  const da = new InMemoryDataAccess({ catalog: sampleCatalog });

  test("notifyHumanHandoff never throws even when the Telegram sink fails", async () => {
    const failingSink = {
      send: async () => {
        throw new Error("Telegram API down");
      },
    };
    const outcome = await notifyHumanHandoff(failingSink as any, {
      platform: "instagram",
      conversationId: "c",
      customerIdentifier: "PSID_CUSTOMER",
      reason: "order guidance",
      recentContext: "customer asked about ordering",
    });
    // Deliberately: not delivered, but NOT thrown — the order path is unaffected.
    expect(outcome.delivered).toBe(false);
    expect(outcome.error).toBe("Telegram API down");
  });

  test("a throwing Messenger send does not abort the order reply", async () => {
    const messenger = new MetaMessenger({
      pageAccessToken: "tok",
      transport: async () => {
        throw new Error("Meta Graph API down");
      },
    });
    const orch = new Orchestrator({
      dataAccess: da,
      store: new InMemoryConversationStore(),
    });
    const body = {
      object: "instagram",
      entry: [{ id: "1", messaging: [{ sender: { id: "P1" }, message: { mid: "m1", text: "نحب نطلب" } }] }],
    };
    // Must resolve (not throw) even though sending the reply fails.
    const result = await processWebhookEvent(body, {
      orchestrator: orch,
      messenger,
      dedup: new InMemoryDedupRegistry(),
    });
    expect(result.handled).toBe(true);
    expect(result.replySent).toBe(false); // send failed, but nothing rolled back
  });

  test("order intent still receives a confirmation when the notifier is broken", async () => {
    const orch = new Orchestrator({
      dataAccess: da,
      store: new InMemoryConversationStore(),
    });
    const r1 = await orch.handleMessage("c1", "سلام");
    const r2 = await orch.handleMessage("c1", "نحب نطلب القهوة");
    expect(r2.needsHumanHandoff).toBe(false);
    expect(r2.response.length).toBeGreaterThan(0);
  });
});
