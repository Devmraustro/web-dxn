/**
 * In-memory DataAccess fake for unit tests. Lets the AI pipeline be exercised
 * without MongoDB or a live LLM, and lets tests deliberately model out-of-stock
 * items, offers, and shipping rates.
 */
import { DataAccess } from "./retrieval";
import { CatalogItem, OfferInfo, ShippingInfo } from "./types";
import { matchesQuery, queryTerms } from "./catalogSearch";

export class InMemoryDataAccess implements DataAccess {
  catalog: CatalogItem[];
  packs: CatalogItem[];
  offers: OfferInfo[];
  shipping: ShippingInfo;
  storeSettings = { name: "DXN Store", currency: "DA", paymentMethods: ["cod"] };

  constructor(opts?: {
    catalog?: CatalogItem[];
    packs?: CatalogItem[];
    offers?: OfferInfo[];
    shipping?: ShippingInfo;
  }) {
    this.catalog = opts?.catalog || [];
    this.packs = opts?.packs || [];
    this.offers = opts?.offers || [];
    this.shipping =
      opts?.shipping || { homeDelivery: true, officeDelivery: true, homePriceDA: 600, officePriceDA: 300 };
  }

  async searchCatalog(query: string): Promise<CatalogItem[]> {
    if (!queryTerms(query).length) return this.catalog;
    return this.catalog.filter((it) =>
      matchesQuery([it.title, it.slug, it.category || ""], query)
    );
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
    slug: "cafe-lingzhi",
    kind: "product",
    title: "Café Lingzhi",
    priceDA: 3200,
    compareAtPriceDA: 3600,
    available: true,
    stock: 15,
    category: "coffee",
    storeUrl: "https://dxn.dz/cafe-lingzhi",
  },
  {
    id: "p2",
    slug: "the-g3",
    kind: "product",
    title: "Thé G3",
    priceDA: 4500,
    available: true,
    stock: 8,
    category: "tea",
    storeUrl: "https://dxn.dz/the-g3",
  },
  {
    id: "p3",
    slug: "spiruline",
    kind: "product",
    title: "Spiruline",
    priceDA: 5500,
    available: false,
    stock: 0,
    category: "spirulina",
    storeUrl: "https://dxn.dz/spiruline",
  },
];
