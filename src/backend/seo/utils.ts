import type { Request, Response } from "express";
import * as fs from "fs";
import * as path from "path";

// Algerian wilayas list (complete list)
export const ALGERIAN_WILAYAS = [
  "Algiers", "Oran", "Constantine", "Annaba", "Setif", "Medea", "Blida", 
  "Biskra", "Tlemcen", "Skikda", "Sidi Bel Abbès", "Mila", "Adrar", 
  "In Salah", "Tamanrasset", "Ghardaïa", "Relizane", "El Oued", "Timra",
  "Touggourt", "Djanet", "Naama", "Guelma", "M'Sila"
];

// Arabic product meta tags
export const getProductMetaTags = (product: any, language: "ar" | "fr") => {
  const translation = language === "ar"
    ? product.translations?.find((t: any) => t.language === "ar")
    : product.translations?.find((t: any) => t.language === "fr") || product.translations?.[0];
  
  const title = translation?.metaTitle || translation?.title || "DXN Product";
  const description = translation?.metaDescription || translation?.description || "";
  
  // Build Open Graph tags
  const ogTitle = title;
  const ogDescription = description.substring(0, 200);
  const ogImage = product.image || "";
  const ogUrl = `/product/${product.slug}`;
  
  // Build Twitter cards
  const twitterCard = "summary_large_image";
  const twitterTitle = title;
  const twitterDescription = description.substring(0, 200);
  
  return {
    title,
    description,
    metaTitle: title,
    metaDescription: description,
    ogTitle,
    ogDescription,
    ogImage,
    ogUrl,
    twitterCard,
    twitterTitle,
    twitterDescription,
  };
};

// Generate sitemap XML
export const generateSitemap = (products: any[], urlBase: string = "https://dxn.dz") => {
  const entries = products
    .filter((p) => p.isActive)
    .map((product) => {
      const lastmod = product.updatedAt 
        ? product.updatedAt.toISOString().split("T")[0] 
        : new Date().toISOString().split("T")[0];
      
      const productUrl = `${urlBase}/product/${product.slug}`;
      
      return `
    <url>
      <loc>${productUrl}</loc>
      <lastmod>${lastmod}</lastmod>
      <changefreq>weekly</changefreq>
      <priority>0.8</priority>
    </url>
      `;
    })
    .join("\n");
  
  const wilayasEntries = ALGERIAN_WILAYAS.map((wilaya) => {
    return `
    <url>
      <loc>${urlBase}/shipping?wilaya=${wilaya}</loc>
      <lastmod>${new Date().toISOString().split("T")[0]}</lastmod>
      <changefreq>monthly</changefreq>
      <priority>0.3</priority>
    </url>
      `;
  });
  
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${entries}
  ${wilayasEntries}
</urlset>`;
  
  return sitemap;
};

// Generate robots.txt content
export const generateRobotsTxt = (sitemapUrl: string = "https://dxn.dz/sitemap.xml") => {
  return `
User-agent: *
Allow: /

Sitemap: ${sitemapUrl}
  
Disallow: /admin/
Disallow: /api/
Disallow: /cart/
  Disallow: /checkout/
`;
};

// Generate Arabic meta tags for RTL support
export const getArabicMetaTags = (text: string) => ({
  dir: "rtl",
  lang: "ar-DZ",
  title: text || "DXN",
  description: text || "DXN",
  "viewport": "width=device-width, initial-scale=1",
  "theme-color": "#2D5A27", // DXN green
});

// Generate French meta tags for LTR support
export const getFrenchMetaTags = (text: string) => ({
  dir: "ltr",
  lang: "fr-DZ",
  title: text || "DXN",
  description: text || "DXN",
  "viewport": "width=device-width, initial-scale=1",
  "theme-color": "#2D5A27", // DXN green
});

// Schema.org Product structured data
export const getProductSchema = (product: any, language: "ar" | "fr") => {
  const translation = language === "ar"
    ? product.translations?.find((t: any) => t.language === "ar")
    : product.translations?.find((t: any) => t.language === "fr") || product.translations?.[0];
  
  const price = product.price || 0;
  const currency = "DZD";
  
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": translation?.title || product.name || "DXN Product",
    "description": translation?.description || product.description || "",
    "sku": product.sku || "",
    "image": product.image || "",
    "brand": {
      "@type": "Organization",
      "name": "DXN"
    },
    "offers": {
      "@type": "Offer",
      "price": price,
      "priceCurrency": currency,
      "availability": price > 0 ? "InStock" : "OutOfStock",
    },
    "keywords": product.tags?.join(", ") || "DXN, supplements, health",
  };
};

// Category structured data
export const getCategorySchema = (categoryName: string, productCount: number) => ({
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  "name": categoryName,
  "description": `${categoryName} products from DXN Store`,
  "url": "/products",
  "numberOfProducts": productCount,
});

// breadcrumb schema
export const getBreadcrumbSchema = (path: string[]) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": path.map((segment, index) => ({
    "@type": "ListItem",
    "position": index + 1,
    "name": segment,
    "item": index === 0 ? "/products" : `/${path.slice(0, index + 1).join("/")}`,
  })),
});