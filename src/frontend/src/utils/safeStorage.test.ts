/**
 * Regression: production white screen when browser storage is denied.
 *
 * Merely reading `window.localStorage` can throw a SecurityError before React
 * mounts. Bootstrap helpers must degrade to null/no-op instead of throwing.
 */
import {
  getBrowserStorage,
  isBrowserStorageAvailable,
  safeStorageGetItem,
  safeStorageRemoveItem,
  safeStorageSetItem,
} from "./safeStorage";

const g = global as unknown as Record<string, unknown>;

const denyStorage = () => {
  const securityError = () => {
    const err = new Error("Access is denied for this document.");
    err.name = "SecurityError";
    throw err;
  };
  g.window = {
    get localStorage() {
      return securityError();
    },
    get sessionStorage() {
      return securityError();
    },
  };
};

const allowStorage = () => {
  const local = new Map<string, string>([["dxn_language", "fr"]]);
  const session = new Map<string, string>();
  const makeStorage = (map: Map<string, string>): Storage => ({
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key: string) => (map.has(key) ? map.get(key)! : null),
    key: (index: number) => Array.from(map.keys())[index] ?? null,
    removeItem: (key: string) => {
      map.delete(key);
    },
    setItem: (key: string, value: string) => {
      map.set(key, String(value));
    },
  });
  g.window = {
    localStorage: makeStorage(local),
    sessionStorage: makeStorage(session),
  };
  return { local, session };
};

const cleanupWindow = () => {
  delete g.window;
};

describe("safeStorage bootstrap hardening", () => {
  afterEach(cleanupWindow);

  it("returns null/no-op when localStorage access throws SecurityError", () => {
    denyStorage();
    expect(getBrowserStorage("localStorage")).toBeNull();
    expect(safeStorageGetItem("dxn_token")).toBeNull();
    expect(() => safeStorageSetItem("dxn_cart", "[]")).not.toThrow();
    expect(() => safeStorageRemoveItem("dxn_token")).not.toThrow();
    expect(isBrowserStorageAvailable("localStorage")).toBe(false);
  });

  it("preserves normal persistence when storage is available", () => {
    const { local } = allowStorage();
    expect(getBrowserStorage("localStorage")).not.toBeNull();
    expect(safeStorageGetItem("dxn_language")).toBe("fr");
    safeStorageSetItem("dxn_token", "token-123");
    expect(local.get("dxn_token")).toBe("token-123");
    safeStorageRemoveItem("dxn_token");
    expect(local.has("dxn_token")).toBe(false);
    expect(isBrowserStorageAvailable("localStorage")).toBe(true);
  });
});
