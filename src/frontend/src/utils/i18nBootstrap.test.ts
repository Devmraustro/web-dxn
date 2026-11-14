/**
 * Regression: i18n module initialization must not white-screen the app when
 * browser storage is denied. This runs before React/ErrorBoundary mounting.
 */
const g = global as unknown as Record<string, unknown>;

const deniedStorageWindow = () => {
  const securityError = () => {
    const err = new Error("Access is denied for this document.");
    err.name = "SecurityError";
    throw err;
  };
  const navigator = { language: "ar", languages: ["ar"] };
  g.window = {
    get localStorage() {
      return securityError();
    },
    get sessionStorage() {
      return securityError();
    },
    navigator,
  };
  g.navigator = navigator;
};

const availableStorageWindow = () => {
  const map = new Map<string, string>([["dxn_language", "fr"]]);
  const storage: Storage = {
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
  };
  const navigator = { language: "fr", languages: ["fr"] };
  g.window = { localStorage: storage, sessionStorage: storage, navigator };
  g.navigator = navigator;
};

const cleanup = () => {
  delete g.window;
  delete g.navigator;
  jest.resetModules();
};

describe("i18n bootstrap under denied storage", () => {
  afterEach(cleanup);

  it("does not throw during module initialization and falls back to Arabic", () => {
    deniedStorageWindow();
    jest.resetModules();
    let i18n: any;
    expect(() => {
      jest.isolateModules(() => {
        i18n = require("../i18n").default;
      });
    }).not.toThrow();
    expect(i18n.language).toBe("ar");
  });

  it("still honors a saved French preference when storage is available", () => {
    availableStorageWindow();
    jest.resetModules();
    let i18n: any;
    jest.isolateModules(() => {
      i18n = require("../i18n").default;
    });
    expect(i18n.language).toBe("fr");
  });
});
