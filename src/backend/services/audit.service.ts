/**
 * DXN Natural Life — Best-Effort Admin Security Audit Logger.
 *
 * Never blocks or throws if the database is disconnected or mocked in unit tests.
 * Never logs raw passwords, tokens, or secret credentials.
 */
import mongoose from "mongoose";
import * as Models from "../../Database/Models";

export interface AuditEntryInput {
  action: string;
  resourceType: string;
  resourceId?: string;
  summary?: string;
}

export async function recordAuditLog(req: any, entry: AuditEntryInput): Promise<void> {
  try {
    const AuditLogModel = (Models as any).AuditLog;
    if (!AuditLogModel || typeof AuditLogModel.create !== "function") return;

    // In real Mongoose runtime without a connection, skip instead of buffering until timeout
    if (
      AuditLogModel.db &&
      typeof mongoose.connection?.readyState === "number" &&
      mongoose.connection.readyState !== 1 &&
      !(AuditLogModel.create as any)._isMockFunction
    ) {
      return;
    }

    const user = req?.user || {};
    const rawIp =
      (typeof req?.headers?.["x-forwarded-for"] === "string"
        ? req.headers["x-forwarded-for"].split(",")[0].trim()
        : "") ||
      req?.ip ||
      "";

    await AuditLogModel.create({
      actorId: user.id && mongoose.Types.ObjectId.isValid(String(user.id)) ? user.id : undefined,
      actorEmail: typeof user.email === "string" ? user.email.slice(0, 160) : "",
      actorRole: typeof user.role === "string" ? user.role.slice(0, 40) : "",
      action: String(entry.action || "").slice(0, 120),
      resourceType: String(entry.resourceType || "").slice(0, 80),
      resourceId: String(entry.resourceId || "").slice(0, 120),
      summary: String(entry.summary || "").slice(0, 500),
      ip: String(rawIp).slice(0, 64),
    });
  } catch (err) {
    // Non-fatal: audit failures must never crash user/admin workflows
  }
}
