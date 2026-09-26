/**
 * In-memory DataAccess fake for unit tests. Lets the AI pipeline be exercised
 * without MongoDB or a live LLM, and lets tests deliberately model out-of-stock
 * items, offers, and shipping rates.
 */
import { DataAccess } from "./retrieval";
import { CatalogItem, OfferInfo, ShippingInfo, StockState } from "./types";
import { matchesQuery, queryTerms, findBestMatches } from "./catalogSearch";

const STORE_URL_BASE = "https://dxnnadz.vercel.app/product";

export class InMemoryDataAccess implements DataAccess {
  catalog: CatalogItem[];
  packs: CatalogItem[];
  offers: OfferInfo[];
  shipping: ShippingInfo;
  perWilaya: Record<string, Partial<ShippingInfo>>;
  storeSettings = { name: "DXN Store", currency: "DA", paymentMethods: ["cod"] };

  constructor(opts?: {
    catalog?: CatalogItem[];
    packs?: CatalogItem[];
    offers?: OfferInfo[];
    shipping?: ShippingInfo;
    perWilaya?: Record<string, Partial<ShippingInfo>>;
  }) {
    this.catalog = opts?.catalog || sampleCatalog;
    this.packs = opts?.packs || samplePacks;
    this.offers = opts?.offers || sampleOffers;
    this.shipping =
      opts?.shipping || { homeDelivery: true, officeDelivery: true, homePriceDA: 600, officePriceDA: 300, shippingConfigured: true };
    this.perWilaya = opts?.perWilaya || {};
  }

  async searchCatalog(query: string): Promise<CatalogItem[]> {
    if (!queryTerms(query).length) return this.catalog;
    const matches = findBestMatches(this.catalog, query, { minScore: 0.3, maxResults: 5 });
    return matches.map(m => m.item);
  }
  async getCatalog(): Promise<CatalogItem[]> {
    return this.catalog;
  }
  async getPacks(): Promise<CatalogItem[]> {
    return this.packs;
  }
  async getActiveOffers(): Promise<OfferInfo[]> {
    return this.offers;
  }
  async getShippingInfo(wilaya?: string): Promise<ShippingInfo> {
    if (wilaya) {
      const key = wilaya.toLowerCase().trim();
      const override = this.perWilaya[key];
      if (override) {
        return { ...this.shipping, ...override, wilaya };
      }
      // The wilaya is known/recognized but no rate is configured for it: never
      // substitute the generic store-wide figure as if it applied to this
      // wilaya. The response renders "حسب الولاية / selon wilaya".
      if (Object.keys(this.perWilaya).length > 0) {
        return {
          ...this.shipping,
          wilaya,
          homePriceDA: undefined,
          officePriceDA: undefined,
        };
      }
    }
    return { ...this.shipping, wilaya: wilaya || this.shipping.wilaya };
  }
  async getFaq(_language: string): Promise<{ question: string; answer: string; language: string }[]> {
    return [];
  }
  async getStoreSettings() {
    return this.storeSettings;
  }
}

export const sampleCatalog: CatalogItem[] = [
  {
    id: "p1",
    slug: "lingzhi-coffee-3in1",
    kind: "product",
    title: "قهوة الريشي 3 في 1",
    priceDA: 1200,
    compareAtPriceDA: 1400,
    available: true,
    stock: 50,
    stockState: "IN_STOCK",
    category: "coffee",
    storeUrl: `${STORE_URL_BASE}/lingzhi-coffee-3in1`,
    points: 10,
  },
  {
    id: "p2",
    slug: "lingzhi-coffee",
    kind: "product",
    title: "قهوة الريشي بودرة",
    priceDA: 1500,
    compareAtPriceDA: 1700,
    available: true,
    stock: 40,
    stockState: "IN_STOCK",
    category: "coffee",
    storeUrl: `${STORE_URL_BASE}/lingzhi-coffee`,
    points: 12,
  },
  {
    id: "p3",
    slug: "black-coffee",
    kind: "product",
    title: "القهوة السوداء",
    priceDA: 1300,
    available: true,
    stock: 35,
    stockState: "IN_STOCK",
    category: "coffee",
    storeUrl: `${STORE_URL_BASE}/black-coffee`,
    points: 8,
  },
  {
    id: "p4",
    slug: "spirulina",
    kind: "product",
    title: "سبيرولينا",
    priceDA: 1800,
    compareAtPriceDA: 2000,
    available: false,
    stock: 0,
    stockState: "OUT_OF_STOCK",
    category: "spirulina",
    storeUrl: `${STORE_URL_BASE}/spirulina`,
    points: 15,
  },
  {
    id: "p5",
    slug: "reishi-gano",
    kind: "product",
    title: "ريشي غانو",
    priceDA: 2200,
    available: true,
    stock: 25,
    stockState: "IN_STOCK",
    category: "energy",
    storeUrl: `${STORE_URL_BASE}/reishi-gano`,
    points: 18,
  },
  {
    id: "p6",
    slug: "cordyceps",
    kind: "product",
    title: "كورديسيبس",
    priceDA: 1900,
    available: true,
    stock: 20,
    stockState: "IN_STOCK",
    category: "sport",
    storeUrl: `${STORE_URL_BASE}/cordyceps`,
    points: 16,
  },
];

export const samplePacks: CatalogItem[] = [
  {
    id: "pack-1",
    slug: "pack-cafe-matin",
    kind: "pack",
    title: "Pack Café Matin",
    priceDA: 2600,
    compareAtPriceDA: 2800,
    available: true,
    stock: 10,
    stockState: "IN_STOCK",
    category: "coffee",
    storeUrl: `${STORE_URL_BASE}/pack-cafe-matin`,
  },
  {
    id: "pack-2",
    slug: "pack-sport",
    kind: "pack",
    title: "Pack Sport",
    priceDA: 3400,
    available: true,
    stock: 8,
    stockState: "IN_STOCK",
    category: "sport",
    storeUrl: `${STORE_URL_BASE}/pack-sport`,
  },
  {
    id: "pack-3",
    slug: "pack-decouverte",
    kind: "pack",
    title: "Pack Découverte",
    priceDA: 4800,
    compareAtPriceDA: 5200,
    available: true,
    stock: 5,
    stockState: "IN_STOCK",
    category: "discovery",
    storeUrl: `${STORE_URL_BASE}/pack-decouverte`,
  },
];

export const sampleOffers: OfferInfo[] = [
  {
    id: "offer-1",
    title: "Promotion pouvoir d'achat",
    type: "percentage",
    value: 5,
    label: "خصم 5%",
  },
  {
    id: "offer-2",
    title: "Café Matin - economisez",
    type: "fixed",
    value: 200,
    label: "خصم 200 دج",
  },
];
