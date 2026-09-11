/**
 * Bounded cold-start readiness wait — pure, DB-free, unit-testable.
 *
 * `waitForReady(isReady, opts)` polls `isReady()` at most `intervalMs` apart
 * and returns as soon as it becomes true, or `false` once `timeoutMs` elapses.
 *
 * It is a strict, bounded wait:
 *  - Warm path (already connected): returns `true` immediately, no sleep — the
 *    `/api/health` behaviour for an already-running DB is unchanged.
 *  - Cold start: waits up to `timeoutMs` (bounded, never an unbounded /hang`,
 *    so the health request can never idle the Vercel serverless function or
 *    spin past the platform request budget). If the connection becomes ready
 *    inside the window it reports healthy; otherwise it reports degraded.
 *  - It never touches the network, never mutates anything — it only observes
 *    state.
 *
 * The function never throws; failures are simply reported as "not ready".
 */

const DEFAULT_INTERVAL_MS = 100;

export interface ReadyWaitOptions {
  /** Max wall-clock time to spend polling, in ms. Default 2_500. */
  timeoutMs?: number;
  /** Poll interval, in ms. Default 100. */
  intervalMs?: number;
}

export function waitForReady(
  isReady: () => boolean,
  opts: ReadyWaitOptions = {}
): Promise<boolean> {
  const timeoutMs = opts.timeoutMs ?? 2_500;
  const intervalMs = Math.max(1, opts.intervalMs ?? DEFAULT_INTERVAL_MS);

  return new Promise<boolean>((resolve) => {
    if (isReady()) {
      resolve(true);
      return;
    }
    if (timeoutMs <= 0) {
      resolve(false);
      return;
    }
    const deadline = Date.now() + timeoutMs;
    const tick = () => {
      if (isReady()) {
        resolve(true);
        return;
      }
      if (Date.now() >= deadline) {
        resolve(false);
        return;
      }
      // Sleep up to intervalMs, then re-check. Bound the sleep so even a busy
      // event loop still makes progress toward the deadline.
      setTimeout(tick, Math.min(intervalMs, Math.max(1, deadline - Date.now())));
    };
    tick();
  });
}

/** Small promise-based sleep used by waitForReady's polling loop. */
export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));