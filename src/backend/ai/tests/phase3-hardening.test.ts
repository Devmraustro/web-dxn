/**
 * PHASE 3 — AI Sales Brain hardening tests.
 *
 * Covers the hardening added in Phase 3, all DB-free and transport-mocked:
 *   1. AI_SALES_MODE is read DYNAMICALLY (default PAUSED) and the processor
 *      honors an explicit per-call override for deterministic tests.
 *   2. Inbound message length is capped at the orchestrator so the Meta path
 *      (unlimited upstream) cannot force regexes to scan huge payloads.
 *   3. Conversation memory stays bounded (in-memory store trims to
 *      MAX_STORED_MESSAGES).
 *   4. Shipping-invention checks only challenge numbers NEAR shipping terms, so
 *      an allowlisted price elsewhere in the reply is not a false positive.
 *   5. aiDebug emits nothing unless AI_DEBUG is opted in (privacy: no PII to
 *      function logs by default).
 */
import { getAiSalesMode } from "../../config/env";
import { Orchestrator, MAX_MESSAGE_LENGTH } from "../core/orchestrator";
import { InMemoryConversationStore, MAX_STORED_MESSAGES } from "../core/memory";
import { InMemoryDataAccess, sampleCatalog } from "../core/testFakes";
import { validateOutput } from "../core/guardrails";
import { processWebhookEvent, InMemoryDedupRegistry } from "../meta/processor";
import { MetaMessenger } from "../meta/messenger";
import { aiDebug } from "../debug";

const realAiSalesMode = process.env.AI_SALES_MODE;

afterEach(() => {
  if (realAiSalesMode === undefined) delete process.env.AI_SALES_MODE;
  else process.env.AI_SALES_MODE = realAiSalesMode;
});

describe("Phase 3 — dynamic AI_SALES_MODE (default PAUSED)", () => {
  test("defaults to PAUSED when unset", () => {
    delete process.env.AI_SALES_MODE;
    expect(getAiSalesMode()).toBe("PAUSED");
  });

  test("reads ACTIVE when set (case-insensitive, trimmed)", () => {
    process.env.AI_SALES_MODE = "  active ";
    expect(getAiSalesMode()).toBe("ACTIVE");
  });

  test("any unknown value falls back to the safe PAUSED default", () => {
    process.env.AI_SALES_MODE = "SOMETHING_ELSE";
    expect(getAiSalesMode()).toBe("PAUSED");
  });

  test("env is read at call time, not captured at import", async () => {
    delete process.env.AI_SALES_MODE;
    const messenger = new MetaMessenger({
      pageAccessToken: "tok",
      transport: async () => ({ recipient_id: "P", message_id: "m1" }),
    });
    const da = new InMemoryDataAccess({ catalog: sampleCatalog });
    const orch = new Orchestrator({ dataAccess: da, store: new InMemoryConversationStore() });
    const dedup = new InMemoryDedupRegistry();
    const body = {
      object: "instagram",
      entry: [{ id: "1", messaging: [{ sender: { id: "P" }, message: { mid: "m", text: "بشحال القهوة؟" } }] }],
    };

    // Unset env (default PAUSED) → no outbound reply.
    let r = await processWebhookEvent(body, { orchestrator: orch, messenger, dedup });
    expect(r.replySent).toBe(false);

    // Env flipped to ACTIVE → processor reads it dynamically and replies.
    process.env.AI_SALES_MODE = "ACTIVE";
    // New event key (different mid) so the fresh claim is not a duplicate.
    const body2 = JSON.parse(JSON.stringify(body));
    body2.entry[0].messaging[0].message.mid = "m2";
    r = await processWebhookEvent(body2, { orchestrator: orch, messenger, dedup });
    expect(r.duplicate).toBe(false);
    expect(r.replySent).toBe(true);
  });

  test("explicit aiSalesMode override wins without touching process.env", async () => {
    delete process.env.AI_SALES_MODE;
    const replies: string[] = [];
    const messenger = new MetaMessenger({
      pageAccessToken: "tok",
      transport: async (_u, b: any) => {
        replies.push(b.message.text);
        return { recipient_id: "P", message_id: `out_${replies.length}` };
      },
    });
    const orch = new Orchestrator({
      dataAccess: new InMemoryDataAccess({ catalog: sampleCatalog }),
      store: new InMemoryConversationStore(),
    });
    const dedup = new InMemoryDedupRegistry();
    const body = {
      object: "instagram",
      entry: [{ id: "1", messaging: [{ sender: { id: "P" }, message: { mid: "m", text: "بشحال القهوة؟" } }] }],
    };
    const r = await processWebhookEvent(body, {
      orchestrator: orch,
      messenger,
      dedup,
      aiSalesMode: "ACTIVE",
    });
    expect(r.replySent).toBe(true);
    expect(replies.length).toBe(1);
    expect(process.env.AI_SALES_MODE).toBeUndefined();
  });
});

