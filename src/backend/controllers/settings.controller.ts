import { Request, Response } from "express";
import * as Models from "../../Database/Models";
import type { AuthRequest } from "../middleware/auth.middleware";
import {
  getAdminSiteSettings,
  getPublicSiteSettings,
  sanitizeExternalHttpsUrl,
  sanitizeWhatsappNumber,
} from "../services/siteSettings.service";
import { normalizeOptionalDxnMemberId } from "../services/attribution.service";
import { recordAuditLog } from "../services/audit.service";

export const getPublicSettingsHandler = async (_req: Request, res: Response) => {
  try {
    const settings = await getPublicSiteSettings();
    res.json({ success: true, data: settings });
  } catch (error) {
    console.error("Get public settings error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getAdminSettingsHandler = async (_req: AuthRequest, res: Response) => {
  try {
    const settings = await getAdminSiteSettings();
    const NotificationLogModel = (Models as any).NotificationLog;
    const AuditLogModel = (Models as any).AuditLog;

    let recentNotifications: any[] = [];
    let recentAudits: any[] = [];
    if (NotificationLogModel && typeof NotificationLogModel.find === "function") {
      try {
        recentNotifications = await NotificationLogModel.find({})
          .sort({ createdAt: -1 })
          .limit(20)
          .lean();
      } catch {
        recentNotifications = [];
      }
    }
    if (AuditLogModel && typeof AuditLogModel.find === "function") {
      try {
        recentAudits = await AuditLogModel.find({})
          .sort({ createdAt: -1 })
          .limit(25)
          .lean();
      } catch {
        recentAudits = [];
      }
    }

    res.json({
      success: true,
      data: {
        settings,
        recentNotifications,
        recentAudits,
      },
    });
  } catch (error) {
    console.error("Get admin settings error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const updateAdminSettingsHandler = async (req: AuthRequest, res: Response) => {
  try {
    const SiteSettingsModel = (Models as any).SiteSettings;
    const body = req.body || {};

    const patch: Record<string, any> = {};

    if (body.brandName !== undefined) {
      patch.brandName = String(body.brandName || "DXN Natural Life").trim().slice(0, 80) || "DXN Natural Life";
    }
    if (body.sponsorMembershipNumber !== undefined) {
      const check = normalizeOptionalDxnMemberId(body.sponsorMembershipNumber);
      if (!check.valid) {
        return res.status(400).json({ message: check.error || "Invalid sponsor membership number" });
      }
      patch.sponsorMembershipNumber = check.value || "";
    }
    if (body.sponsorNameAr !== undefined) {
      patch.sponsorNameAr = String(body.sponsorNameAr || "").trim().slice(0, 120);
    }
    if (body.sponsorNameFr !== undefined) {
      patch.sponsorNameFr = String(body.sponsorNameFr || "").trim().slice(0, 120);
    }
    if (body.whatsappNumber !== undefined) {
      const rawWa = String(body.whatsappNumber || "").trim();
      if (rawWa !== "" && !sanitizeWhatsappNumber(rawWa)) {
        return res.status(400).json({ message: "Invalid WhatsApp phone number (use 8–15 digits)" });
      }
      patch.whatsappNumber = sanitizeWhatsappNumber(rawWa);
    }
    if (body.contactEmail !== undefined) {
      patch.contactEmail = String(body.contactEmail || "").trim().toLowerCase().slice(0, 160);
    }
    if (body.socialLinks && typeof body.socialLinks === "object") {
      const sl = body.socialLinks;
      for (const platform of ["facebook", "instagram", "tiktok", "telegram", "whatsapp"] as const) {
        if (sl[platform] !== undefined) {
          const rawUrl = String(sl[platform] || "").trim();
          if (rawUrl !== "" && !sanitizeExternalHttpsUrl(rawUrl)) {
            return res.status(400).json({
              message: `Invalid ${platform} URL — must be a valid https:// URL`,
            });
          }
          patch[`socialLinks.${platform}`] = sanitizeExternalHttpsUrl(rawUrl);
        }
      }
    }
    if (typeof body.telegramNotificationsEnabled === "boolean") {
      patch.telegramNotificationsEnabled = body.telegramNotificationsEnabled;
    }
    if (typeof body.notifyOnNewOrder === "boolean") {
      patch.notifyOnNewOrder = body.notifyOnNewOrder;
    }
    if (typeof body.notifyOnNewLead === "boolean") {
      patch.notifyOnNewLead = body.notifyOnNewLead;
    }
    if (typeof body.notifyOnNewContact === "boolean") {
      patch.notifyOnNewContact = body.notifyOnNewContact;
    }
    if (body.businessHoursAr !== undefined) {
      patch.businessHoursAr = String(body.businessHoursAr || "").trim().slice(0, 200);
    }
    if (body.businessHoursFr !== undefined) {
      patch.businessHoursFr = String(body.businessHoursFr || "").trim().slice(0, 200);
    }

    patch.updatedBy = req.user?.userId || req.user?.id;

    await SiteSettingsModel.findOneAndUpdate(
      { key: "global" },
      { $set: patch },
      { upsert: true, new: true }
    );

    await recordAuditLog(req, {
      action: "settings.update",
      resourceType: "SiteSettings",
      resourceId: "global",
      summary: "Updated global site settings",
    });

    const settings = await getAdminSiteSettings();
    res.json({ success: true, data: settings });
  } catch (error) {
    console.error("Update admin settings error:", error);
    res.status(500).json({ message: "Server error" });
  }
};
