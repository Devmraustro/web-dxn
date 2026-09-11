/**
 * STARTER catalog used by the idempotent seed (services/bootstrap.service.ts).
 *
 * IMPORTANT — READ BEFORE GO-LIVE:
 *  - PRICES and STOCK in this file are PLACEHOLDERS. They are meant to give a
 *    brand-new database something to render so the storefront is usable while
 *    the owner configures real data. Confirm every price against the official
 *    DXN price list and set stockQuantity before accepting the first order;
 *    the buyer is always charged the server-side price shown here.
 *  - This data is seeded ONLY when the matching sku/slug does not exist yet
 *    (never overwrites admin edits, never re-prices an existing product).
 *  - Descriptions are commercial text only — NO medical/therapeutic claims
 *    (the AI assistant is separately guard-railed to never make them either).
 */

export interface SeedProduct {
  sku: string;
  slug: string;
  price: number;
  compareAtPrice?: number;
  stockQuantity: number;
  isFeatured?: boolean;
  sortOrder?: number;
  size?: string;
  ar: {
    title: string;
    description: string;
    metaTitle?: string;
    metaDescription?: string;
  };
  fr: {
    title: string;
    description: string;
    metaTitle?: string;
    metaDescription?: string;
  };
}

export interface SeedPack {
  name: string;
  slug: string;
  price: number;
  compareAtPrice?: number;
  isFeatured?: boolean;
  sortOrder?: number;
  contents: { sku: string; quantity: number }[];
}

export interface SeedOffer {
  title: string;
  slug: string;
  type: "percentage" | "fixed" | "promotional";
  value: number;
  isFeatured?: boolean;
  sortOrder?: number;
  targetSlug?: string; // product or pack slug; resolved to ObjectId at seed time
}

