import { Request, Response } from "express";
import mongoose from "mongoose";
import * as Models from "../../Database/Models";
import { DEFAULT_PRODUCT_CATEGORIES } from "../data/dxnEducationalContent";
import { recordAuditLog } from "../services/audit.service";

export const getPublicCategories = async (_req: Request, res: Response) => {
  try {
    const ProductCategoryModel = (Models as any).ProductCategory;
    let dbCategories: any[] = [];
    const canQuery =
      ProductCategoryModel &&
      typeof ProductCategoryModel.find === "function" &&
      (mongoose.connection.readyState === 1 ||
        Boolean((ProductCategoryModel.find as any)._isMockFunction));

    if (canQuery) {
      try {
        const q = ProductCategoryModel.find({ isActive: true }).sort({ sortOrder: 1, createdAt: 1 });
        dbCategories = q && typeof q.lean === "function" ? await q.lean() : await q;
      } catch {
        dbCategories = [];
      }
    }

    const bySlug = new Map<string, any>();
    for (const seed of DEFAULT_PRODUCT_CATEGORIES) {
      bySlug.set(seed.slug, { ...seed });
    }
    for (const cat of dbCategories || []) {
      if (cat && cat.slug) {
        bySlug.set(String(cat.slug).toLowerCase(), cat);
      }
    }

    const merged = Array.from(bySlug.values())
      .filter((c) => c.isActive !== false)
      .sort((a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0));

    res.json({ success: true, count: merged.length, data: merged });
  } catch (error) {
    console.error("Get categories error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getAdminCategories = async (_req: Request, res: Response) => {
  try {
    const ProductCategoryModel = (Models as any).ProductCategory;
    const dbCategories =
      ProductCategoryModel && typeof ProductCategoryModel.find === "function"
        ? await ProductCategoryModel.find({}).sort({ sortOrder: 1, createdAt: 1 }).lean()
        : [];

    const bySlug = new Map<string, any>();
    for (const seed of DEFAULT_PRODUCT_CATEGORIES) {
      bySlug.set(seed.slug, { ...seed, _isDefaultSeed: true });
    }
    for (const cat of dbCategories || []) {
      bySlug.set(String(cat.slug).toLowerCase(), { ...cat, _isDefaultSeed: false });
    }

    const list = Array.from(bySlug.values()).sort(
      (a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0)
    );

    res.json({ success: true, data: list });
  } catch (error) {
    console.error("Get admin categories error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const upsertCategory = async (req: Request, res: Response) => {
  try {
    const ProductCategoryModel = (Models as any).ProductCategory;
    const { slug, nameAr, nameFr, descriptionAr, descriptionFr, sortOrder, isActive } = req.body;
    const normalizedSlug = String(slug || "").trim().toLowerCase();

    const updated = await ProductCategoryModel.findOneAndUpdate(
      { slug: normalizedSlug },
      {
        $set: {
          slug: normalizedSlug,
          nameAr: String(nameAr || "").trim(),
          nameFr: String(nameFr || "").trim(),
          descriptionAr: String(descriptionAr || "").trim(),
          descriptionFr: String(descriptionFr || "").trim(),
          ...(sortOrder !== undefined ? { sortOrder: Number(sortOrder) || 0 } : {}),
          ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {}),
        },
      },
      { upsert: true, new: true, runValidators: true }
    );

    await recordAuditLog(req, {
      action: "category.upsert",
      resourceType: "ProductCategory",
      resourceId: normalizedSlug,
      summary: `Upserted category ${normalizedSlug}`,
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error("Upsert category error:", error);
    res.status(500).json({ message: "Server error" });
  }
};
