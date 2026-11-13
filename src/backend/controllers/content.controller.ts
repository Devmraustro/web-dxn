import { Request, Response } from "express";
import mongoose from "mongoose";
import * as Models from "../../Database/Models";
import {
  DEFAULT_CONTENT_BLOCKS,
  DEFAULT_EDUCATIONAL_ARTICLES,
  DEFAULT_FAQ_ITEMS,
  MANDATORY_HEALTH_DISCLAIMER_AR,
  MANDATORY_HEALTH_DISCLAIMER_FR,
} from "../data/dxnEducationalContent";
import { sanitizeExternalHttpsUrl } from "../services/siteSettings.service";
import { recordAuditLog } from "../services/audit.service";
import type { AuthRequest } from "../middleware/auth.middleware";

async function safeFindAll(Model: any): Promise<any[]> {
  if (!Model || typeof Model.find !== "function") return [];
  if (mongoose.connection.readyState !== 1 && !Boolean((Model.find as any)._isMockFunction)) {
    return [];
  }
  try {
    const q = Model.find({}).sort({ sortOrder: 1, createdAt: 1 });
    return q && typeof q.lean === "function" ? await q.lean() : await q;
  } catch {
    return [];
  }
}

function mergeArticles(dbArticles: any[], includeDrafts: boolean): any[] {
  const bySlug = new Map<string, any>();
  for (const seed of DEFAULT_EDUCATIONAL_ARTICLES) {
    bySlug.set(seed.slug, { ...seed, _isDefaultSeed: true });
  }
  for (const doc of dbArticles || []) {
    if (doc && doc.slug) {
      bySlug.set(String(doc.slug).toLowerCase(), {
        ...doc,
        ar: {
          ...doc.ar,
          disclaimer: doc.ar?.disclaimer || MANDATORY_HEALTH_DISCLAIMER_AR,
        },
        fr: {
          ...doc.fr,
          disclaimer: doc.fr?.disclaimer || MANDATORY_HEALTH_DISCLAIMER_FR,
        },
        _isDefaultSeed: false,
      });
    }
  }
  return Array.from(bySlug.values())
    .filter((a) => includeDrafts || a.isPublished !== false)
    .sort((a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0));
}

function mergeFaqs(dbFaqs: any[], includeDrafts: boolean): any[] {
  const bySlug = new Map<string, any>();
  for (const seed of DEFAULT_FAQ_ITEMS) {
    bySlug.set(seed.slug, { ...seed, _isDefaultSeed: true });
  }
  for (const doc of dbFaqs || []) {
    if (doc && doc.slug) {
      bySlug.set(String(doc.slug).toLowerCase(), { ...doc, _isDefaultSeed: false });
    }
  }
  return Array.from(bySlug.values())
    .filter((f) => includeDrafts || f.isPublished !== false)
    .sort((a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0));
}

function mergeBlocks(dbBlocks: any[]): Record<string, any> {
  const merged: Record<string, any> = {
    about: { ...DEFAULT_CONTENT_BLOCKS.about },
    founder: { ...DEFAULT_CONTENT_BLOCKS.founder, founderPortraitUrl: "" },
  };
  for (const b of dbBlocks || []) {
    if (!b || !b.key) continue;
    const key = String(b.key).toLowerCase();
    merged[key] = {
      ...(merged[key] || {}),
      ar: { ...(merged[key]?.ar || {}), ...(b.ar || {}) },
      fr: { ...(merged[key]?.fr || {}), ...(b.fr || {}) },
      ...(b.founderPortraitUrl ? { founderPortraitUrl: b.founderPortraitUrl } : {}),
    };
  }
  return merged;
}

