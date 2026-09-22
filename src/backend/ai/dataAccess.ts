/**
 * Production DataAccess adapter wired to the real mongoose models.
 *
 * IMPORTANT: This module imports the mongoose models, which requires a live
 * MongoDB connection at runtime. Tests use the InMemoryDataAccess fake instead
 * so the AI pipeline can be verified without a database or credentials.
 */
import { DataAccess } from "./core/retrieval";
import { CatalogItem, OfferInfo, ShippingInfo, StockState } from "./core/types";
import { matchesQuery, queryTerms, findBestMatches } from "./core/catalogSearch";
import { escapeRegex } from "../../utils/regex";
import { isPlaceholderProduct, isPlaceholderPack, isPlaceholderOffer } from "../services/placeholderCatalog.service";

// Dynamic require so unit tests (which never call this module) do not need a
// server connection or the models to be loaded.
let MODELS: any = null;
function models(): any {
  if (!MODELS) {
    MODELS = require("../../Database/Models");
  }
  return MODELS;
}

function deriveStockState(stockQuantity: number | undefined): StockState {
  if (stockQuantity === undefined || stockQuantity === null) return "UNKNOWN";
  if (stockQuantity > 0) return "IN_STOCK";
  return "OUT_OF_STOCK";
}

function toCatalogItem(raw: any, kind: "product" | "pack", storeUrlBase: string, title: string): CatalogItem {
  const stockQty = raw.stockQuantity;
  return {
    id: String(raw._id),
    slug: raw.slug || "",
    kind,
    title,
    priceDA: raw.price ?? raw.priceDA ?? 0,
    compareAtPriceDA: raw.compareAtPrice,
    available: (stockQty ?? 0) > 0,
    stock: stockQty,
    stockState: deriveStockState(stockQty),
    category: raw.category,
    storeUrl: `${storeUrlBase}/${raw.slug || ""}`,
    points: typeof raw.points === "number" ? raw.points : 0,
  };
}

export class MongooseDataAccess implements DataAccess {
  private storeUrlBase: string;
  constructor(storeUrlBase = process.env.STORE_URL_BASE || "https://dxn.dz/product") {
    this.storeUrlBase = storeUrlBase;
  }

  async getCatalog(): Promise<CatalogItem[]> {
    const m = models();
    const products = await m.Product.find({ isActive: true }).lean();
    const translations = await m.ProductTranslation.find({
      language: { $in: ["ar", "fr"] },
    })
      .select("productId language title")
      .lean();
    const visibleProducts = products.filter((p: any) => !isPlaceholderProduct(p));
    const titleById: Record<string, string> = {};
    for (const t of translations) {
      if (!titleById[t.productId] && t.title) titleById[t.productId] = t.title;
    }
    return visibleProducts.map((p: any) =>
      toCatalogItem(p, "product", this.storeUrlBase, titleById[String(p._id)] || p.sku || "Produit")
    );
  }

  async getPacks(): Promise<CatalogItem[]> {
    const m = models();
    const packs = await m.Pack.find({ isActive: true }).lean();
    return packs
      .filter((p: any) => !isPlaceholderPack(p))
      .map((p: any) => toCatalogItem(p, "pack", this.storeUrlBase, p.name || "Pack"));
  }

  async searchCatalog(query: string): Promise<CatalogItem[]> {
    const catalog = await this.getCatalog();
    if (!queryTerms(query).length) return catalog.slice(0, 5);
    // Use findBestMatches for better scoring and alias support
    const matches = findBestMatches(catalog, query, { minScore: 0.3, maxResults: 5 });
    return matches.map(m => m.item);
  }

  async getActiveOffers(): Promise<OfferInfo[]> {
    const m = models();
    const now = new Date();
    const offers = await m.Offer.find({
      isActive: true,
      $or: [{ startDate: { $lte: now } }, { startDate: null }, { startDate: { $exists: false } }],
      $and: [
        {
          $or: [{ endDate: { $gte: now } }, { endDate: null }, { endDate: { $exists: false } }],
        },
      ],
    }).lean();
    return offers
      .filter((o: any) => !isPlaceholderOffer(o))
      .map((o: any) => ({
        id: String(o._id),
        title: o.title,
        type: o.type,
        value: o.value,
      }));
  }

  async getShippingInfo(wilaya?: string): Promise<ShippingInfo> {
    const m = models();
    const info: ShippingInfo = {
      wilaya,
      homeDelivery: true,
      officeDelivery: true,
      homePriceDA: undefined,
      officePriceDA: undefined,
      shippingConfigured: false,
    };
    let foundRate = false;
    if (wilaya) {
      // Exact canonical-spelling match on any of the three spellings; the
      // input is regex-escaped so chat text can never inject regex/ReDoS.
      const esc = escapeRegex(wilaya);
      const wil = await m.Wilaya.findOne({
        $or: [
          { name: { $regex: `^${esc}$`, $options: "i" } },
          { nameFr: { $regex: `^${esc}$`, $options: "i" } },
          { nameAr: { $regex: `^${esc}$` } },
        ],
        isActive: true,
      }).lean();
      if (wil) {
        const rates = await m.ShippingRate.find({ wilayaId: wil._id, isActive: true }).lean();
        for (const r of rates as any[]) {
          if (r.deliveryMethod === "home" && typeof r.price === "number" && r.price >= 0) {
            info.homePriceDA = r.price;
            info.shippingConfigured = true;
            foundRate = true;
          }
          if (r.deliveryMethod === "office" && typeof r.price === "number" && r.price >= 0) {
            info.officePriceDA = r.price;
            info.shippingConfigured = true;
            foundRate = true;
          }
        }
      }
    } else {
      const home = await m.ShippingRate.findOne({ deliveryMethod: "home", isActive: true }).lean();
      const office = await m.ShippingRate.findOne({ deliveryMethod: "office", isActive: true }).lean();
      if (home && typeof home.price === "number" && home.price >= 0) {
        info.homePriceDA = home.price;
        info.shippingConfigured = true;
        foundRate = true;
      }
      if (office && typeof office.price === "number" && office.price >= 0) {
        info.officePriceDA = office.price;
        info.shippingConfigured = true;
        foundRate = true;
      }
    }
    // If no rate found in DB, check env vars but ONLY if explicitly set (not defaulting to 0)
    if (!foundRate) {
      const homeEnv = process.env.DEFAULT_SHIPPING_HOME;
      const officeEnv = process.env.DEFAULT_SHIPPING_OFFICE;
      // Only use env if explicitly set to a non-negative number
      if (homeEnv !== undefined && homeEnv !== "") {
        const n = Number(homeEnv);
        if (Number.isFinite(n) && n >= 0) {
          info.homePriceDA = n;
          info.shippingConfigured = true;
        }
      }
      if (officeEnv !== undefined && officeEnv !== "") {
        const n = Number(officeEnv);
        if (Number.isFinite(n) && n >= 0) {
          info.officePriceDA = n;
          info.shippingConfigured = true;
        }
      }
    }
    return info;
  }

  async getFaq(language: string) {
    const m = models();
    const kb = await m.AIKnowledge.find({ language, isActive: true }).lean();
    return (kb as any[]).map((k) => ({ question: k.question, answer: k.answer, language: k.language }));
  }

  async getStoreSettings() {
    return {
      name: "DXN Store",
      currency: "DA",
      paymentMethods: ["cod"],
    };
  }
}
