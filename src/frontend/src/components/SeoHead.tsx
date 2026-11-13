import React from "react";
import { Helmet } from "react-helmet-async";
import { useLanguage } from "../context/LanguageContext";

interface SeoHeadProps {
  title: string;
  description?: string;
  canonicalPath?: string;
  ogType?: "website" | "article" | "product";
  ogImage?: string;
  noindex?: boolean;
  jsonLd?: Record<string, unknown> | Array<Record<string, unknown>>;
}

const PUBLIC_ORIGIN = "https://dxnnadz.vercel.app";

const SeoHead: React.FC<SeoHeadProps> = ({
  title,
  description,
  canonicalPath = "/",
  ogType = "website",
  ogImage,
  noindex = false,
  jsonLd,
}) => {
  const { language } = useLanguage();
  const fullTitle = title.includes("DXN NADZ") ? title : `${title} | DXN NADZ`;
  const cleanDesc =
    description ||
    (language === "ar"
      ? "منصة DXN NADZ — منتجات متنوعة، معرفة موثوقة، وفرصة لتطوير نشاطك التجاري."
      : "DXN NADZ — Produits variés, information fiable et opportunité entrepreneuriale.");
  const canonicalUrl = `${PUBLIC_ORIGIN}${canonicalPath.startsWith("/") ? canonicalPath : `/${canonicalPath}`}`;

  return (
    <Helmet>
      <html lang={language === "ar" ? "ar-DZ" : "fr-DZ"} dir={language === "ar" ? "rtl" : "ltr"} />
      <title>{fullTitle}</title>
      <meta name="description" content={cleanDesc} />
      <meta name="robots" content={noindex ? "noindex, nofollow" : "index, follow"} />
      {!noindex && <link rel="canonical" href={canonicalUrl} />}
      <meta property="og:site_name" content="DXN NADZ" />
      <meta property="og:type" content={ogType} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={cleanDesc} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:locale" content={language === "ar" ? "ar_DZ" : "fr_DZ"} />
      {ogImage && <meta property="og:image" content={ogImage} />}
      <meta name="twitter:card" content={ogImage ? "summary_large_image" : "summary"} />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={cleanDesc} />
      {jsonLd && (
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      )}
    </Helmet>
  );
};

export default SeoHead;
