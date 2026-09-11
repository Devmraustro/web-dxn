import { Request, Response } from "express";
import { Product, ProductTranslation } from "../../Database/Models";
import { withPublicReadScope, isPlaceholderProduct } from "../services/placeholderCatalog.service";

/** Escape regex metacharacters before a user string is used as a $regex source. */
const escapeRegex = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const TRANSLATION_CONTENT_KEYS = ["language", "title", "description", "size", "metaTitle", "metaDescription"] as const;

/** Extract only the translatable content fields (never _id / productId). */
function pickTranslationContent(doc: any): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of TRANSLATION_CONTENT_KEYS) {
    if (doc?.[key] !== undefined) out[key] = doc[key];
  }
  return out;
}

/**
 * Enrich a product document for API consumers:
 *  - `translations`: sanitized array of every available translation (used by
 *    the storefront language selector). Only content keys are exposed.
 *  - top-level merged content: title/description/size/meta* of the effective
 *    translation (requested language, otherwise the first available one
 *    ordered ar→fr). Top-level fields keep legacy consumers working and make
 *    the payload self-describing for any single-language request.
 * Never leaks _id / productId / timestamps of the translation documents.
 */
async function enrichWithTranslation(product: any, language?: "ar" | "fr") {
  const base = { ...product };
  const docs = await ProductTranslation.find({ productId: product._id })
    .sort({ language: 1 }) // ar before fr for a stable default
    .lean();

  if (docs.length === 0) {
    return base;
  }

  const translations = docs.map((d: any) => pickTranslationContent(d));
  let effective = language ? docs.find((d: any) => d.language === language) : undefined;
  if (!effective) {
    effective = language
      ? undefined
      : docs[0];
  }

  const merged = effective ? pickTranslationContent(effective) : {};
  return { ...base, ...merged, translations };
}

