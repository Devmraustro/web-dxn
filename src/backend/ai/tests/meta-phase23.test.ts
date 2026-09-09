/**
 * Phase 23 — Meta integration hardening tests.
 *
 * Covers the production-readiness gaps found in the Phase 23 audit:
 *  1. Telegram human-escalation IS wired from the Meta processor (bug fix): a
 *     needsHumanHandoff result never auto-replies and notifies the owner
 *     through the existing escalation pipeline (no duplicate Telegram).
 *  2. Durable idempotency: the Mongo-backed WebhookEvent registry recognizes a
 *     redelivered event across a "restart" (new registry instance).
 *  3. Transient-only outbound retry: Meta send retries 5xx/429/network but not
 *     permanent 4xx.
 *  4. Meta health status differentiation without leaking secrets.
 *
 * No live Meta network: transports and Telegram sinks are injected.
 */
import mongoose from "mongoose";
import { Orchestrator } from "../core/orchestrator";
import { InMemoryConversationStore } from "../core/memory";
import { InMemoryDataAccess, sampleCatalog } from "../core/testFakes";
import { processWebhookEvent, InMemoryDedupRegistry, DedupRegistry } from "../meta/processor";
import { MetaMessenger, isTransientMetaError } from "../meta/messenger";
import { MongoDedupRegistry } from "../meta/mongoDedup";
import { getMetaConfig, getMetaHealth, isMetaConfigured } from "../meta/config";
import { WebhookEvent } from "../../../Database/Models";

describe("Phase 23 — Meta human escalation is wired", () => {
  const da = new InMemoryDataAccess({ catalog: sampleCatalog });

  const handoffBody = {
    object: "instagram",
    entry: [{ id: "1", messaging: [{ sender: { id: "P1" }, message: { mid: "esc-m1", text: "نحب نهدر مع واحد" } }] }],
  };

  function buildRepliesAndMessenger(replies: string[]) {
    const messenger = new MetaMessenger({
      pageAccessToken: "tok",
      transport: async (_url, body: any) => {
        replies.push(body.message.text);
        return { recipient_id: "P1", message_id: "out" };
      },
    });
    return messenger;
  }

  test("needsHumanHandoff notifies the owner via Telegram and does NOT auto-reply", async () => {
    const replies: string[] = [];
    const messenger = buildRepliesAndMessenger(replies);
    const sinkCalls: string[] = [];
    const sink = { send: async (msg: string) => { sinkCalls.push(msg); return {}; } };
    const orch = new Orchestrator({ dataAccess: da, store: new InMemoryConversationStore() });

    const r = await processWebhookEvent(handoffBody, {
      orchestrator: orch,
      messenger,
      dedup: new InMemoryDedupRegistry(),
      telegramSink: sink,
    });

    expect(r.replySent).toBe(false);           // never auto-reply on handoff
    expect(r.humanEscalated).toBe(true);       // owner notified
    expect(replies.length).toBe(0);
    expect(sinkCalls.length).toBe(1);
    expect(sinkCalls[0]).toContain("AI HUMAN HANDOFF");
    expect(sinkCalls[0]).toContain("instagram");
  });

  test("needsHumanHandoff with no Telegram sink: no reply, no escalation, no throw", async () => {
    const replies: string[] = [];
    const messenger = buildRepliesAndMessenger(replies);
    const orch = new Orchestrator({ dataAccess: da, store: new InMemoryConversationStore() });

    const r = await processWebhookEvent(handoffBody, {
      orchestrator: orch,
      messenger,
      dedup: new InMemoryDedupRegistry(),
    });

    expect(r.replySent).toBe(false);
    expect(r.humanEscalated).toBeFalsy();
    expect(replies.length).toBe(0);
  });

  test("a failing Telegram sink during handoff does not throw or roll back", async () => {
    const messenger = buildRepliesAndMessenger([]);
    const failingSink = { send: async () => { throw new Error("Telegram down"); } };
    const orch = new Orchestrator({ dataAccess: da, store: new InMemoryConversationStore() });

    const r = await processWebhookEvent(handoffBody, {
      orchestrator: orch,
      messenger,
      dedup: new InMemoryDedupRegistry(),
      telegramSink: failingSink,
    });

    expect(r.humanEscalated).toBe(false);
    expect(r.replySent).toBe(false);
    expect(r.handled).toBe(true);
  });
});

