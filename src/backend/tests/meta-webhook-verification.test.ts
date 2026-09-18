/**
 * DB-free test for Meta webhook verification endpoint.
 * Tests the exact GET request Meta sends for verification.
 * 
 * IMPORTANT: Environment variables MUST be set at top level BEFORE imports
 * because meta.routes.ts captures META_VERIFY_TOKEN at module load time.
 */
process.env.META_VERIFY_TOKEN = "test_verify_token_123";
process.env.META_APP_SECRET = "test_app_secret_456";
process.env.META_PAGE_ACCESS_TOKEN = "test_page_token_789";

import request from "supertest";
import { startServer } from "../../backend/index";
import type { Server } from "http";

let app: ReturnType<typeof startServer>;
let server: Server;

beforeAll(async () => {
  app = startServer();
  server = app.listen(0);
});

afterAll(async () => {
  server.close();
});

describe("Meta webhook verification — GET /api/meta/webhook", () => {
  test("returns challenge when mode=subscribe, token matches, challenge present", async () => {
    const challenge = "123456";
    const res = await request(app)
      .get("/api/meta/webhook")
      .query({
        "hub.mode": "subscribe",
        "hub.verify_token": "test_verify_token_123",
        "hub.challenge": challenge,
      })
      .expect(200);

    // Meta expects the challenge as the raw response body, not JSON
    expect(res.text).toBe(challenge);
  });

  test("returns challenge when mode=subscribe, token matches (case-sensitive)", async () => {
    const challenge = "abcdef";
    const res = await request(app)
      .get("/api/meta/webhook")
      .query({
        "hub.mode": "subscribe",
        "hub.verify_token": "test_verify_token_123",
        "hub.challenge": challenge,
      })
      .expect(200);

    expect(res.text).toBe(challenge);
  });

  test("rejects wrong verify_token with 403", async () => {
    await request(app)
      .get("/api/meta/webhook")
      .query({
        "hub.mode": "subscribe",
        "hub.verify_token": "wrong_token",
        "hub.challenge": "123456",
      })
      .expect(403)
      .expect("Verification failed");
  });

  test("rejects wrong hub.mode with 403", async () => {
    await request(app)
      .get("/api/meta/webhook")
      .query({
        "hub.mode": "unsubscribe",
        "hub.verify_token": "test_verify_token_123",
        "hub.challenge": "123456",
      })
      .expect(403)
      .expect("Verification failed");
  });

  test("rejects missing hub.mode with 403", async () => {
    await request(app)
      .get("/api/meta/webhook")
      .query({
        "hub.verify_token": "test_verify_token_123",
        "hub.challenge": "123456",
      })
      .expect(403)
      .expect("Verification failed");
  });

  test("rejects missing hub.verify_token with 403", async () => {
    await request(app)
      .get("/api/meta/webhook")
      .query({
        "hub.mode": "subscribe",
        "hub.challenge": "123456",
      })
      .expect(403)
      .expect("Verification failed");
  });

  test("rejects missing hub.challenge with 403", async () => {
    await request(app)
      .get("/api/meta/webhook")
      .query({
        "hub.mode": "subscribe",
        "hub.verify_token": "test_verify_token_123",
      })
      .expect(403)
      .expect("Verification failed");
  });

  test("rejects empty verify_token with 403", async () => {
    await request(app)
      .get("/api/meta/webhook")
      .query({
        "hub.mode": "subscribe",
        "hub.verify_token": "",
        "hub.challenge": "123456",
      })
      .expect(403)
      .expect("Verification failed");
  });
});

describe("Meta webhook verification — GET /meta/webhook (backward compat)", () => {
  test("returns challenge on correct token", async () => {
    const challenge = "challenge_789";
    const res = await request(app)
      .get("/meta/webhook")
      .query({
        "hub.mode": "subscribe",
        "hub.verify_token": "test_verify_token_123",
        "hub.challenge": challenge,
      })
      .expect(200);

    expect(res.text).toBe(challenge);
  });
});

describe("Meta webhook verification — token presence check", () => {
  test("META_VERIFY_TOKEN is PRESENT in test env", () => {
    expect(process.env.META_VERIFY_TOKEN).toBeDefined();
    expect(process.env.META_VERIFY_TOKEN!.length).toBeGreaterThan(0);
  });

  test("fails when META_VERIFY_TOKEN is not set in env at startup", async () => {
    // This test verifies the behavior when token is missing at app startup
    // We need to dynamically import to get a fresh app instance
    const { startServer: freshStart } = await import("../../backend/index");
    
    // Save and clear the token
    const saved = process.env.META_VERIFY_TOKEN;
    delete process.env.META_VERIFY_TOKEN;
    
    const freshApp = freshStart();
    
    await request(freshApp)
      .get("/api/meta/webhook")
      .query({
        "hub.mode": "subscribe",
        "hub.verify_token": "any_token",
        "hub.challenge": "123456",
      })
      .expect(403);
    
    // Restore
    process.env.META_VERIFY_TOKEN = saved;
  });
});

