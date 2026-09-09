/**
 * Phase 19Z/19P/19T/19U — Meta webhook + retry + escalation tests.
 * No MongoDB, no network: pure function tests with injected transport.
 */
import {
  verifyWebhook,
  verifySignature,
  validateMetaPayload,
  extractEventKey,
  toNormalizedMessage,
  conversationIdFor,
} from "../meta/webhook";
import { MetaMessenger } from "../meta/messenger";
import { withRetry, retryOnce } from "../core/retry";
import { buildEscalationMessage } from "../core/escalation";
import * as crypto from "crypto";

const CONFIG = { verifyToken: "my_verify_token", appSecret: "app_secret_123" };

describe("Phase 19P — webhook verification (GET)", () => {
  test("returns challenge on matching mode+token", () => {
    const r = verifyWebhook(CONFIG, {
      "hub.mode": "subscribe",
      "hub.verify_token": "my_verify_token",
      "hub.challenge": "challenge123",
    });
    expect(r.ok).toBe(true);
    expect(r.challenge).toBe("challenge123");
  });
  test("rejects wrong verify token", () => {
    const r = verifyWebhook(CONFIG, {
      "hub.mode": "subscribe",
      "hub.verify_token": "wrong",
      "hub.challenge": "c",
    });
    expect(r.ok).toBe(false);
  });
});

describe("Phase 19P — signature validation", () => {
  test("accepts valid HMAC signature", () => {
    const body = Buffer.from(JSON.stringify({ object: "page" }));
    const sig =
      "sha256=" +
      crypto.createHmac("sha256", "app_secret_123").update(body).digest("hex");
    expect(verifySignature(CONFIG, sig, body)).toBe(true);
  });
  test("rejects tampered body", () => {
    const body = Buffer.from(JSON.stringify({ object: "page" }));
    const tampered = Buffer.from(JSON.stringify({ object: "instagram" }));
    const sig =
      "sha256=" +
      crypto.createHmac("sha256", "app_secret_123").update(body).digest("hex");
    expect(verifySignature(CONFIG, sig, tampered)).toBe(false);
  });
  test("rejects missing header", () => {
    expect(verifySignature(CONFIG, undefined, Buffer.from("{}"))).toBe(false);
  });
});

describe("Phase 19T — idempotency keys", () => {
  const instaBody = {
    object: "instagram",
    entry: [
      {
        id: "1",
        messaging: [
          { sender: { id: "USER_PSID" }, message: { mid: "mid.1", text: "سلام" } },
        ],
      },
    ],
  };
  test("extracts stable dedup key for Instagram message", () => {
    const e = extractEventKey(instaBody);
    expect(e?.key).toBe("instagram:USER_PSID:mid.1");
    expect(e?.message?.text).toBe("سلام");
  });
  test("produces same key for same event (dedup)", () => {
    const e1 = extractEventKey(instaBody);
    const e2 = extractEventKey(JSON.parse(JSON.stringify(instaBody)));
    expect(e1?.key).toBe(e2?.key);
  });
  test("ignores echoes/deliveries without text mid", () => {
    const echo = { object: "page", entry: [{ id: "1", messaging: [{ sender: { id: "X" }, delivery: { mids: ["m"] } }] }] };
    expect(extractEventKey(echo)).toBeNull();
  });
  test("normalizes to internal message", () => {
    const m = toNormalizedMessage(instaBody);
    expect(m?.platform).toBe("instagram");
    expect(m?.text).toBe("سلام");
  });
  test("conversation id scoped by platform+sender", () => {
    expect(conversationIdFor("instagram", "PSID")).toBe("instagram:PSID");
  });
  test("validates payload shape", () => {
    expect(validateMetaPayload({ object: "instagram", entry: [] }).ok).toBe(true);
    expect(validateMetaPayload({ entry: [] }).ok).toBe(false);
  });
});

describe("Phase 19U — retry system", () => {
  test("retries failing operation then succeeds", async () => {
    let calls = 0;
    const r = await withRetry(
      async () => {
        calls++;
        if (calls < 3) throw new Error("flaky");
        return "ok";
      },
      { maxAttempts: 3, baseDelayMs: 5 }
    );
    expect(r).toBe("ok");
    expect(calls).toBe(3);
  });
  test("gives up after max attempts", async () => {
    await expect(
      withRetry(async () => {
        throw new Error("persistent");
      }, { maxAttempts: 2, baseDelayMs: 5 })
    ).rejects.toThrow("persistent");
  });
  test("retryOnce retries then throws on persistent failure", async () => {
    await expect(retryOnce(async () => { throw new Error("nope"); })).rejects.toThrow("nope");
  });
});

describe("Phase 19M/19W — escalation message", () => {
  test("contains key handoff fields and masks customer", () => {
    const msg = buildEscalationMessage({
      platform: "instagram",
      conversationId: "instagram:USER",
      customerIdentifier: "USER_LONG_PSID",
      reason: "unknown intent",
      recentContext: "C: سلام",
    });
    expect(msg).toContain("AI HUMAN HANDOFF");
    expect(msg).toContain("instagram:USER");
    expect(msg).toContain("unknown intent");
    expect(msg).not.toContain("USER_LONG_PSID");
  });
});

describe("Phase 19N/19O — messenger transport injection", () => {
  test("produces correct API payload and returns ids", async () => {
    let captured: any;
    const messenger = new MetaMessenger({
      pageAccessToken: "PAGE_ACCESS_TOKEN",
      transport: async (url, body, headers) => {
        captured = { url, body, headers };
        return { recipient_id: "SENDER", message_id: "mid.out" };
      },
    });
    const r = await messenger.sendText("instagram", "SENDER", "سلام");
    expect(r.recipientId).toBe("SENDER");
    expect(captured.url).toContain("graph.facebook.com");
    expect(captured.body.message.text).toBe("سلام");
    // Token is now in Authorization header (Phase 24 security fix), NOT in URL.
    // Putting tokens in query strings leaks them through proxies, CDNs, and access logs.
    expect(captured.headers).toBeDefined();
    expect(captured.headers["Authorization"]).toBe("Bearer PAGE_ACCESS_TOKEN");
  });
});
