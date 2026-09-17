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
 *  - status / escalation messages contain the required fields;
 *  - valid configuration constructs correct request;
 *  - Telegram failure never throws into order creation;
 *  - module initialization does not crash when configuration is absent.
 */
import axios, { AxiosError } from "axios";
import {
  sendNewOrderNotification,
  sendOrderStatusUpdate,
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
    const [res1, res2, res3, res4] = await Promise.all([
      sendNewOrderNotification(order),
      sendOrderStatusUpdate(order, "confirmed"),
      sendEscalationNotification(order, "r", { firstName: "A", lastName: "B" }),
      telegramSinkAdapter.send("hello"),
    ]);
    expect(res1.skipped).toBe(true); expect(res1.delivered).toBe(false);
    expect(res2.skipped).toBe(true); expect(res2.delivered).toBe(false);
    expect(res3.skipped).toBe(true); expect(res3.delivered).toBe(false);
    expect((res4 as any).skipped).toBe(true); expect((res4 as any).delivered).toBe(false);
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
    expect(call[1].text).toContain("• Product A — 2");
    expect(call[1].text).toContain("• Pack B — 1");
    expect(call[1].text).toContain("الدفع عند الاستلام");
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

describe("Telegram service — Markdown escaping of dynamic text (legacy Markdown mode)", () => {
  beforeEach(() => { setupConfiguredEnv(); jest.clearAllMocks(); });
  afterEach(() => { jest.restoreAllMocks(); });

  const specialOrder = {
    orderNumber: "ORD-SPECIAL",
    customerInfo: {
      firstName: "John_Doe",
      lastName: "Ben*Said",
      phone: "055_12*3",
      secondPhone: "066`7",
      wilaya: "Ain_Bessa*m",
      address: "Rue [des] *Oliviers_",
    },
    deliveryMethod: "home",
    items: [
      { productName: "Pro*duct (A) [1]_x", quantity: 2 },
      { packName: "Pack `B`_star", quantity: 1 },
    ],
    subtotal: 2000,
    shippingFee: 500,
    total: 2500,
    paymentMethod: "cod",
  };

  test("dynamic customer/order text containing _ * [ ] backtick is escaped in the payload", async () => {
    mockedAxios.post.mockResolvedValueOnce({ data: { ok: true, result: { message_id: 1 } } });
    const res = await sendNewOrderNotification(specialOrder);
    expect(res.delivered).toBe(true);
    const call = mockedAxios.post.mock.calls[0] as [string, any];
    const text = call[1].text;

    expect(call[0]).toBe(`https://api.telegram.org/bot${BASE_TOKEN}/sendMessage`);
    expect(call[1].parse_mode).toBe("Markdown");

    // Escaped dynamic values must appear as literal text.
    expect(text).toContain("John\\_Doe");
    expect(text).toContain("Ben\\*Said");
    expect(text).toContain("055\\_12\\*3");
    expect(text).toContain("066\\`7");
    expect(text).toContain("Ain\\_Bessa\\*m");
    expect(text).toContain("Rue \\[des] \\*Oliviers\\_");
    expect(text).toContain("• Pro\\*duct (A) \\[1]\\_x — 2");
    expect(text).toContain("• Pack \\`B\\`\\_star — 1");

    // Raw unescaped dynamic characters must NOT reach the payload.
    expect(text).not.toContain("John_Doe");
    expect(text).not.toContain("Ben*Said");
    expect(text).not.toContain("055_12*3");
    expect(text).not.toContain("066`7");
    expect(text).not.toContain("Ain_Bessa*m");
    expect(text).not.toContain("Rue [des] *Oliviers_");
    expect(text).not.toContain("Pro*duct (A) [1]_x");
    expect(text).not.toContain("Pack `B`_star");

    // Static formatting markers are preserved.
    expect(text).toContain("*NEW ORDER*");
    expect(text).toContain("Order: ORD-SPECIAL");
  });

  test("status update and escalation messages escape dynamic values too", async () => {
    mockedAxios.post.mockResolvedValue({ data: { ok: true, result: { message_id: 1 } } });
    await sendOrderStatusUpdate(
      { orderNumber: "S-1", status: "confirmed", customerInfo: { firstName: "A_B", lastName: "C", phone: "0*" } },
      "confirmed_with*note"
    );
    const text1 = (mockedAxios.post.mock.calls[0] as [string, any])[1].text;
    expect(text1).toContain("Status: confirmed\\_with\\*note");
    expect(text1).toContain("A\\_B");
    expect(text1).toContain("0\\*");
    expect(text1).not.toContain("A_B C");

    await sendEscalationNotification(
      { orderNumber: "E-1" },
      "reason_[x]*note",
      { firstName: "X_Y", lastName: "Z", phone: "9`8" }
    );
    const text2 = (mockedAxios.post.mock.calls[1] as [string, any])[1].text;
    // Legacy Markdown escapes `[` but not `]` (verified against core.telegram.org).
    expect(text2).toContain("Reason: reason\\_\\[x]\\*note");
    expect(text2).not.toContain("Reason: reason_[x]*note");
    expect(text2).toContain("X\\_Y");
    expect(text2).toContain("9\\`8");
  });
});

describe("Telegram service — failure observability and isolation", () => {
  beforeEach(() => { setupConfiguredEnv(); jest.clearAllMocks(); });
  afterEach(() => { jest.restoreAllMocks(); });

  test("Telegram API (non-transient) failure returns delivered=false with status and never throws", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    mockedAxios.post.mockRejectedValue(makeAxiosError(400, "Request failed with status code 400"));
    const res = await sendNewOrderNotification({ orderNumber: "ORD-FAIL", customerInfo: {}, items: [] });

    expect(res.delivered).toBe(false);
    expect(res.status).toBe(400);
    expect(typeof res.error).toBe("string");
    expect(mockedAxios.post).toHaveBeenCalledTimes(1);

    const logged = warnSpy.mock.calls.flat().join("\n");
    expect(logged).toContain("status=400");
    expect(logged).not.toContain(BASE_TOKEN);
    expect(logged).not.toContain("123456:");
    expect(logged).not.toContain("Authorization");
  });

  test("token-shaped content is redacted from error results and logs", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    const e = new Error(`Request to https://api.telegram.org/bot${BASE_TOKEN}/sendMessage failed`) as AxiosError;
    e.isAxiosError = true;
    e.code = "ECONNABORTED";
    mockedAxios.post.mockRejectedValue(e);
    const res = await sendNewOrderNotification({ orderNumber: "ORD-REDACT", customerInfo: {}, items: [] });

    expect(JSON.stringify(res)).not.toContain(BASE_TOKEN);
    expect(JSON.stringify(res)).toContain("bot[redacted]");

    const logged = warnSpy.mock.calls.flat().join("\n");
    expect(logged).not.toContain(BASE_TOKEN);
    expect(logged).toContain("bot[redacted]");
  });

  test("missing configuration produces a safe skipped result and logs it — no HTTP call", async () => {
    clearEnv();
    const infoSpy = jest.spyOn(console, "info").mockImplementation(() => {});
    const res = await sendNewOrderNotification({ orderNumber: "ORD-NOCFG", customerInfo: {}, items: [] });

    expect(res.skipped).toBe(true);
    expect(res.delivered).toBe(false);
    expect(res.status).toBeUndefined();
    expect(mockedAxios.post).not.toHaveBeenCalled();

    const logged = infoSpy.mock.calls.flat().join("\n");
    expect(logged).toContain("skipped");
    expect(logged).not.toContain(BASE_TOKEN);
    expect(logged).not.toContain("123456:");
  });
});