describe("Phase 3 — inbound length cap (Meta path has no upstream limit)", () => {
  test("oversized input is blocked before any regex scanning", async () => {
    const orch = new Orchestrator({
      dataAccess: new InMemoryDataAccess({ catalog: sampleCatalog }),
      store: new InMemoryConversationStore(),
    });
    const r = await orch.handleMessage("cap-1", "القهوة ".repeat(MAX_MESSAGE_LENGTH).padEnd(MAX_MESSAGE_LENGTH + 100, "x"));
    expect(r.validation).toBe("blocked");
    expect(r.needsHumanHandoff).toBe(true);
    expect(r.escalationReason).toContain("too long");
  });

  test("exactly-at-limit and normal messages are unaffected", async () => {
    const orch = new Orchestrator({
      dataAccess: new InMemoryDataAccess({ catalog: sampleCatalog }),
      store: new InMemoryConversationStore(),
    });
    const atLimit = "سلام".padEnd(MAX_MESSAGE_LENGTH, "أ");
    const r = await orch.handleMessage("cap-2", atLimit);
    expect(r.validation).toBe("safe");
  });
});

describe("Phase 3 — bounded conversation memory", () => {
  test("in-memory store trims to MAX_STORED_MESSAGES", async () => {
    const store = new InMemoryConversationStore();
    for (let i = 0; i < MAX_STORED_MESSAGES + 20; i += 1) {
      await store.append("bounded", { role: "user", content: `msg-${i}` });
    }
    const history = await store.getHistory("bounded");
    expect(history.length).toBe(MAX_STORED_MESSAGES);
    expect(history[0].content).toBe("msg-20");
  });
});

describe("Phase 3 — scoped shipping-fee invention checks", () => {
  test("a fee figure near a shipping term is still challenged", () => {
    const g = validateOutput(
      "Les frais de livraison sont 900 DA",
      "fr",
      [],
      { shippingPricesDA: [600, 300] }
    );
    expect(g.violations.some((v) => v.type === "shipping_invention")).toBe(true);
  });

  test("a number far from any shipping term is NOT a shipping invention", () => {
    const g = validateOutput(
      "Livraison à domicile: 600 DA. Besoin de 12 unités.",
      "fr",
      ["600"],
      { shippingPricesDA: [600, 300] }
    );
    expect(g.violations.some((v) => v.type === "shipping_invention")).toBe(false);
  });

  test("no-number-near-shipping does not flag total figures (empty retrieval context)", () => {
    const g = validateOutput(
      "livraison rapide partout. Montant total de la facture: 900 DA.",
      "fr",
      [],
      { hasRetrievalContext: false }
    );
    expect(g.violations.some((v) => v.type === "shipping_invention")).toBe(false);
  });

  test("fabricated fee near a shipping term IS flagged when no shipping data exists", () => {
    const g = validateOutput(
      "frais de livraison: 250 DA pour votre wilaya",
      "fr",
      [],
      { hasRetrievalContext: false }
    );
    expect(g.violations.some((v) => v.type === "shipping_invention")).toBe(true);
  });
});

describe("Phase 3 — privacy-safe AI debug logging", () => {
  let spy: jest.SpyInstance;

  beforeEach(() => {
    spy = jest.spyOn(console, "log").mockImplementation(() => undefined);
  });

  afterEach(() => {
    spy.mockRestore();
    delete process.env.AI_DEBUG;
  });

  test("emits nothing by default (no PII in function logs)", () => {
    aiDebug("processor.normalized", { platform: "instagram", textLength: 3 });
    expect(spy).not.toHaveBeenCalled();
  });

  test("emits only when AI_DEBUG is explicitly enabled", () => {
    process.env.AI_DEBUG = "1";
    aiDebug("processor.normalized", { platform: "instagram", textLength: 3 });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(String((spy.mock.calls[0] as unknown[])[0])).toContain("[AI-DEBUG] processor.normalized");
  });
});