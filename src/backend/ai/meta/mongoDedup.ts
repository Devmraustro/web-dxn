/**
 * Phase 23 — Durable idempotency registry for Meta webhook events.
 *
 * Backs the Meta dedup registry with the WebhookEvent Mongo collection instead
 * of process-local memory, so that:
 *   - a Meta retry redelivering the same event is NOT answered twice, even
 *     after a restart,
 *   - multiple replicas share the same idempotency store.
 *
 * Correctness relies on the unique, sparse index on WebhookEvent.dedupKey
 * (see src/Database/Models.ts). `add()` is an atomic upsert: if the key was
 * already claimed the insert becomes a no-op, which is how a delayed redelivery
 * is recognized.
 */
import { WebhookEvent } from "../../../Database/Models";
import { DedupRegistry } from "./processor";
import { ensureDB } from "../../db";

export interface MongoDedupRegistryOptions {
  /** Webhook source label recorded on the dedup row. Defaults to "meta". */
  source?: string;
}

export class MongoDedupRegistry implements DedupRegistry {
  private source: string;

  constructor(opts: MongoDedupRegistryOptions = {}) {
    this.source = opts.source || "meta";
  }

  async has(key: string): Promise<boolean> {
    try {
      await ensureDB();
      const doc = await WebhookEvent.findOne({ dedupKey: key })
        .select({ _id: 1 })
        .lean()
        .exec();
      return !!doc;
    } catch (err) {
      console.error("[DIAGNOSTIC-DEDUP] has_error", err instanceof Error ? err.message : String(err));
      throw err;
    }
  }

  /**
   * Atomically claim the event key. Returns true the first time; false when the
   * key was already claimed (a redelivered event).
   * Throws on database errors so callers can handle them appropriately.
   */
  async add(key: string): Promise<boolean> {
    await ensureDB();
    console.log("[DIAGNOSTIC-DEDUP] add_start", JSON.stringify({
      keyLength: key.length,
      keyPrefix: key.split(":")[0],
    }));
    try {
      const res = await WebhookEvent.updateOne(
        { dedupKey: key },
        {
          $setOnInsert: {
            source: this.source,
            event: key,
            payload: { dedupKey: key },
            status: "processed",
            processedAt: new Date(),
          },
        },
        { upsert: true }
      );
      console.log("[DIAGNOSTIC-DEDUP] add_result", JSON.stringify({
        upsertedCount: res.upsertedCount,
        matchedCount: res.matchedCount,
        modifiedCount: res.modifiedCount,
        upsertedCount_gt_0: res.upsertedCount > 0,
      }));
      return res.upsertedCount > 0;
    } catch (err) {
      console.error("[DIAGNOSTIC-DEDUP] add_error", err instanceof Error ? err.message : String(err));
      throw err;
    }
  }
}
