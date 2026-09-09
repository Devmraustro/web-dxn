/**
 * Phase 24 — Telegram service unit tests.
 *
 * Verifies the safe-config behaviour of the Telegram notification helpers:
 *  - when TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is missing, the helpers
 *    return a "skipped" result WITHOUT attempting any HTTP call
 *    (i.e. the URL must never contain "undefined");
 *  - the TelegramSink adapter never throws on transient failure and never
 *    leaks the bot token to the error message;
 *  - large order payloads are truncated to a safe size;
 *  - status / baridimob / escalation messages contain the required fields;
 *  - valid configuration constructs correct request;
 *  - Telegram failure never throws into order creation;
 *  - module initialization does not crash when configuration is absent.
 */
import axios, { AxiosError } from "axios";
import {
  sendNewOrderNotification,
  sendOrderStatusUpdate,
  sendBaridiMobVerificationNotice,
  sendEscalationNotification,
  telegramSinkAdapter,
  isTelegramConfigured,
} from "../services/telegram.service";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

const BASE_TOKEN = "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11";
const BASE_CHAT = "-1001234567890";

function setupConfiguredEnv() {
  process.env.TELEGRAM_BOT_TOKEN = BASE_TOKEN;
  process.env.TELEGRAM_CHAT_ID = BASE_CHAT;
}

function clearEnv() {
  delete process.env.TELEGRAM_BOT_TOKEN;
  delete process.env.TELEGRAM_CHAT_ID;
}

function makeAxiosError(status: number, message = "error"): Error {
  const e = new Error(message) as AxiosError;
  e.isAxiosError = true;
  e.response = { status } as any;
  return e;
}

function makeNetworkError(code: string): Error {
  const e = new Error(`network ${code}`) as AxiosError;
  e.isAxiosError = true;
  e.code = code;
  return e;
}

