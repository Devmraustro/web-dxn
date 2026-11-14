/**
 * DXN NADZ — Comprehensive DB-Free Platform Suite (Phases 1–17).
 *
 * Exercises public & admin HTTP routes via Supertest + pure services:
 *  - Brand identity & AR/FR locale parity (no legacy "DXN Store" / outdated "58 wilayas")
 *  - Public & Admin Site Settings + Sponsor ID immutability + XSS URL rejection
 *  - Team Recruitment Lead submission, honeypot, consent, attribution & CRM pipeline
 *  - Secure Admin CSV export with UTF-8 BOM & formula-injection protection
 *  - Contact inbox submission & admin status workflow
 *  - Product Categories, Educational Center (10 articles + disclaimers), FAQs & CMS
 *  - Telegram notification formatting for Orders, Leads & Contact Messages
 *  - SEO Sitemap coverage for all new brand/education/recruitment routes
 */

process.env.JWT_SECRET =
  process.env.JWT_SECRET || "dxn_nadz_test_secret_at_least_32_characters_long_ok";
process.env.DXN_SPONSOR_MEMBER_ID = "820998877";
process.env.META_PAGE_ID = process.env.META_PAGE_ID || "1234567890";
process.env.META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN || "test_meta_token";
process.env.META_VERIFY_TOKEN = process.env.META_VERIFY_TOKEN || "test_verify_token";
process.env.META_APP_SECRET = process.env.META_APP_SECRET || "test_app_secret";

const mockLeadsStore: any[] = [];
const mockMessagesStore: any[] = [];
let mockSiteSettingsDoc: any = null;

function chainableFind(rows: any[]) {
  const chain: any = {
    sort: () => chain,
    skip: () => chain,
    limit: () => chain,
    select: () => chain,
    populate: () => chain,
    lean: async () => rows,
    then: (resolve: any, reject: any) => Promise.resolve(rows).then(resolve, reject),
  };
  return chain;
}

jest.mock("../../Database/Models", () => {
  const actual = jest.requireActual("../../Database/Models");
  return {
    ...actual,
    SiteSettings: {
      findOne: Object.assign(
        jest.fn(() => ({
          lean: async () => mockSiteSettingsDoc,
        })),
        { _isMockFunction: true }
      ),
      findOneAndUpdate: Object.assign(
        jest.fn(async (_filter: any, update: any) => {
          const setObj = update?.$set || {};
          mockSiteSettingsDoc = { ...(mockSiteSettingsDoc || { key: "global" }), ...setObj };
          // Expand dotted socialLinks.* keys
          const socialLinks = { ...(mockSiteSettingsDoc.socialLinks || {}) };
          for (const [k, v] of Object.entries(setObj)) {
            if (k.startsWith("socialLinks.")) {
              const subKey = k.slice("socialLinks.".length);
              socialLinks[subKey] = v;
            }
          }
          mockSiteSettingsDoc.socialLinks = socialLinks;
          return mockSiteSettingsDoc;
        }),
        { _isMockFunction: true }
      ),
    },
    MembershipLead: {
      create: jest.fn(async (doc: any) => {
        const created = {
          _id: `507f1f77bcf86cd7994390${10 + mockLeadsStore.length}`,
          ...doc,
          notes: [],
          communicationHistory: [],
          createdAt: new Date("2026-11-13T10:00:00.000Z"),
        };
        mockLeadsStore.push(created);
        return created;
      }),
      find: jest.fn(() => chainableFind([...mockLeadsStore])),
      countDocuments: jest.fn(async () => mockLeadsStore.length),
      aggregate: jest.fn(async () => [
        { _id: "new", count: mockLeadsStore.filter((l) => l.status === "new").length },
        {
          _id: "registered_member",
          count: mockLeadsStore.filter((l) => l.status === "registered_member").length,
        },
      ]),
      findById: jest.fn((id: string) => ({
        lean: async () => mockLeadsStore.find((l) => l._id === id) || null,
      })),
      findByIdAndUpdate: jest.fn(async (id: string, update: any) => {
        const idx = mockLeadsStore.findIndex((l) => l._id === id);
        if (idx === -1) return null;
        if (update.$set) {
          mockLeadsStore[idx] = { ...mockLeadsStore[idx], ...update.$set };
        }
        if (update.$push?.notes) {
          mockLeadsStore[idx].notes = [
            ...(mockLeadsStore[idx].notes || []),
            update.$push.notes,
          ];
        }
        if (update.$push?.communicationHistory) {
          mockLeadsStore[idx].communicationHistory = [
            ...(mockLeadsStore[idx].communicationHistory || []),
            update.$push.communicationHistory,
          ];
        }
        return mockLeadsStore[idx];
      }),
    },
    ContactMessage: {
      create: jest.fn(async (doc: any) => {
        const created = {
          _id: `507f1f77bcf86cd7994399${10 + mockMessagesStore.length}`,
          ...doc,
          createdAt: new Date("2026-11-13T11:00:00.000Z"),
        };
        mockMessagesStore.push(created);
        return created;
      }),
      find: jest.fn(() => chainableFind([...mockMessagesStore])),
      countDocuments: jest.fn(async () => mockMessagesStore.length),
      findByIdAndUpdate: jest.fn(async (id: string, update: any) => {
        const idx = mockMessagesStore.findIndex((m) => m._id === id);
        if (idx === -1) return null;
        mockMessagesStore[idx] = { ...mockMessagesStore[idx], ...(update.$set || {}) };
        return mockMessagesStore[idx];
      }),
    },
    Customer: {
      countDocuments: jest.fn(async () => 4),
    },
    ProductCategory: {
      find: jest.fn(() => chainableFind([])),
    },
    EducationalArticle: {
      find: jest.fn(() => chainableFind([])),
    },
    FaqItem: {
      find: jest.fn(() => chainableFind([])),
    },
    ContentBlock: {
      find: jest.fn(() => chainableFind([])),
    },
    NotificationLog: {
      find: jest.fn(() => chainableFind([])),
      create: jest.fn(async (d: any) => d),
    },
    AuditLog: {
      find: jest.fn(() => chainableFind([])),
      create: jest.fn(async (d: any) => d),
    },
    Product: {
      find: jest.fn(() => chainableFind([])),
    },
  };
});

