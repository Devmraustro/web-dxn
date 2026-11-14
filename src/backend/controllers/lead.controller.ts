import { Request, Response } from "express";
import * as Models from "../../Database/Models";
import type { AuthRequest } from "../middleware/auth.middleware";
import {
  generateReferenceCode,
  normalizeOptionalDxnMemberId,
  normalizeTrafficSource,
} from "../services/attribution.service";
import { getAdminSiteSettings } from "../services/siteSettings.service";
import { sendNewMembershipLeadNotification } from "../services/telegram.service";
import { serializeLeadsToCsv } from "../services/csv.service";
import { recordAuditLog } from "../services/audit.service";

const escapeRegex = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * POST /api/leads — Public DXN Natural Life Team Recruitment Form Submission (Phase 6).
 *
 * STRICT COMPLIANCE & SECURITY:
 * 1. Never creates an official DXN membership automatically — creates a CRM lead
 *    for personal follow-up by the DXN Natural Life team.
 * 2. Sponsor membership number is ALWAYS resolved from server-side settings,
 *    never accepted from client payloads or ?ref= URL query parameters.
 * 3. Honeypot (`website`) rejects automated bot spam cleanly.
 */
export const createMembershipLead = async (req: Request, res: Response) => {
  try {
    const body = req.body || {};

    // Honeypot anti-spam trap
    if (typeof body.website === "string" && body.website.trim() !== "") {
      return res.status(400).json({ message: "Submission rejected" });
    }

    if (body.privacyConsent !== true) {
      return res.status(400).json({ message: "Privacy consent is required" });
    }

    const existingMemberRes = normalizeOptionalDxnMemberId(body.existingMembershipNumber);
    if (!existingMemberRes.valid) {
      return res.status(400).json({ message: existingMemberRes.error || "Invalid existing DXN membership number" });
    }

    const settings = await getAdminSiteSettings();
    const trafficSource = normalizeTrafficSource(body.trafficSource);
    const MembershipLeadModel = (Models as any).MembershipLead;

    let savedLead: any = null;
    for (let attempt = 0; attempt < 3 && !savedLead; attempt++) {
      const leadReference = generateReferenceCode("LEAD");
      try {
        savedLead = await MembershipLeadModel.create({
          leadReference,
          firstName: String(body.firstName || "").trim().slice(0, 100),
          lastName: String(body.lastName || "").trim().slice(0, 100),
          country: String(body.country || "").trim().slice(0, 100),
          phone: String(body.phone || "").trim().slice(0, 30),
          preferredContactMethod: body.preferredContactMethod || "whatsapp",
          email: typeof body.email === "string" ? body.email.trim().toLowerCase().slice(0, 160) : "",
          existingMembershipNumber: existingMemberRes.value,
          // Stamped strictly from server-configured sponsor ID
          sponsorMembershipNumber: settings.sponsorMembershipNumber || null,
          message: typeof body.message === "string" ? body.message.trim().slice(0, 2000) : "",
          privacyConsent: true,
          privacyConsentAt: new Date(),
          status: "new",
          trafficSource,
        });
      } catch (err: any) {
        if (err?.code === 11000 && attempt < 2) continue;
        throw err;
      }
    }

    if (!savedLead) {
      return res.status(500).json({ message: "Could not save recruitment request, please retry" });
    }

    // Best-effort Telegram notification to owner — never fails lead persistence
    if (settings.telegramNotificationsEnabled && settings.notifyOnNewLead) {
      try {
        await sendNewMembershipLeadNotification(savedLead);
      } catch (notifyErr: any) {
        console.warn(`[telegram] lead ${savedLead.leadReference} notification error: ${notifyErr?.message ?? "unknown"}`);
      }
    }

    return res.status(201).json({
      success: true,
      message: "Membership recruitment request received",
      data: {
        leadReference: savedLead.leadReference,
        sponsorConfigured: Boolean(settings.sponsorMembershipNumber),
        createdAt: savedLead.createdAt || new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Create membership lead error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

function buildLeadFilter(query: Record<string, any>): { filter: Record<string, any>; error?: string } {
  const filter: Record<string, any> = {};

  if (query.status && query.status !== "all") {
    filter.status = String(query.status).trim();
  }
  if (query.country && query.country !== "all") {
    const rawCountry = String(query.country).trim();
    if (rawCountry.length <= 80) {
      filter.country = { $regex: `^${escapeRegex(rawCountry)}$`, $options: "i" };
    }
  }
  if (query.source && query.source !== "all") {
    filter["trafficSource.source"] = String(query.source).trim().toLowerCase().slice(0, 64);
  }
  if (query.classification === "existing_member") {
    filter.existingMembershipNumber = { $ne: null };
  } else if (query.classification === "registered_team_member") {
    filter.status = "registered_member";
  }

  if (query.dateFrom || query.dateTo) {
    const createdRange: Record<string, Date> = {};
    if (query.dateFrom) {
      const from = new Date(String(query.dateFrom));
      if (!Number.isNaN(from.getTime())) createdRange.$gte = from;
    }
    if (query.dateTo) {
      const to = new Date(String(query.dateTo));
      if (!Number.isNaN(to.getTime())) {
        // Include entire day when YYYY-MM-DD is passed
        if (/^\d{4}-\d{2}-\d{2}$/.test(String(query.dateTo))) {
          to.setUTCHours(23, 59, 59, 999);
        }
        createdRange.$lte = to;
      }
    }
    if (Object.keys(createdRange).length > 0) {
      filter.createdAt = createdRange;
    }
  }

  if (query.search && String(query.search).trim()) {
    const raw = String(query.search).trim();
    if (raw.length > 64) {
      return { filter, error: "Search query too long" };
    }
    const re = { $regex: escapeRegex(raw), $options: "i" };
    filter.$or = [
      { leadReference: re },
      { firstName: re },
      { lastName: re },
      { phone: re },
      { email: re },
      { country: re },
      { existingMembershipNumber: re },
      { officialMembershipNumber: re },
    ];
  }

  return { filter };
}

/** GET /api/admin/leads — Admin CRM list with filters, pipeline counts & segment summary */
export const getAdminLeads = async (req: Request, res: Response) => {
  try {
    const MembershipLeadModel = (Models as any).MembershipLead;
    const CustomerModel = (Models as any).Customer;
    const pageNum = Math.min(Math.max(parseInt(String(req.query.page || "1"), 10) || 1, 1), 1000);
    const limitNum = Math.min(Math.max(parseInt(String(req.query.limit || "25"), 10) || 25, 1), 100);

    const { filter, error } = buildLeadFilter(req.query);
    if (error) {
      return res.status(400).json({ message: error });
    }

    const [leads, total, statusAgg, storeCustomersCount, storeMembersCount] = await Promise.all([
      MembershipLeadModel.find(filter)
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
      MembershipLeadModel.countDocuments(filter),
      MembershipLeadModel.aggregate([
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      CustomerModel && typeof CustomerModel.countDocuments === "function"
        ? CustomerModel.countDocuments({})
        : Promise.resolve(0),
      CustomerModel && typeof CustomerModel.countDocuments === "function"
        ? CustomerModel.countDocuments({ dxnMemberId: { $ne: null } })
        : Promise.resolve(0),
    ]);

    const statusCounts: Record<string, number> = {
      new: 0,
      contacted: 0,
      interested: 0,
      customer: 0,
      registered_member: 0,
      not_interested: 0,
    };
    let totalAllLeads = 0;
    for (const row of statusAgg || []) {
      if (row && row._id && row._id in statusCounts) {
        statusCounts[row._id] = Number(row.count) || 0;
      }
      totalAllLeads += Number(row?.count) || 0;
    }

    const existingMemberLeadsCount = await MembershipLeadModel.countDocuments({
      existingMembershipNumber: { $ne: null },
    });

    res.json({
      success: true,
      data: leads,
      summary: {
        totalAllLeads,
        statusCounts,
        segments: {
          storeCustomers: storeCustomersCount,
          recruitmentLeads: totalAllLeads,
          existingDxnMembers: storeMembersCount + existingMemberLeadsCount,
          registeredTeamMembers: statusCounts.registered_member,
        },
      },
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum) || 1,
      },
    });
  } catch (error) {
    console.error("Get admin leads error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/** GET /api/admin/leads/:id */
export const getAdminLeadById = async (req: Request, res: Response) => {
  try {
    const MembershipLeadModel = (Models as any).MembershipLead;
    const lead = await MembershipLeadModel.findById(req.params.id).lean();
    if (!lead) {
      return res.status(404).json({ message: "Lead not found" });
    }
    res.json({ success: true, data: lead });
  } catch (error: any) {
    if (String(error?.message || "").includes("Cast to ObjectId")) {
      return res.status(400).json({ message: "Invalid lead ID format" });
    }
    console.error("Get admin lead detail error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/** PATCH /api/admin/leads/:id — Update status, official membership ID, follow-up date */
export const updateAdminLead = async (req: AuthRequest, res: Response) => {
  try {
    const MembershipLeadModel = (Models as any).MembershipLead;
    const { id } = req.params;
    const { status, officialMembershipNumber, followUpDate } = req.body || {};

    const update: Record<string, any> = {};
    if (status !== undefined) {
      update.status = status;
      if (status === "registered_member") {
        update.registeredAt = new Date();
      }
    }
    if (officialMembershipNumber !== undefined) {
      const check = normalizeOptionalDxnMemberId(officialMembershipNumber);
      if (!check.valid) {
        return res.status(400).json({ message: check.error || "Invalid official membership number" });
      }
      update.officialMembershipNumber = check.value;
    }
    if (followUpDate !== undefined) {
      update.followUpDate = followUpDate ? new Date(followUpDate) : null;
    }

    const updated = await MembershipLeadModel.findByIdAndUpdate(
      id,
      { $set: update },
      { new: true, runValidators: true }
    );
    if (!updated) {
      return res.status(404).json({ message: "Lead not found" });
    }

    await recordAuditLog(req, {
      action: "lead.update",
      resourceType: "MembershipLead",
      resourceId: String(updated._id),
      summary: `Updated lead ${updated.leadReference} status=${updated.status}`,
    });

    res.json({ success: true, data: updated });
  } catch (error: any) {
    if (String(error?.message || "").includes("Cast to ObjectId")) {
      return res.status(400).json({ message: "Invalid lead ID format" });
    }
    console.error("Update admin lead error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/** POST /api/admin/leads/:id/notes — Add private CRM note */
export const addAdminLeadNote = async (req: AuthRequest, res: Response) => {
  try {
    const MembershipLeadModel = (Models as any).MembershipLead;
    const { id } = req.params;
    const content = String(req.body?.content || "").trim();
    if (!content) {
      return res.status(400).json({ message: "Note content is required" });
    }

    const noteEntry = {
      content: content.slice(0, 2000),
      createdBy: req.user?.userId || req.user?.id,
      authorName: req.user?.email || req.user?.role || "Admin",
      createdAt: new Date(),
    };

    const updated = await MembershipLeadModel.findByIdAndUpdate(
      id,
      { $push: { notes: noteEntry } },
      { new: true }
    );
    if (!updated) {
      return res.status(404).json({ message: "Lead not found" });
    }

    await recordAuditLog(req, {
      action: "lead.add_note",
      resourceType: "MembershipLead",
      resourceId: String(updated._id),
      summary: `Added note to lead ${updated.leadReference}`,
    });

    res.status(201).json({ success: true, data: updated });
  } catch (error: any) {
    if (String(error?.message || "").includes("Cast to ObjectId")) {
      return res.status(400).json({ message: "Invalid lead ID format" });
    }
    console.error("Add lead note error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/** POST /api/admin/leads/:id/communications — Log communication touchpoint */
export const addAdminLeadCommunication = async (req: AuthRequest, res: Response) => {
  try {
    const MembershipLeadModel = (Models as any).MembershipLead;
    const { id } = req.params;
    const { channel, summary, outcome } = req.body || {};

    const commEntry = {
      channel: channel || "phone",
      summary: String(summary || "").trim().slice(0, 2000),
      outcome: String(outcome || "").trim().slice(0, 300),
      createdBy: req.user?.userId || req.user?.id,
      authorName: req.user?.email || req.user?.role || "Admin",
      createdAt: new Date(),
    };

    const updated = await MembershipLeadModel.findByIdAndUpdate(
      id,
      { $push: { communicationHistory: commEntry } },
      { new: true }
    );
    if (!updated) {
      return res.status(404).json({ message: "Lead not found" });
    }

    await recordAuditLog(req, {
      action: "lead.add_communication",
      resourceType: "MembershipLead",
      resourceId: String(updated._id),
      summary: `Logged ${commEntry.channel} communication on ${updated.leadReference}`,
    });

    res.status(201).json({ success: true, data: updated });
  } catch (error: any) {
    if (String(error?.message || "").includes("Cast to ObjectId")) {
      return res.status(400).json({ message: "Invalid lead ID format" });
    }
    console.error("Add lead communication error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/** GET /api/admin/leads/export.csv — Secure CSV export (owner/admin only) */
export const exportAdminLeadsCsv = async (req: AuthRequest, res: Response) => {
  try {
    const MembershipLeadModel = (Models as any).MembershipLead;
    const { filter, error } = buildLeadFilter(req.query);
    if (error) {
      return res.status(400).json({ message: error });
    }

    const leads = await MembershipLeadModel.find(filter)
      .sort({ createdAt: -1 })
      .limit(5000)
      .lean();

    const csv = serializeLeadsToCsv(leads);
    const dateSlug = new Date().toISOString().slice(0, 10);

    await recordAuditLog(req, {
      action: "lead.export_csv",
      resourceType: "MembershipLead",
      summary: `Exported ${leads.length} leads to CSV`,
    });

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="dxn-nadz-leads-${dateSlug}.csv"`);
    res.setHeader("Cache-Control", "no-store");
    res.status(200).send(csv);
  } catch (error) {
    console.error("Export leads CSV error:", error);
    res.status(500).json({ message: "Server error" });
  }
};
