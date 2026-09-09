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
      const doc = await WebhookEvent.findOne({ dedupKey: key })
        .select({ _id: 1 })
        .lean()
        .exec();
      return !!doc;
    } catch {
      // If Mongo is unavailable, be safe and force a re-check that will fail
      // closed later rather than risk a duplicate automated reply.
      return false;
    }
  }

  /**
   * Atomically claim the event key. Returns true the first time; false when the
   * key was already claimed (a redelivered event).
   */
  async add(key: string): Promise<boolean> {
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
      // upserted === true means this call created the row and therefore "won"
      // the claim. Otherwise the key already existed (duplicate).
      return res.upsertedCount > 0;
    } catch {
      // Duplicate-key race or Mongo error: assume already claimed so we never
      // reply twice. This is safe (at-most-once) by construction.
      return false;
    }
  }
}
