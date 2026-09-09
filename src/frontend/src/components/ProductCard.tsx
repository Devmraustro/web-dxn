import React from "react";
import { Link } from "react-router-dom";
import { Button } from "react-bootstrap";
import { useTranslation } from "react-i18next";
import { useCart } from "../context/CartContext";
import { useLanguage } from "../context/LanguageContext";

interface ProductCardProps {
  product: any;
  language: string;
}

/**
 * Resolve the best localized title for a product from any API shape we serve:
 *  - enriched payload: top-level merged title/description + translations[]
 *  - legacy shape: translations as { ar: {...}, fr: {...} }
 */
export const pickProductTitle = (product: any, language: string): string => {
  if (!product) return "";
  const want = language === "ar" ? "ar" : "fr";
  const arr = Array.isArray(product.translations) ? product.translations : null;
  if (arr) {
    const found = arr.find((tr: any) => tr.language === want);
    if (found?.title) return found.title;
    const anyLang = arr.find((tr: any) => tr.title);
    if (anyLang?.title) return anyLang.title;
  }
  const nested = product.translations;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    if (nested[want]?.title) return nested[want].title;
    if (nested[want]?.name) return nested[want].name;
    if (nested.ar?.title) return nested.ar.title;
    if (nested.fr?.title) return nested.fr.title;
  }
  return product.title || product.name || "";
};

const pickProductImage = (product: any): string => {
  if (product?.image) return product.image;
  if (Array.isArray(product?.images) && product.images.length > 0) return product.images[0];
  return "";
};

/**
 * Resolve the best localized description from any API shape (same strategy as
 * pickProductTitle). Unlike the previous inline code, this never calls
 * `.find()` on a legacy object-shaped translations map and always falls back to
 * a top-level/other-language description instead of silently returning nothing.
 */
export const pickProductDescription = (product: any, language: string): string => {
  if (!product) return "";
  const want = language === "ar" ? "ar" : "fr";
  const arr = Array.isArray(product.translations) ? product.translations : null;
  if (arr) {
    const found = arr.find((tr: any) => tr.language === want && tr.description);
    if (found?.description) return found.description;
    const anyLang = arr.find((tr: any) => tr.description);
    if (anyLang?.description) return anyLang.description;
  }
  const nested = product.translations;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    if (nested[want]?.description) return nested[want].description;
    if (nested.ar?.description) return nested.ar.description;
    if (nested.fr?.description) return nested.fr.description;
  }
  return product.description || product.name || "";
};

const ProductCard = ({ product, language }: ProductCardProps) => {
  const { t } = useTranslation();
  const { language: lang } = useLanguage();
  const { addItem } = useCart();

  const productTitle = pickProductTitle(product, language);
  const description = pickProductDescription(product, language);
  const productSize = product.size || "";
  const productPrice = product.price || 0;
  const imageUrl = pickProductImage(product);
  const inStock = typeof product.stockQuantity !== "number" || product.stockQuantity > 0;
  const detailUrl = product.slug ? `/product/${encodeURIComponent(product.slug)}` : "";

  const handleAddToCart = () => {
    addItem({
      productId: product._id,
      name: productTitle || t("productName", "Product"),
      unitPrice: productPrice,
      quantity: 1,
      totalPrice: productPrice,
    });
  };

  const titleText = productTitle || t("productName", "Product");

  return (
    <article
      className="product-card"
      aria-label={titleText}
      style={{ display: "flex", flexDirection: "column", height: "100%" }}
    >
      <Link
        to={detailUrl || "/products"}
        className="product-image"
        aria-label={titleText}
        style={{ display: "block" }}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={titleText}
            loading="lazy"
            style={{ width: "100%", height: 200, objectFit: "cover" }}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: 200,
              backgroundColor: "#f0f0f0",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#8a8a8a",
              fontSize: "2rem",
              fontWeight: 700,
            }}
            aria-hidden="true"
          >
            {titleText.substring(0, 1)}
          </div>
        )}
      </Link>

      <div className="product-info">
        <h2 className="product-name">
          {detailUrl ? (
            <Link to={detailUrl} className="product-name-link">
              {titleText}
            </Link>
          ) : (
            titleText
          )}
        </h2>
        {description && (
          <p className="product-description" style={{ color: "#666", fontSize: "0.85rem" }}>
            {description.length > 110 ? `${description.slice(0, 110)}…` : description}
          </p>
        )}
        {productSize && (
          <p className="product-size">
            {t("productSize")}: {productSize}
          </p>
        )}
        <p className="product-price" aria-label={`${productPrice} DA`}>
          {productPrice} DA
        </p>
        {!inStock && (
          <p className="text-danger small" role="status">
            {lang === "ar" ? "غير متوفر حالياً" : "Rupture de stock"}
          </p>
        )}
      </div>

      <div className="product-action">
        <Button
          variant="primary"
          size="sm"
          onClick={handleAddToCart}
          disabled={!inStock}
          aria-label={t("addToCart")}
          style={{ width: "100%" }}
        >
          {lang === "ar" ? "أضف إلى السلة" : "Ajouter au panier"}
        </Button>
      </div>
    </article>
  );
};

export default ProductCard;
