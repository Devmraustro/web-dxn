import { Request, Response } from "express";
import * as Models from "../../Database/Models";
import type { AuthRequest } from "../middleware/auth.middleware";
import { generateReferenceCode, normalizeTrafficSource } from "../services/attribution.service";
import { getAdminSiteSettings } from "../services/siteSettings.service";
import { sendNewContactRequestNotification } from "../services/telegram.service";
import { recordAuditLog } from "../services/audit.service";

export const createContactMessage = async (req: Request, res: Response) => {
  try {
    const body = req.body || {};

    if (typeof body.website === "string" && body.website.trim() !== "") {
      return res.status(400).json({ message: "Submission rejected" });
    }
    if (body.privacyConsent !== true) {
      return res.status(400).json({ message: "Privacy consent is required" });
    }

    const ContactMessageModel = (Models as any).ContactMessage;
    const trafficSource = normalizeTrafficSource(body.trafficSource);

    let saved: any = null;
    for (let attempt = 0; attempt < 3 && !saved; attempt++) {
      const reference = generateReferenceCode("MSG");
      try {
        saved = await ContactMessageModel.create({
          reference,
          name: String(body.name || "").trim().slice(0, 150),
          phone: typeof body.phone === "string" ? body.phone.trim().slice(0, 30) : "",
          email: typeof body.email === "string" ? body.email.trim().toLowerCase().slice(0, 160) : "",
          subject: typeof body.subject === "string" ? body.subject.trim().slice(0, 200) : "",
          message: String(body.message || "").trim().slice(0, 3000),
          privacyConsent: true,
          status: "new",
          trafficSource: {
            source: trafficSource.source,
            ref: trafficSource.ref,
            landingPath: trafficSource.landingPath,
          },
        });
      } catch (err: any) {
        if (err?.code === 11000 && attempt < 2) continue;
        throw err;
      }
    }

    if (!saved) {
      return res.status(500).json({ message: "Could not submit message, please retry" });
    }

    const settings = await getAdminSiteSettings();
    if (settings.telegramNotificationsEnabled && settings.notifyOnNewContact) {
      try {
        await sendNewContactRequestNotification(saved);
      } catch (notifyErr: any) {
        console.warn(`[telegram] contact ${saved.reference} notification error: ${notifyErr?.message ?? "unknown"}`);
      }
    }

    return res.status(201).json({
      success: true,
      message: "Contact message received",
      data: {
        reference: saved.reference,
        createdAt: saved.createdAt || new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Create contact message error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const getAdminContactMessages = async (req: Request, res: Response) => {
  try {
    const ContactMessageModel = (Models as any).ContactMessage;
    const pageNum = Math.min(Math.max(parseInt(String(req.query.page || "1"), 10) || 1, 1), 1000);
    const limitNum = Math.min(Math.max(parseInt(String(req.query.limit || "25"), 10) || 25, 1), 100);
    const filter: Record<string, any> = {};
    if (req.query.status && req.query.status !== "all") {
      filter.status = String(req.query.status);
    }

    const [messages, total] = await Promise.all([
      ContactMessageModel.find(filter)
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
      ContactMessageModel.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: messages,
      pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) || 1 },
    });
  } catch (error) {
    console.error("Get admin contact messages error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const updateAdminContactMessage = async (req: AuthRequest, res: Response) => {
  try {
    const ContactMessageModel = (Models as any).ContactMessage;
    const { id } = req.params;
    const { status, adminNotes } = req.body || {};

    const update: Record<string, any> = {};
    if (status && ["new", "read", "replied", "archived"].includes(status)) {
      update.status = status;
    }
    if (adminNotes !== undefined) {
      update.adminNotes = String(adminNotes || "").slice(0, 2000);
    }

    const updated = await ContactMessageModel.findByIdAndUpdate(
      id,
      { $set: update },
      { new: true }
    );
    if (!updated) {
      return res.status(404).json({ message: "Message not found" });
    }

    await recordAuditLog(req, {
      action: "contact.update",
      resourceType: "ContactMessage",
      resourceId: String(updated._id),
      summary: `Updated contact message ${updated.reference} status=${updated.status}`,
    });

    res.json({ success: true, data: updated });
  } catch (error: any) {
    if (String(error?.message || "").includes("Cast to ObjectId")) {
      return res.status(400).json({ message: "Invalid message ID format" });
    }
    console.error("Update contact message error:", error);
    res.status(500).json({ message: "Server error" });
  }
};
