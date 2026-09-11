import { Request, Response } from "express";
import {
  PLACEHOLDER_PRODUCT_IDENTIFIERS,
  PLACEHOLDER_PACK_IDENTIFIERS,
  PLACEHOLDER_OFFER_IDENTIFIERS,
  isPlaceholderProduct,
  isPlaceholderPack,
  isPlaceholderOffer,
} from "../../services/placeholderCatalog.service";
import { Product, ProductTranslation, Pack, Offer } from "../../../Database/Models";

/**
 * Admin-only catalogue listing (owner/admin).
 *
 * The public /api/products, /api/packs and /api/offers endpoints hide placeholder
 * seed records (and respect active/inactive state). This endpoint is mounted
 * under the existing admin router which already applies `authenticate` +
 * `adminOnly`, so it is ONLY reachable by an authenticated owner/admin — it
 * never weakens authentication. It lets the owner/admin see and manage the FULL
 * catalogue, including placeholder seed records and inactive records, so those
 * records can be renamed, deactivated or cleaned up through the existing admin
 * write endpoints.
 */
export const getAdminCatalog = async (req: Request, res: Response) => {
  try {
    const [products, packs, offers] = await Promise.all([
      Product.find({}).sort({ sortOrder: 1, createdAt: -1 }).select("-__v").lean(),
      Pack.find({}).sort({ sortOrder: 1, createdAt: -1 }).select("-__v").lean(),
      Offer.find({}).sort({ sortOrder: 1, createdAt: -1 }).select("-__v").lean(),
    ]);

    const productIds = products.map((p: any) => String(p._id));
    const translations = await ProductTranslation.find({
      productId: { $in: productIds },
    })
      .select("productId language title")
      .sort({ language: 1 })
      .lean();

    const titleByProduct = new Map<string, Record<string, string>>();
    for (const t of translations as any[]) {
      const pid = String(t.productId);
      if (!titleByProduct.has(pid)) titleByProduct.set(pid, {});
      titleByProduct.get(pid)![t.language] = t.title;
    }

    const flagged = { products: 0, packs: 0, offers: 0 };
    const mark = (kind: "products" | "packs" | "offers", isPlaceholder: boolean) => {
      if (isPlaceholder) flagged[kind] += 1;
    };

    const productList = products.map((p: any) => {
      const isPh =
        isPlaceholderProduct(p) ||
        PLACEHOLDER_PRODUCT_IDENTIFIERS.has(p.sku) ||
        PLACEHOLDER_PRODUCT_IDENTIFIERS.has(p.slug);
      mark("products", isPh);
      return { ...p, _isPlaceholderSeed: isPh, _titles: titleByProduct.get(String(p._id)) || {} };
    });
    const packList = packs.map((p: any) => {
      const isPh = isPlaceholderPack(p) || PLACEHOLDER_PACK_IDENTIFIERS.has(p.slug);
      mark("packs", isPh);
      return { ...p, _isPlaceholderSeed: isPh };
    });
    const offerList = offers.map((o: any) => {
      const isPh = isPlaceholderOffer(o) || PLACEHOLDER_OFFER_IDENTIFIERS.has(o.slug);
      mark("offers", isPh);
      return { ...o, _isPlaceholderSeed: isPh };
    });

    res.json({
      success: true,
      data: { products: productList, packs: packList, offers: offerList },
      meta: flagged,
    });
  } catch (error) {
    console.error("Get admin catalog error:", error);
    res.status(500).json({ message: "Server error" });
  }
};