export const getPublicContent = async (_req: Request, res: Response) => {
  try {
    const [dbArticles, dbFaqs, dbBlocks] = await Promise.all([
      safeFindAll((Models as any).EducationalArticle),
      safeFindAll((Models as any).FaqItem),
      safeFindAll((Models as any).ContentBlock),
    ]);

    res.json({
      success: true,
      data: {
        articles: mergeArticles(dbArticles, false),
        faqs: mergeFaqs(dbFaqs, false),
        blocks: mergeBlocks(dbBlocks),
      },
    });
  } catch (error) {
    console.error("Get public content error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getPublicArticleBySlug = async (req: Request, res: Response) => {
  try {
    const slug = String(req.params.slug || "").trim().toLowerCase();
    const dbArticles = await safeFindAll((Models as any).EducationalArticle);
    const articles = mergeArticles(dbArticles, false);
    const article = articles.find((a) => a.slug === slug);
    if (!article) {
      return res.status(404).json({ message: "Article not found" });
    }
    res.json({ success: true, data: article });
  } catch (error) {
    console.error("Get public article error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getAdminContent = async (_req: Request, res: Response) => {
  try {
    const [dbArticles, dbFaqs, dbBlocks] = await Promise.all([
      safeFindAll((Models as any).EducationalArticle),
      safeFindAll((Models as any).FaqItem),
      safeFindAll((Models as any).ContentBlock),
    ]);

    res.json({
      success: true,
      data: {
        articles: mergeArticles(dbArticles, true),
        faqs: mergeFaqs(dbFaqs, true),
        blocks: mergeBlocks(dbBlocks),
      },
    });
  } catch (error) {
    console.error("Get admin content error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const upsertAdminArticle = async (req: AuthRequest, res: Response) => {
  try {
    const EducationalArticleModel = (Models as any).EducationalArticle;
    const slug = String(req.params.slug || req.body?.slug || "").trim().toLowerCase();
    const body = req.body || {};

    const updated = await EducationalArticleModel.findOneAndUpdate(
      { slug },
      {
        $set: {
          slug,
          category: body.category || "supplements",
          sortOrder: Number(body.sortOrder) || 0,
          isPublished: body.isPublished !== false,
          readingMinutes: Number(body.readingMinutes) || 4,
          ar: {
            title: String(body.ar?.title || "").trim(),
            summary: String(body.ar?.summary || "").trim(),
            scientificInfo: String(body.ar?.scientificInfo || "").trim(),
            ingredientEvidence: String(body.ar?.ingredientEvidence || "").trim(),
            traditionalUses: String(body.ar?.traditionalUses || "").trim(),
            unprovenClaimsNotice: String(body.ar?.unprovenClaimsNotice || "").trim(),
            usageAndStorage: String(body.ar?.usageAndStorage || "").trim(),
            disclaimer:
              String(body.ar?.disclaimer || "").trim() || MANDATORY_HEALTH_DISCLAIMER_AR,
          },
          fr: {
            title: String(body.fr?.title || "").trim(),
            summary: String(body.fr?.summary || "").trim(),
            scientificInfo: String(body.fr?.scientificInfo || "").trim(),
            ingredientEvidence: String(body.fr?.ingredientEvidence || "").trim(),
            traditionalUses: String(body.fr?.traditionalUses || "").trim(),
            unprovenClaimsNotice: String(body.fr?.unprovenClaimsNotice || "").trim(),
            usageAndStorage: String(body.fr?.usageAndStorage || "").trim(),
            disclaimer:
              String(body.fr?.disclaimer || "").trim() || MANDATORY_HEALTH_DISCLAIMER_FR,
          },
          updatedBy: req.user?.userId || req.user?.id,
        },
      },
      { upsert: true, new: true, runValidators: true }
    );

    await recordAuditLog(req, {
      action: "cms.article_upsert",
      resourceType: "EducationalArticle",
      resourceId: slug,
      summary: `Upserted educational article ${slug}`,
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error("Upsert admin article error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const upsertAdminFaq = async (req: AuthRequest, res: Response) => {
  try {
    const FaqItemModel = (Models as any).FaqItem;
    const slug = String(req.params.slug || req.body?.slug || "").trim().toLowerCase();
    const body = req.body || {};

    const updated = await FaqItemModel.findOneAndUpdate(
      { slug },
      {
        $set: {
          slug,
          category: body.category || "company",
          sortOrder: Number(body.sortOrder) || 0,
          isPublished: body.isPublished !== false,
          ar: {
            question: String(body.ar?.question || "").trim(),
            answer: String(body.ar?.answer || "").trim(),
          },
          fr: {
            question: String(body.fr?.question || "").trim(),
            answer: String(body.fr?.answer || "").trim(),
          },
          updatedBy: req.user?.userId || req.user?.id,
        },
      },
      { upsert: true, new: true, runValidators: true }
    );

    await recordAuditLog(req, {
      action: "cms.faq_upsert",
      resourceType: "FaqItem",
      resourceId: slug,
      summary: `Upserted FAQ item ${slug}`,
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error("Upsert admin FAQ error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const upsertAdminContentBlock = async (req: AuthRequest, res: Response) => {
  try {
    const ContentBlockModel = (Models as any).ContentBlock;
    const key = String(req.params.key || "").trim().toLowerCase();
    if (!["about", "founder", "home", "why_dxn"].includes(key)) {
      return res.status(400).json({ message: "Invalid content block key" });
    }
    const body = req.body || {};
    let safePortrait = "";
    if (typeof body.founderPortraitUrl === "string" && body.founderPortraitUrl.trim()) {
      const rawUrl = body.founderPortraitUrl.trim();
      if (rawUrl.startsWith("/uploads/")) {
        safePortrait = rawUrl.slice(0, 300);
      } else {
        safePortrait = sanitizeExternalHttpsUrl(rawUrl);
      }
    }

    const updated = await ContentBlockModel.findOneAndUpdate(
      { key },
      {
        $set: {
          key,
          ar: body.ar && typeof body.ar === "object" ? body.ar : {},
          fr: body.fr && typeof body.fr === "object" ? body.fr : {},
          founderPortraitUrl: safePortrait,
          updatedBy: req.user?.userId || req.user?.id,
        },
      },
      { upsert: true, new: true }
    );

    await recordAuditLog(req, {
      action: "cms.block_upsert",
      resourceType: "ContentBlock",
      resourceId: key,
      summary: `Updated CMS block ${key}`,
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error("Upsert content block error:", error);
    res.status(500).json({ message: "Server error" });
  }
};