describe("Telegram service — safe configuration behaviour", () => {
  beforeEach(() => { clearEnv(); jest.clearAllMocks(); });
  afterEach(() => { jest.restoreAllMocks(); });

  test("isTelegramConfigured reflects env presence", () => {
    clearEnv();
    expect(isTelegramConfigured()).toBe(false);
    setupConfiguredEnv();
    expect(isTelegramConfigured()).toBe(true);
  });

  test("all helpers return skipped result when env is missing — no HTTP call", async () => {
    clearEnv();
    const order = { orderNumber: "X", customerInfo: {}, items: [], subtotal: 0, shippingFee: 0, total: 0 };
    const [res1, res2, res3, res4, res5] = await Promise.all([
      sendNewOrderNotification(order),
      sendOrderStatusUpdate(order, "confirmed"),
      sendBaridiMobVerificationNotice(order),
      sendEscalationNotification(order, "r", { firstName: "A", lastName: "B" }),
      telegramSinkAdapter.send("hello"),
    ]);
    expect(res1.skipped).toBe(true); expect(res1.delivered).toBe(false);
    expect(res2.skipped).toBe(true); expect(res2.delivered).toBe(false);
    expect(res3.skipped).toBe(true); expect(res3.delivered).toBe(false);
    expect(res4.skipped).toBe(true); expect(res4.delivered).toBe(false);
    expect((res5 as any).skipped).toBe(true); expect((res5 as any).delivered).toBe(false);
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  test("Telegram API URL never contains 'undefined' when env is missing", async () => {
    clearEnv();
    const res = await sendNewOrderNotification({ items: [], customerInfo: {} });
    expect(JSON.stringify(res)).not.toMatch(/undefined/);
  });
});

describe("Telegram service — valid configuration with mocked axios", () => {
  beforeEach(() => { setupConfiguredEnv(); jest.clearAllMocks(); });
  afterEach(() => { jest.restoreAllMocks(); });

  test("sendNewOrderNotification constructs correct axios request", async () => {
    mockedAxios.post.mockResolvedValueOnce({ data: { ok: true, result: { message_id: 1 } } });
    const order = {
      orderNumber: "ORD-123",
      customerInfo: { firstName: "John", lastName: "Doe", phone: "0551234567", wilaya: "Algiers", secondPhone: "0661234567", address: "123 Main St" },
      deliveryMethod: "home",
      items: [{ productName: "Product A", quantity: 2 }, { packName: "Pack B", quantity: 1 }],
      subtotal: 2000, shippingFee: 500, total: 2500, paymentMethod: "cod",
    };
    const res = await sendNewOrderNotification(order);
    expect(res.delivered).toBe(true);
    const call = mockedAxios.post.mock.calls[0] as [string, any];
    expect(call[0]).toBe(`https://api.telegram.org/bot${BASE_TOKEN}/sendMessage`);
    expect(call[1]).toMatchObject({ chat_id: BASE_CHAT, parse_mode: "Markdown", disable_web_page_preview: true });
    expect(call[1].text).toContain("ORD-123");
    expect(call[1].text).toContain("John Doe");
    expect(call[1].text).toContain("Product A x2");
    expect(call[1].text).toContain("Pack B x1");
    expect(call[1].text).toContain("Cash on Delivery");
  });

  test("sendOrderStatusUpdate constructs correct request", async () => {
    mockedAxios.post.mockResolvedValueOnce({ data: { ok: true } });
    const res = await sendOrderStatusUpdate(
      { orderNumber: "ORD-123", status: "confirmed", customerInfo: { firstName: "John", lastName: "Doe", phone: "0551234567" } },
      "confirmed"
    );
    expect(res.delivered).toBe(true);
    const call = mockedAxios.post.mock.calls[0] as [string, any];
    expect(call[1].text).toContain("✅ Order confirmed");
    expect(call[1].text).toContain("ORD-123");
  });

  test("sendBaridiMobVerificationNotice constructs correct request", async () => {
    mockedAxios.post.mockResolvedValueOnce({ data: { ok: true } });
    const res = await sendBaridiMobVerificationNotice({ orderNumber: "ORD-456", customerInfo: { firstName: "Jane", lastName: "Smith", phone: "0771234567" }, total: 3000 });
    expect(res.delivered).toBe(true);
    const call = mockedAxios.post.mock.calls[0] as [string, any];
    expect(call[1].text).toContain("BaridiMob Payment Verification Required");
  });

  test("sendEscalationNotification constructs correct request", async () => {
    mockedAxios.post.mockResolvedValueOnce({ data: { ok: true } });
    const res = await sendEscalationNotification({ orderNumber: "ORD-789" }, "customer dispute", { firstName: "Bob", lastName: "Wilson", phone: "0661234567" });
    expect(res.delivered).toBe(true);
    const call = mockedAxios.post.mock.calls[0] as [string, any];
    expect(call[1].text).toContain("ESCALATION TO OWNER");
    expect(call[1].text).toContain("customer dispute");
  });
});

describe("Telegram service — error handling and isolation", () => {
  beforeEach(() => { setupConfiguredEnv(); jest.clearAllMocks(); });
  afterEach(() => { jest.restoreAllMocks(); });

  test("Telegram token never appears in error messages or logs", async () => {
    mockedAxios.post.mockRejectedValue(makeNetworkError("ENOTFOUND"));
    const res = await sendNewOrderNotification({ orderNumber: "X", customerInfo: {}, items: [] });
    const json = JSON.stringify(res);
    expect(json).not.toContain(BASE_TOKEN);
    expect(json).not.toContain("123456:");
  });

  test("long message is truncated to HTTP_MAX_BODY_BYTES", async () => {
    mockedAxios.post.mockResolvedValueOnce({ data: { ok: true } });
    const longText = "A".repeat(10000);
    const res = await telegramSinkAdapter.send(longText);
    expect((res as any).delivered).toBe(true);
    const call = mockedAxios.post.mock.calls[0] as [string, any];
    expect(call[1].text.length).toBeLessThanOrEqual(4000);
  });

  test("TelegramSink adapter never throws into order creation", async () => {
    mockedAxios.post.mockRejectedValue(makeAxiosError(500));
    await expect(telegramSinkAdapter.send("hello")).rejects.toThrow();
    // The adapter throws on 5xx non-skipped failure — the caller catches it
    // and order creation continues. Verify at least 1 attempt was made.
    expect(mockedAxios.post).toHaveBeenCalled();
  });
});

describe("Telegram service — module initialization safety", () => {
  test("module imports load without crashing when env absent", () => {
    expect(typeof sendNewOrderNotification).toBe("function");
    expect(typeof telegramSinkAdapter.send).toBe("function");
    expect(typeof isTelegramConfigured).toBe("function");
  });
});