// GET /api/products - List active products (sold-out products remain visible
// with stockQuantity so customers can see stock status).
export const getProducts = async (req: Request, res: Response) => {
  try {
    const { language, featured, search } = req.query;
    const lang = language === "ar" || language === "fr" ? language : undefined;

    const query: any = { isActive: true };
    if (featured) query.isFeatured = featured === "true";

    if (search && String(search).trim()) {
      const raw = String(search).trim();
      // ReDoS / runaway-regex guard: never feed attacker input longer than the
      // cap directly into a $regex, and always escape metacharacters first so
      // the payload is matched as literal text.
      if (raw.length > 64) {
        return res.status(400).json({ message: "Search query too long" });
      }
      const escaped = escapeRegex(raw);

      // Search the translatable fields (title/description) which live in the
      // ProductTranslation collection, plus sku/slug on the product itself.
      const translationMatches = await ProductTranslation.find({
        $or: [
          { title: { $regex: escaped, $options: "i" } },
          { description: { $regex: escaped, $options: "i" } },
        ],
      })
        .select("productId")
        .lean();
      const ids = translationMatches.map((t: any) => t.productId);
      query.$or = [
        { sku: { $regex: escaped, $options: "i" } },
        { slug: { $regex: escaped, $options: "i" } },
        ...(ids.length ? [{ _id: { $in: ids } }] : []),
      ];
    }

    const products = await Product.find(
      withPublicReadScope(req, {
        ...query,
        isFeatured: query.isFeatured,
        sortOrder: query.sortOrder,
      })
    )
      .sort({ sortOrder: 1, createdAt: -1 })
      .lean();

    const enriched = await Promise.all(products.map((p: any) => enrichWithTranslation(p, lang)));

    res.json({ success: true, count: enriched.length, data: enriched });
  } catch (error) {
    console.error("Get products error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/** Shared handler for product lookup by _id or by slug. */
async function findProduct(selector: { _id?: any; slug?: string }, lang?: "ar" | "fr") {
  const product = await Product.findOne({ ...selector, isActive: true }).lean();
  if (!product) return null;
  if (isPlaceholderProduct(product)) return null;
  const enriched = await enrichWithTranslation(product, lang);
  return enriched;
}

// GET /api/products/slug/:slug - public detail by slug (SEO/SPA route)
export const getProductBySlug = async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const language = req.query.language;
    const lang = language === "ar" || language === "fr" ? language : undefined;

    const product = await findProduct({ slug: String(slug) }, lang);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    res.json({ success: true, data: product });
  } catch (error) {
    console.error("Get product by slug error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// GET /api/products/:id - product detail (public)
export const getProductById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const language = req.query.language;
    const lang = language === "ar" || language === "fr" ? language : undefined;

    const product = await findProduct({ _id: id }, lang);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    res.json({ success: true, data: product });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("Cast to ObjectId")) {
      return res.status(400).json({ message: "Invalid product ID format" });
    }
    console.error("Get product by ID error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

async function ensureTranslations(productId: any, translations?: { ar?: any; fr?: any }) {
  if (!translations) return;
  for (const lang of ["ar", "fr"] as const) {
    const t = translations[lang];
    if (!t || typeof t !== "object") continue;
    // Only write the fields the payload actually carries: a partial update
    // (e.g. title-only) must never blank the other translated content.
    const patch: Record<string, unknown> = {};
    if (t.title !== undefined) patch.title = String(t.title);
    if (t.description !== undefined) patch.description = String(t.description);
    if (t.size !== undefined) patch.size = String(t.size);
    await ProductTranslation.findOneAndUpdate(
      { productId, language: lang },
      { $set: patch },
      { upsert: true, runValidators: true }
    );
  }
}

// POST /api/products - Create product (admin)
export const createProduct = async (req: Request, res: Response) => {
  try {
    const { sku, slug, translations, ...productData } = req.body;

    const existingSku = await Product.findOne({ sku });
    if (existingSku) {
      return res.status(400).json({ message: "SKU already exists" });
    }
    const existingSlug = await Product.findOne({ slug });
    if (existingSlug) {
      return res.status(400).json({ message: "Slug already exists" });
    }

    const product = await Product.create({ sku, slug, ...productData });

    await ensureTranslations(product._id, translations);

    res.status(201).json({ success: true, data: product });
  } catch (error) {
    console.error("Create product error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// PUT /api/products/:id - Update product (admin)
export const updateProduct = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { sku, slug, translations, ...updateData } = req.body;

    if (sku) {
      const existingSku = await Product.findOne({ sku, _id: { $ne: id } });
      if (existingSku) {
        return res.status(400).json({ message: "SKU already exists" });
      }
    }
    if (slug) {
      const existingSlug = await Product.findOne({ slug, _id: { $ne: id } });
      if (existingSlug) {
        return res.status(400).json({ message: "Slug already exists" });
      }
    }

    const update: Record<string, unknown> = { ...updateData };
    if (sku !== undefined) update.sku = sku;
    if (slug !== undefined) update.slug = slug;

    const product = await Product.findByIdAndUpdate(id, update, {
      new: true,
      runValidators: true,
    });
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    await ensureTranslations(product._id, translations);

    res.json({ success: true, data: product });
  } catch (error) {
    console.error("Update product error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// DELETE /api/products/:id - Soft delete
export const deleteProduct = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const product = await Product.findByIdAndUpdate(id, { isActive: false }, { new: true });
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    res.json({ success: true, data: product });
  } catch (error) {
    console.error("Delete product error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// PATCH /api/products/:id/toggle-featured
export const toggleFeatured = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    product.isFeatured = !product.isFeatured;
    await product.save();
    res.json({ success: true, data: product });
  } catch (error) {
    console.error("Toggle featured error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export default {
  getProducts,
  getProductById,
  getProductBySlug,
  createProduct,
  updateProduct,
  deleteProduct,
  toggleFeatured,
};