describe("Phase 23 — transient-only outbound retry", () => {
  test("isTransientMetaError classifies 429/5xx/network as transient", () => {
    expect(isTransientMetaError({ response: { status: 429 } })).toBe(true);
    expect(isTransientMetaError({ response: { status: 503 } })).toBe(true);
    expect(isTransientMetaError({ code: "ECONNABORTED" })).toBe(true);
    expect(isTransientMetaError({ code: "ECONNRESET" })).toBe(true);
    expect(isTransientMetaError({ code: "ETIMEDOUT" })).toBe(true);
    // Axios network-error shape: a request was sent but no response received.
    expect(isTransientMetaError({ request: {} })).toBe(true);
  });

  test("isTransientMetaError treats permanent 4xx and unknown errors as non-transient", () => {
    expect(isTransientMetaError({ response: { status: 400 } })).toBe(false);
    expect(isTransientMetaError({ response: { status: 401 } })).toBe(false);
    expect(isTransientMetaError({ response: { status: 403 } })).toBe(false);
    expect(isTransientMetaError(new Error("plain"))).toBe(false);
    expect(isTransientMetaError({})).toBe(false);
  });

  test("sendText retries a transient failure then succeeds", async () => {
    let calls = 0;
    const messenger = new MetaMessenger({
      pageAccessToken: "tok",
      transport: async (_url, body) => {
        calls++;
        if (calls < 3) throw { response: { status: 503 } };
        return { recipient_id: "P1", message_id: "out" };
      },
    });
    const r = await messenger.sendText("instagram", "P1", "سلام");
    expect(r.messageId).toBe("out");
    expect(calls).toBe(3);
  });

  test("sendText does NOT retry permanent 4xx", async () => {
    let calls = 0;
    const messenger = new MetaMessenger({
      pageAccessToken: "tok",
      transport: async () => {
        calls++;
        throw { response: { status: 400 } };
      },
    });
    await expect(messenger.sendText("instagram", "P1", "سلام")).rejects.toBeTruthy();
    expect(calls).toBe(1);
  });
});

describe("Phase 23 — durable idempotency (MongoWebhookEvent registry)", () => {
  const dbConnected = (): boolean => mongoose.connection.readyState === 1;
  const key = `phase23:ig:P1:mid-${Date.now()}`;

  beforeAll(async () => {
    if (dbConnected()) {
      // Ensure the unique index exists before checking atomic single-claim.
      await WebhookEvent.init();
      await WebhookEvent.deleteMany({ dedupKey: key }).exec();
    }
  });

  afterAll(async () => {
    if (dbConnected()) {
      await WebhookEvent.deleteMany({ dedupKey: key }).exec();
    }
  });

  test("claims a key once and recognizes a redelivery in a NEW registry (restart)", async () => {
    if (!dbConnected()) {
      // eslint-disable-next-line no-console
      console.warn("Mongo not available - durable idempotency test skipped (CONFIGURATION REQUIRED)");
      expect(true).toBe(true);
      return;
    }

    const registry1 = new MongoDedupRegistry({ source: "meta" });
    const first = await registry1.add(key);
    expect(first).toBe(true); // first claim wins

    // Simulate a restart: a brand-new registry instance still knows the key.
    const registry2 = new MongoDedupRegistry({ source: "meta" });
    const second = await registry2.add(key);
    expect(second).toBe(false); // already claimed across restart
  });

  test("dedup registry satisfies the DedupRegistry contract", async () => {
    if (!dbConnected()) return;
    const registry = new MongoDedupRegistry({ source: "meta" });
    expect(typeof (registry as DedupRegistry).has).toBe("function");
    expect(typeof (registry as DedupRegistry).add).toBe("function");
  });
});

describe("Phase 23 — Meta health/config status", () => {
  const SAVE = Object.assign({}, process.env);

  afterEach(() => {
    process.env = Object.assign({}, SAVE);
  });

  test("all config absent -> NOT_CONFIGURED", () => {
    process.env.META_VERIFY_TOKEN = "";
    process.env.META_APP_SECRET = "";
    process.env.META_PAGE_ACCESS_TOKEN = "";
    const h = getMetaHealth();
    expect(h.status).toBe("NOT_CONFIGURED");
    expect(h.platforms).toEqual([]);
  });

  test("partial config -> ERROR", () => {
    process.env.META_VERIFY_TOKEN = "vt";
    process.env.META_APP_SECRET = "";
    process.env.META_PAGE_ACCESS_TOKEN = "";
    expect(getMetaHealth().status).toBe("ERROR");
    expect(isMetaConfigured(getMetaConfig())).toBe(false);
  });

  test("full config, not live-verified -> CONFIGURED_NOT_LIVE_VERIFIED", () => {
    process.env.META_VERIFY_TOKEN = "vt";
    process.env.META_APP_SECRET = "as";
    process.env.META_PAGE_ACCESS_TOKEN = "pat";
    delete process.env.META_LIVE_VERIFIED;
    const h = getMetaHealth();
    expect(h.status).toBe("CONFIGURED_NOT_LIVE_VERIFIED");
    expect(isMetaConfigured(getMetaConfig())).toBe(true);
  });

  test("full config + live verified -> LIVE_VERIFIED", () => {
    process.env.META_VERIFY_TOKEN = "vt";
    process.env.META_APP_SECRET = "as";
    process.env.META_PAGE_ACCESS_TOKEN = "pat";
    process.env.META_LIVE_VERIFIED = "true";
    expect(getMetaHealth().status).toBe("LIVE_VERIFIED");
  });

  test("health output never leaks secret values", () => {
    process.env.META_VERIFY_TOKEN = "super-secret-verify";
    process.env.META_APP_SECRET = "super-secret-app";
    process.env.META_PAGE_ACCESS_TOKEN = "super-secret-page-token";
    process.env.META_LIVE_VERIFIED = "true";
    const h = getMetaHealth();
    const blob = JSON.stringify(h);
    expect(blob).not.toContain("super-secret-verify");
    expect(blob).not.toContain("super-secret-app");
    expect(blob).not.toContain("super-secret-page-token");
  });
});