export const STARTER_PRODUCTS: SeedProduct[] = [
  {
    sku: "DXN-LC3",
    slug: "lingzhi-coffee-3in1",
    price: 1200,
    compareAtPrice: 1400,
    stockQuantity: 50,
    isFeatured: true,
    sortOrder: 1,
    size: "10 sachets",
    ar: {
      title: "قهوة الريشي 3 في 1",
      description:
        "قهوة الريشي 3 في 1 تجمع بين نكهة القهوة الغنية ومستخلص فطر الريشي (الجانوديرما). مشروب دافئ مناسب لبداية اليوم.",
      metaTitle: "قهوة الريشي 3 في 1 | DXN",
      metaDescription: "قهوة الريشي 3 في 1 — استمتع بنكهة القهوة مع مستخلص فطر الريشي.",
    },
    fr: {
      title: "Café Lingzhi 3-en-1",
      description:
        "Le café Lingzhi 3-en-1 associe le goût riche du café à l'extrait de champignon Reishi (Ganoderme). Une boisson chaude idéale pour commencer la journée.",
      metaTitle: "Café Lingzhi 3-en-1 | DXN",
      metaDescription: "Café Lingzhi 3-en-1 — le goût du café avec l'extrait de Reishi.",
    },
  },
  {
    sku: "DXN-LC",
    slug: "lingzhi-coffee",
    price: 1500,
    compareAtPrice: 1700,
    stockQuantity: 40,
    isFeatured: true,
    sortOrder: 2,
    size: "20 sachets",
    ar: {
      title: "قهوة الريشي بودرة",
      description:
        "قهوة الريشي الكلاسيكية بنكهة كاملة ومستخلص فطر الريشي. حجم اقتصادي يناسب الاستعمال اليومي.",
      metaTitle: "قهوة الريشي | DXN",
      metaDescription: "قهوة الريشي الكلاسيكية — النكهة الكاملة ومستخلص الريشي.",
    },
    fr: {
      title: "Café Lingzhi",
      description:
        "Le café Lingzhi classique au goût complet avec extrait de Reishi. Format économique pour une utilisation quotidienne.",
      metaTitle: "Café Lingzhi | DXN",
      metaDescription: "Le café Lingzhi classique au goût complet et à l'extrait de Reishi.",
    },
  },
  {
    sku: "DXN-BC",
    slug: "black-coffee",
    price: 1300,
    stockQuantity: 35,
    sortOrder: 3,
    size: "30 sachets",
    ar: {
      title: "القهوة السوداء",
      description:
        "القهوة السوداء بنكهة غنية وقوية بدون سكر مضاف. الخيار المفضل لعشاق القهوة الأصيلة.",
      metaTitle: "القهوة السوداء | DXN",
      metaDescription: "القهوة السوداء — نكهة غنية وقوية بدون سكر مضاف.",
    },
    fr: {
      title: "Café Noir",
      description:
        "Café noir au goût riche et corsé, sans sucre ajouté. Le choix préféré des amateurs de café authentique.",
      metaTitle: "Café Noir | DXN",
      metaDescription: "Café noir au goût riche et corsé, sans sucre ajouté.",
    },
  },
  {
    sku: "DXN-SPI",
    slug: "spirulina",
    price: 1800,
    compareAtPrice: 2000,
    stockQuantity: 45,
    isFeatured: true,
    sortOrder: 4,
    size: "120 tablets",
    ar: {
      title: "سبيرولينا",
      description:
        "أقراص السبيرولينا — غذاء خارق غني بالبروتين والفيتامينات والمعادن. مكمل غذائي عملي لنمط حياة نشط.",
      metaTitle: "سبيرولينا | DXN",
      metaDescription: "أقراص السبيرولينا — مكمل غذائي غني بالعناصر المغذية.",
    },
    fr: {
      title: "Spiruline",
      description:
        "Comprimés de spiruline — un super-aliment riche en protéines, vitamines et minéraux. Un complément pratique pour un mode de vie actif.",
      metaTitle: "Spiruline | DXN",
      metaDescription: "Comprimés de spiruline — un complément alimentaire riche en nutriments.",
    },
  },
  {
    sku: "DXN-RG",
    slug: "reishi-gano",
    price: 2200,
    stockQuantity: 25,
    sortOrder: 5,
    size: "60 capsules",
    ar: {
      title: "ريشي غانو",
      description:
        "كبسولات ريشي غانو المصنوعة من فطر الريشي. مكمل غذائي بسيط لمن يريد دعم صحته العامة.",
      metaTitle: "ريشي غانو | DXN",
      metaDescription: "كبسولات ريشي غانو — مكمل غذائي بسيط لصحة عامة أفضل.",
    },
    fr: {
      title: "Reishi Gano",
      description:
        "Capsules Reishi Gano à base de champignon Reishi. Un complément simple pour soutenir la santé générale.",
      metaTitle: "Reishi Gano | DXN",
      metaDescription: "Capsules Reishi Gano — un complément simple pour la santé.",
    },
  },
  {
    sku: "DXN-GL",
    slug: "ganocelium",
    price: 2100,
    stockQuantity: 25,
    sortOrder: 6,
    size: "30 capsules",
    ar: {
      title: "غانوسيليوم",
      description:
        "كبسولات غانوسيليوم بمزيج فطري متوازن. مكمل غذائي لروتينك اليومي.",
      metaTitle: "غانوسيليوم | DXN",
      metaDescription: "كبسولات غانوسيليوم — مكمل غذائي لروتينك اليومي.",
    },
    fr: {
      title: "Ganocelium",
      description:
        "Capsules Ganocelium à base d'un mélange fongique équilibré. Un complément alimentaire pour votre routine quotidienne.",
      metaTitle: "Ganocelium | DXN",
      metaDescription: "Capsules Ganocelium — un complément pour votre routine quotidienne.",
    },
  },
  {
    sku: "DXN-COR",
    slug: "cordyceps",
    price: 1900,
    stockQuantity: 20,
    sortOrder: 7,
    size: "60 capsules",
    ar: {
      title: "كورديسيبس",
      description:
        "كبسولات كورديسيبس — مكمل غذائي يضيف قيمة لروتينك اليومي بنكهة بسيطة وسهلة الاستهلاك.",
      metaTitle: "كورديسيبس | DXN",
      metaDescription: "كبسولات كورديسيبس — مكمل غذائي سهل الاستهلاك.",
    },
    fr: {
      title: "Cordyceps",
      description:
        "Capsules de Cordyceps — un complément alimentaire qui ajoute de la valeur à votre routine quotidienne.",
      metaTitle: "Cordyceps | DXN",
      metaDescription: "Capsules de Cordyceps — un complément alimentaire facile à prendre.",
    },
  },
  {
    sku: "DXN-MOR",
    slug: "morinzhi",
    price: 1700,
    stockQuantity: 30,
    sortOrder: 8,
    size: "60 capsules",
    ar: {
      title: "مورينزي",
      description:
        "كبسولات مورينزي بمزيج من المكونات النباتية. مكمل غذائي مدروس لروتينك اليومي.",
      metaTitle: "مورينزي | DXN",
      metaDescription: "كبسولات مورينزي — مكمل غذائي مدروس لروتينك اليومي.",
    },
    fr: {
      title: "Morinzhi",
      description:
        "Capsules Morinzhi à base d'un mélange d'ingrédients végétaux. Un complément alimentaire réfléchi pour votre routine quotidienne.",
      metaTitle: "Morinzhi | DXN",
      metaDescription: "Capsules Morinzhi — un complément alimentaire réfléchi.",
    },
  },
];

export const STARTER_PACKS: SeedPack[] = [
  {
    name: "Pack Café Matin",
    slug: "pack-cafe-matin",
    price: 2600,
    compareAtPrice: 2800,
    isFeatured: true,
    sortOrder: 1,
    contents: [
      { sku: "DXN-LC3", quantity: 1 },
      { sku: "DXN-SPI", quantity: 1 },
    ],
  },
  {
    name: "Pack Découverte",
    slug: "pack-decouverte",
    price: 4800,
    compareAtPrice: 5200,
    isFeatured: true,
    sortOrder: 2,
    contents: [
      { sku: "DXN-LC", quantity: 1 },
      { sku: "DXN-SPI", quantity: 1 },
      { sku: "DXN-RG", quantity: 1 },
    ],
  },
  {
    name: "Pack Sport",
    slug: "pack-sport",
    price: 3400,
    sortOrder: 3,
    contents: [
      { sku: "DXN-COR", quantity: 1 },
      { sku: "DXN-SPI", quantity: 1 },
    ],
  },
];

export const STARTER_OFFERS: SeedOffer[] = [
  {
    title: "Café Matin - economisez",
    slug: "cafe-matin-economisez",
    type: "promotional",
    value: 200,
    sortOrder: 1,
    targetSlug: "pack-cafe-matin",
  },
  {
    title: "Promotion pouvoir d'achat",
    slug: "promotion-pouvoir-achat",
    type: "percentage",
    value: 5,
    sortOrder: 2,
    targetSlug: "lingzhi-coffee-3in1",
  },
];