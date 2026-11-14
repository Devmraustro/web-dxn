/**
 * Bootstrap-safe browser storage access.
 *
 * ROOT-CAUSE CONTEXT (production white screen): module initialization and
 * provider state initializers read `window.localStorage` directly. In browsers
 * where site data / cookies are blocked (or storage is otherwise unavailable),
 * merely accessing `window.localStorage` throws a `SecurityError` before React
 * mounts. The application ErrorBoundary cannot catch module-loading or
 * pre-mount provider errors, so the viewport stays blank.
 *
 * These helpers keep persistence best-effort: when storage is available the
 * behavior is unchanged; when it is denied they return null / no-op instead of
 * throwing during bootstrap.
 */

export type BrowserStorageKind = "localStorage" | "sessionStorage";

export function getBrowserStorage(kind: BrowserStorageKind = "localStorage"): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    const storage = window[kind];
    if (!storage || typeof storage.getItem !== "function") return null;
    return storage;
  } catch {
    return null;
  }
}

export function safeStorageGetItem(
  key: string,
  kind: BrowserStorageKind = "localStorage"
): string | null {
  try {
    const storage = getBrowserStorage(kind);
    return storage ? storage.getItem(key) : null;
  } catch {
    return null;
  }
}

export function safeStorageSetItem(
  key: string,
  value: string,
  kind: BrowserStorageKind = "localStorage"
): void {
  try {
    const storage = getBrowserStorage(kind);
    if (storage) storage.setItem(key, value);
  } catch {
    // Best-effort persistence only; never break bootstrap or checkout.
  }
}

export function safeStorageRemoveItem(
  key: string,
  kind: BrowserStorageKind = "localStorage"
): void {
  try {
    const storage = getBrowserStorage(kind);
    if (storage) storage.removeItem(key);
  } catch {
    // Best-effort persistence only.
  }
}

export function isBrowserStorageAvailable(kind: BrowserStorageKind = "localStorage"): boolean {
  try {
    const storage = getBrowserStorage(kind);
    if (!storage || typeof storage.setItem !== "function" || typeof storage.removeItem !== "function") {
      return false;
    }
    const probeKey = "__dxn_storage_probe__";
    storage.setItem(probeKey, "1");
    storage.removeItem(probeKey);
    return true;
  } catch {
    return false;
  }
}