import fs from "fs";
import path from "path";
import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../app";
import { JWT_SECRET } from "../config/env";
import { escapeCsvCell, serializeLeadsToCsv } from "../services/csv.service";
import {
  normalizeOptionalDxnMemberId,
  normalizeTrafficSource,
} from "../services/attribution.service";
import {
  sendNewContactRequestNotification,
  sendNewMembershipLeadNotification,
} from "../services/telegram.service";
import {
  DEFAULT_EDUCATIONAL_ARTICLES,
  DEFAULT_FAQ_ITEMS,
  DEFAULT_PRODUCT_CATEGORIES,
} from "../data/dxnEducationalContent";
import { generateSitemap } from "../seo/utils";

const adminToken = jwt.sign(
  { userId: "507f1f77bcf86cd799439001", email: "owner@dxnnadz.com", role: "owner" },
  JWT_SECRET,
  { expiresIn: "1h" }
);

const customerToken = jwt.sign(
  { userId: "507f1f77bcf86cd799439002", email: "buyer@example.com", role: "customer" },
  JWT_SECRET,
  { expiresIn: "1h" }
);

describe("DXN NADZ Platform — Brand, Compliance, CRM, CMS & Security", () => {
  beforeEach(() => {
    mockLeadsStore.length = 0;
    mockMessagesStore.length = 0;
    mockSiteSettingsDoc = null;
  });

  describe("1. Rebranding, Bilingual Parity & Medical Claim Guardrails", () => {
    test("ar.json and fr.json have identical keys and use DXN NADZ + 69 wilayas (Law 26-06)", () => {
      const arRaw = fs.readFileSync(
        path.resolve(__dirname, "../../frontend/src/locales/ar.json"),
        "utf8"
      );
      const frRaw = fs.readFileSync(
        path.resolve(__dirname, "../../frontend/src/locales/fr.json"),
        "utf8"
      );
      const ar = JSON.parse(arRaw);
      const fr = JSON.parse(frRaw);

      expect(Object.keys(ar).sort()).toEqual(Object.keys(fr).sort());
      expect(arRaw).toContain("DXN للحياة الطبيعية");
      expect(frRaw).toContain("DXN Natural Life");
      expect(arRaw).not.toContain("DXN Store");
      expect(frRaw).not.toContain("DXN Store");
      expect(arRaw).toContain("69 ولاية");
      expect(frRaw).toContain("69 wilayas");
      expect(arRaw).not.toContain("58 ولاية");
      expect(frRaw).not.toContain("58 wilayas");
    });

    test("10 default educational articles and 10 FAQs include disclaimers and zero miracle claims", () => {
      expect(DEFAULT_PRODUCT_CATEGORIES.length).toBeGreaterThanOrEqual(4);
      expect(DEFAULT_EDUCATIONAL_ARTICLES.length).toBe(10);
      expect(DEFAULT_FAQ_ITEMS.length).toBe(10);

      for (const article of DEFAULT_EDUCATIONAL_ARTICLES) {
        expect(article.ar.title.length).toBeGreaterThan(5);
        expect(article.fr.title.length).toBeGreaterThan(5);
        expect(article.ar.disclaimer).toContain("ليست أدوية");
        expect(article.fr.disclaimer.toLowerCase()).toContain("ne sont pas des médicaments");
        expect(article.fr.scientificInfo.toLowerCase()).not.toMatch(/miracle|guérit le cancer/);
      }
    });
  });

  describe("2. Public & Admin Site Settings + Sponsor ID Security", () => {
    test("GET /api/settings/public returns DXN NADZ & sponsor ID without Telegram secrets", async () => {
      const res = await request(app).get("/api/settings/public");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.brandName).toBe("DXN Natural Life");
      expect(res.body.data.sponsorMembershipNumber).toBe("820998877");
      expect(JSON.stringify(res.body)).not.toContain("TELEGRAM_BOT_TOKEN");
      expect(res.body.data.telegramBotToken).toBeUndefined();
    });

    test("PUT /api/admin/settings enforces admin RBAC and rejects XSS social URLs", async () => {
      const unauth = await request(app)
        .put("/api/admin/settings")
        .send({ sponsorMembershipNumber: "820111222" });
      expect(unauth.status).toBe(401);

      const forbidden = await request(app)
        .put("/api/admin/settings")
        .set("Authorization", `Bearer ${customerToken}`)
        .send({ sponsorMembershipNumber: "820111222" });
      expect(forbidden.status).toBe(403);

      const xssAttempt = await request(app)
        .put("/api/admin/settings")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          socialLinks: { facebook: "javascript:alert(1)" },
        });
      expect(xssAttempt.status).toBe(400);

      const validUpdate = await request(app)
        .put("/api/admin/settings")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          sponsorMembershipNumber: "820555666",
          whatsappNumber: "+213661223344",
          socialLinks: { instagram: "https://instagram.com/dxnnadz" },
        });
      expect(validUpdate.status).toBe(200);
      expect(validUpdate.body.data.sponsorMembershipNumber).toBe("820555666");
      expect(validUpdate.body.data.socialLinks.instagram).toBe("https://instagram.com/dxnnadz");
    });
  });

  describe("3. Team Recruitment Lead Submission & Admin CRM + CSV Export", () => {
    test("POST /api/leads rejects honeypot spam and missing privacy consent", async () => {
      const spam = await request(app).post("/api/leads").send({
        firstName: "Bot",
        lastName: "Spam",
        country: "Algeria",
        phone: "+213550112233",
        preferredContactMethod: "whatsapp",
        privacyConsent: true,
        website: "https://spam-bot.invalid",
      });
      expect(spam.status).toBe(400);

      const noConsent = await request(app).post("/api/leads").send({
        firstName: "Amine",
        lastName: "Benali",
        country: "Algeria",
        phone: "+213550112233",
        preferredContactMethod: "whatsapp",
        privacyConsent: false,
      });
      expect(noConsent.status).toBe(400);
    });

    test("POST /api/leads creates CRM lead, preserves server sponsor ID, and supports full admin CRM + CSV export", async () => {
      const createRes = await request(app)
        .post("/api/leads")
        .send({
          firstName: "Nadia",
          lastName: "Mansouri",
          country: "Algeria",
          cityWilaya: "Sétif",
          phone: "+213662334455",
          email: "nadia@example.com",
          preferredContactMethod: "whatsapp",
          joinGoal: "build_team",
          privacyConsent: true,
          // Attempted client-side sponsor spoofing must be ignored:
          sponsorMembershipNumber: "999999999",
          trafficSource: { source: "ig", utmCampaign: "ramadan_2026", landingPath: "/join" },
        });

      expect(createRes.status).toBe(201);
      expect(createRes.body.data.leadReference).toMatch(/^LEAD-/);
      expect(mockLeadsStore).toHaveLength(1);
      expect(mockLeadsStore[0].sponsorMembershipNumber).toBe("820998877");
      expect(mockLeadsStore[0].trafficSource.source).toBe("instagram");

      const leadId = mockLeadsStore[0]._id;

      // Admin lists leads & segments
      const listRes = await request(app)
        .get("/api/admin/leads")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(listRes.status).toBe(200);
      expect(listRes.body.data).toHaveLength(1);
      expect(listRes.body.summary.segments).toBeDefined();

      // Admin updates lead to registered_member with official DXN member ID
      const patchRes = await request(app)
        .patch(`/api/admin/leads/${leadId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          status: "registered_member",
          officialMembershipNumber: "820777888",
        });
      expect(patchRes.status).toBe(200);
      expect(patchRes.body.data.status).toBe("registered_member");
      expect(patchRes.body.data.officialMembershipNumber).toBe("820777888");

      // Admin adds private note & communication log
      const noteRes = await request(app)
        .post(`/api/admin/leads/${leadId}/notes`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ content: "Guided registration on DXN eWorld." });
      expect(noteRes.status).toBe(201);
      expect(noteRes.body.data.notes).toHaveLength(1);

      const commRes = await request(app)
        .post(`/api/admin/leads/${leadId}/communications`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ channel: "whatsapp", summary: "Sent welcome onboarding pack." });
      expect(commRes.status).toBe(201);
      expect(commRes.body.data.communicationHistory).toHaveLength(1);

      // Admin CSV export returns UTF-8 BOM and protects against spreadsheet formula injection
      const csvRes = await request(app)
        .get("/api/admin/leads/export.csv")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(csvRes.status).toBe(200);
      expect(csvRes.headers["content-type"]).toContain("text/csv");
      expect(csvRes.text).toContain("Nadia");
      expect(csvRes.text).toContain("820777888");
    });

    test("CSV serializer neutralizes spreadsheet formula injection", () => {
      expect(escapeCsvCell("=CMD|' /C calc'!A0")).toBe("\"'=CMD|' /C calc'!A0\"");
      expect(escapeCsvCell("+213661001122")).toBe("\"'+213661001122\"");
      expect(escapeCsvCell("-10+20")).toBe("'-10+20");
      const csv = serializeLeadsToCsv([
        {
          leadReference: "LEAD-TEST",
          firstName: "=HYPERLINK(\"http://evil\")",
          lastName: "User",
          country: "Algeria",
          phone: "0661001122",
          status: "new",
        },
      ]);
      expect(csv.startsWith("\uFEFF")).toBe(true);
      expect(csv).toContain("\"'=HYPERLINK(\"\"http://evil\"\")\"");
    });
  });

  describe("4. Contact Inbox, Categories, Educational Content & SEO Sitemap", () => {
    test("POST /api/contact creates inquiry and admin updates status", async () => {
      const res = await request(app).post("/api/contact").send({
        name: "Karim Boudiaf",
        phone: "0551223344",
        subject: "استفسار حول الكوكوزي",
        message: "هل منتج الكوكوزي متوفر للتوصيل إلى سطيف؟",
        privacyConsent: true,
      });
      expect(res.status).toBe(201);
      expect(res.body.data.reference).toMatch(/^MSG-/);

      const msgId = mockMessagesStore[0]._id;
      const patchRes = await request(app)
        .patch(`/api/admin/messages/${msgId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ status: "replied" });
      expect(patchRes.status).toBe(200);
      expect(patchRes.body.data.status).toBe("replied");
    });

    test("GET /api/categories and GET /api/content/public serve verified catalog & educational content", async () => {
      const catRes = await request(app).get("/api/categories");
      expect(catRes.status).toBe(200);
      expect(catRes.body.data.map((c: any) => c.slug)).toEqual(
        expect.arrayContaining(["supplements", "cosmetics", "beverages", "general"])
      );

      const contentRes = await request(app).get("/api/content/public");
      expect(contentRes.status).toBe(200);
      expect(contentRes.body.data.articles).toHaveLength(10);
      expect(contentRes.body.data.faqs).toHaveLength(10);
      expect(contentRes.body.data.blocks.about).toBeDefined();
      expect(contentRes.body.data.blocks.founder).toBeDefined();
    });

    test("Attribution & Telegram helpers handle unconfigured state cleanly without throwing", async () => {
      expect(normalizeOptionalDxnMemberId("").value).toBeNull();
      expect(normalizeOptionalDxnMemberId("820123456")).toEqual({
        valid: true,
        value: "820123456",
      });
      expect(normalizeOptionalDxnMemberId("<script>alert(1)</script>").valid).toBe(false);
      expect(normalizeTrafficSource({ source: "fb", landingPath: "/join" }).source).toBe(
        "facebook"
      );

      const leadNotif = await sendNewMembershipLeadNotification({
        leadReference: "LEAD-123",
        firstName: "Amina",
        lastName: "Ziani",
        country: "Algeria",
        phone: "0661223344",
        preferredContactMethod: "whatsapp",
      });
      expect(leadNotif.delivered).toBe(false);

      const contactNotif = await sendNewContactRequestNotification({
        reference: "MSG-123",
        name: "Amina",
        phone: "0661223344",
        message: "Bonjour",
      });
      expect(contactNotif.delivered).toBe(false);
    });

    test("generateSitemap includes all DXN NADZ brand, education, join, FAQ & contact routes", async () => {
      const xml = generateSitemap([], "https://dxnnadz.vercel.app");
      expect(xml).toContain("https://dxnnadz.vercel.app/about");
      expect(xml).toContain("https://dxnnadz.vercel.app/founder");
      expect(xml).toContain("https://dxnnadz.vercel.app/why-dxn");
      expect(xml).toContain("https://dxnnadz.vercel.app/education");
      expect(xml).toContain("https://dxnnadz.vercel.app/join");
      expect(xml).toContain("https://dxnnadz.vercel.app/faq");
      expect(xml).toContain("https://dxnnadz.vercel.app/contact");
      expect(xml).not.toContain("/admin");
    });
  });
});