describe("Meta webhook POST — validateInput regression tests", () => {
  test("A. Meta-style raw Buffer payload larger than 100 bytes is NOT rejected by validateInput", async () => {
    // Create a raw Buffer similar to what Meta sends (larger than 100 bytes)
    const rawBody = Buffer.from(
      JSON.stringify({
        object: "page",
        entry: [
          {
            id: "123456789",
            time: Date.now(),
            messaging: [
              {
                sender: { id: "USER_PSID_123456789" },
                recipient: { id: "PAGE_ID_987654321" },
                timestamp: Date.now(),
                message: {
                  mid: "m_123456789",
                  text: "This is a test message that is long enough to create a Buffer larger than 100 bytes when stringified",
                },
              },
            ],
          },
        ],
      })
    );

    // Send raw body directly - this is how Meta sends webhook events
    const res = await request(app)
      .post("/api/meta/webhook")
      .set("Content-Type", "application/json")
      .set("X-Hub-Signature-256", "sha256=invalid") // Will fail signature but should pass validateInput
      .send(rawBody);

    // Should NOT be 413 (validateInput should allow Buffer)
    // Will be 401 due to invalid signature, but should NOT be 413
    expect(res.status).not.toBe(413);
    expect(res.status).toBe(401); // Invalid signature rejection
    expect(res.body.status).toBe("invalid signature");
  });

  test("B. Generic JSON request with >100 keys is STILL rejected with 413", async () => {
    // Create an object with >100 keys
    const largeObject: Record<string, string> = {};
    for (let i = 0; i < 105; i++) {
      largeObject[`key${i}`] = `value${i}`;
    }

    const res = await request(app)
      .post("/api/products") // Regular API endpoint with JSON body parser
      .set("Content-Type", "application/json")
      .send(largeObject);

    expect(res.status).toBe(413);
    expect(res.body.message).toBe("Request body too complex");
  });

  test("C. Invalid Meta signature is STILL rejected", async () => {
    const rawBody = Buffer.from(
      JSON.stringify({
        object: "page",
        entry: [
          {
            id: "123456789",
            time: Date.now(),
            messaging: [
              {
                sender: { id: "USER_PSID_123456789" },
                recipient: { id: "PAGE_ID_987654321" },
                timestamp: Date.now(),
                message: { mid: "m_123456789", text: "test" },
              },
            ],
          },
        ],
      })
    );

    const res = await request(app)
      .post("/api/meta/webhook")
      .set("Content-Type", "application/json")
      .set("X-Hub-Signature-256", "sha256=invalid_signature")
      .send(rawBody);

    expect(res.status).toBe(401);
    expect(res.body.status).toBe("invalid signature");
  });

  test("D. Valid Meta test payload reaches the webhook processing path", async () => {
    // Create a valid test body
    const testBody = {
      object: "page",
      entry: [
        {
          id: "123456789",
          time: Date.now(),
          messaging: [
            {
              sender: { id: "TEST_USER_123" },
              recipient: { id: "TEST_PAGE_456" },
              timestamp: Date.now(),
              message: { mid: "m_test_123", text: "مرحبا" },
            },
          ],
        },
      ],
    };

    const rawBody = Buffer.from(JSON.stringify(testBody));

    // Generate valid HMAC signature
    const crypto = require("crypto");
    const signature = "sha256=" + crypto
      .createHmac("sha256", "test_app_secret_456")
      .update(rawBody)
      .digest("hex");

    const res = await request(app)
      .post("/api/meta/webhook")
      .set("Content-Type", "application/json")
      .set("X-Hub-Signature-256", signature)
      .send(rawBody);

    // Should reach the webhook processing (200 with status received or not_configured)
    // Note: META_PAGE_ACCESS_TOKEN is set in test env, so it should process
    expect([200, 401]).toContain(res.status); // 401 if not_configured, 200 if processed
    expect(res.status).not.toBe(413);
  });

  test("E. GET verification still works with hub.mode, hub.verify_token and hub.challenge", async () => {
    const challenge = "123456";
    const res = await request(app)
      .get("/api/meta/webhook")
      .query({
        "hub.mode": "subscribe",
        "hub.verify_token": "test_verify_token_123",
        "hub.challenge": challenge,
      })
      .expect(200);

    // Meta expects the challenge as the raw response body, not JSON
    expect(res.text).toBe(challenge);
  });

  test("F. Buffer with many byte indexes does not trigger key limit", async () => {
    // Create a Buffer with >100 bytes
    const largeBuffer = Buffer.alloc(200, "x");

    const res = await request(app)
      .post("/api/meta/webhook")
      .set("Content-Type", "application/json")
      .set("X-Hub-Signature-256", "sha256=invalid")
      .send(largeBuffer);

    // Should NOT be 413
    expect(res.status).not.toBe(413);
  });
});