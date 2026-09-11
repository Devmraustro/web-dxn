import { ALGERIAN_WILAYAS as WILAYAS_DATA } from "../data/algerianWilayas";
import { isPlaceholderProduct } from "../services/placeholderCatalog.service";

// Canonical 58-wilaya list (single source of truth, shared with the shipping
// dataset). Sitemap entries use the romanized name in the query string.
export const ALGERIAN_WILAYAS_LIST = WILAYAS_DATA;

// Keep the historical export name (tests / callers reference it).
export const ALGERIAN_WILAYAS: string[] = WILAYAS_DATA.map((w) => w.name);

/** Pull translatable fields from either representation (merged or array). */
function translationOf(
  product: any,
  language: "ar" | "fr"
): { title?: string; description?: string; metaTitle?: string; metaDescription?: string } | null {
  if (!product) return null;
  // Representation A: API merged translation at top level.
  const merged = product as any;
  if (merged.language === language && (merged.title || merged.metaTitle)) {
    return merged;
  }
  // Representation B: translation array.
  const arr = Array.isArray(product.translations) ? product.translations : null;
  if (arr) {
    return arr.find((t: any) => t.language === language) || arr[0] || null;
  }
  // Legacy nested object shape ({ ar: {...}, fr: {...} }).
  const nested = product.translations;
  if (nested && typeof nested === "object") {
    return nested[language] || nested.ar || nested.fr || null;
  }
  return null;
}

export const getProductMetaTags = (product: any, language: "ar" | "fr") => {
  const translation = translationOf(product, language);
  const title = translation?.metaTitle || translation?.title || product?.title || product?.name || "DXN Product";
  const description =
    translation?.metaDescription || translation?.description || product?.description || "";
  const ogImage = product?.image || "";

  return {
    title,
    description,
    metaTitle: title,
    metaDescription: description,
    ogTitle: title,
    ogDescription: description.substring(0, 200),
    ogImage,
    ogUrl: `/product/${product?.slug || ""}`,
    twitterCard: "summary_large_image",
    twitterTitle: title,
    twitterDescription: description.substring(0, 200),
  };
};

/**
 * Generate sitemap.xml from indexable storefront pages.
 *
 * Wilaya pages are intentionally NOT emitted: no /shipping (or per-wilaya)
 * storefront route exists yet, so those URLs would 404 for crawlers. When such
 * a page is added, iterate ALGERIAN_WILAYAS (canonical dataset, imported
 * above) — never a hand-maintained copy.
 */
export const generateSitemap = (products: any[], urlBase: string = "https://dxn.dz") => {
  const today = new Date().toISOString().split("T")[0];

  const coreEntries = [
    { loc: "/", priority: "1.0", freq: "daily" },
    { loc: "/products", priority: "0.9", freq: "daily" },
  ]
    .map(
      (page) => `    <url>
      <loc>${urlBase}${page.loc}</loc>
      <lastmod>${today}</lastmod>
      <changefreq>${page.freq}</changefreq>
      <priority>${page.priority}</priority>
    </url>`
    )
    .join("\n");

  const productEntries = (products || [])
    .filter((p) => p && p.isActive && p.slug && !isPlaceholderProduct(p))
    .map((product) => {
      const lastmod = product.updatedAt ? new Date(product.updatedAt).toISOString().split("T")[0] : today;
      return `    <url>
      <loc>${urlBase}/product/${encodeURIComponent(product.slug)}</loc>
      <lastmod>${lastmod}</lastmod>
      <changefreq>weekly</changefreq>
      <priority>0.8</priority>
    </url>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${coreEntries}
  ${productEntries}
</urlset>`;
};

/** robots.txt generator (the "/shipping" route is a storefront informational page). */
export const generateRobotsTxt = (sitemapUrl: string = "https://dxn.dz/sitemap.xml") => {
  return `User-agent: *
Allow: /
Disallow: /admin/
Disallow: /admin
Disallow: /api/
Disallow: /meta/
Disallow: /cart
Disallow: /checkout

Sitemap: ${sitemapUrl}
`;
};

const DEFAULT_LANG_META = (dir: "rtl" | "ltr", lang: string, text: string) => ({
  dir,
  lang,
  title: text || "DXN Store",
  description: text || "DXN Store — Algérie",
  viewport: "width=device-width, initial-scale=1",
  "theme-color": "#1a6b33",
});

export const getArabicMetaTags = (text: string) => DEFAULT_LANG_META("rtl", "ar-DZ", text);
export const getFrenchMetaTags = (text: string) => DEFAULT_LANG_META("ltr", "fr-DZ", text);

export const getProductSchema = (product: any, language: "ar" | "fr") => {
  const translation = translationOf(product, language);
  const price = Number(product?.price) || 0;
  const name = translation?.title || product?.title || product?.name || product?.sku || "DXN Product";
  const description = translation?.description || product?.description || "";

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    description,
    sku: product?.sku || "",
    image: product?.image || "",
    brand: { "@type": "Organization", name: "DXN" },
    offers: {
      "@type": "Offer",
      price,
      priceCurrency: "DZD",
      availability: price > 0 ? "InStock" : "OutOfStock",
      url: `/product/${product?.slug || ""}`,
    },
  };
};

export const getCategorySchema = (categoryName: string, productCount: number) => ({
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name: categoryName || "Products",
  description: `${categoryName || "DXN"} products from DXN Store`,
  url: "/products",
  numberOfProducts: productCount || 0,
});

export const getBreadcrumbSchema = (path: string[]) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: (path || []).map((segment, index) => ({
    "@type": "ListItem",
    position: index + 1,
    name: segment,
    item: index === 0 ? "/products" : `/${path.slice(0, index + 1).join("/")}`,
  })),
});
