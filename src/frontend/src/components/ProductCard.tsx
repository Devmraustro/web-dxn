import React, { useState } from "react";
import { Link } from "react-router-dom";
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

export const pickProductImage = (product: any): string => {
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

const AddCartIcon = ({ size = 15 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="9" cy="21" r="1" />
    <circle cx="20" cy="21" r="1" />
    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
  </svg>
);

const ProductCard = ({ product, language }: ProductCardProps) => {
  const { t } = useTranslation();
  const { language: lang } = useLanguage();
  const { addItem } = useCart();

  const productTitle = pickProductTitle(product, language);
  const description = pickProductDescription(product, language);
  const productSize = product.size || "";
  const productPrice = Number(product.price) || 0;
  const compareAt = Number(product.compareAtPrice) || 0;
  const imageUrl = pickProductImage(product);
  const productPoints = typeof product.points === "number" ? product.points : 0;
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = !!imageUrl && !imageFailed;
  const inStock = typeof product.stockQuantity !== "number" || product.stockQuantity > 0;
  const detailUrl = product.slug ? `/product/${encodeURIComponent(product.slug)}` : "";

  const hasOffer = compareAt > productPrice && productPrice > 0;
  const offerPercent = hasOffer
    ? Math.round((1 - productPrice / compareAt) * 100)
    : 0;
  const lowStock = inStock && typeof product.stockQuantity === "number" && product.stockQuantity > 0 && product.stockQuantity <= 10;

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
    <article className="dxn-pcard" aria-label={titleText}>
      <Link
        to={detailUrl || "/products"}
        className="dxn-pcard-media"
        aria-label={titleText}
        style={{ display: "block", textDecoration: "none" }}
      >
        {showImage ? (
          <img
            src={imageUrl}
            alt={titleText}
            loading="lazy"
            className={inStock ? "dxn-pcard-img" : "dxn-pcard-img oos"}
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              backgroundColor: "#eef1ee",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#8a9a90",
              fontSize: "2rem",
              fontWeight: 700,
            }}
            aria-hidden="true"
          >
            {titleText.substring(0, 1)}
          </div>
        )}

        {hasOffer && inStock && (
          <span className="dxn-pcard-offer">
            {lang === "ar" ? "خصم" : "-"}
            {offerPercent}%
          </span>
        )}

        {!inStock && (
          <div
            className="d-flex align-items-center justify-content-center position-absolute top-0 bottom-0 start-0 end-0"
            style={{ background: "rgba(0,0,0,0.42)" }}
          >
            <span className="bg-white text-dark px-3 py-1 rounded-pill fw-bold small shadow-lg">
              {lang === "ar" ? "نفذت الكمية" : "Rupture de stock"}
            </span>
          </div>
        )}
      </Link>

      <div className="dxn-pcard-body">
        <span className="dxn-pcard-cat">{product.category || product.sku || "DXN"}</span>

        {productPoints > 0 && (
          <span className="dxn-chip" style={{ backgroundColor: "#f0f4f1", color: "#0b3d1f" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ marginRight: 4 }}>
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 1.18 14.14 6.91 9.27 2 9.27 6.91 2.98 17.77 6.91" stroke="currentColor" strokeWidth="2"/>
            </svg>
            {lang === "ar" ? `نقاط DXN: ${productPoints}` : `Points DXN: ${productPoints}`}
          </span>
        )}

        <h3 className="dxn-pcard-name" style={{ fontSize: "1rem" }}>
          {detailUrl ? (
            <Link to={detailUrl}>{titleText}</Link>
          ) : (
            titleText
          )}
        </h3>

        {description && <p className="dxn-pcard-desc">{description}</p>}

        {productSize && (
          <p className="small mb-2" style={{ color: "#6b7a70" }}>
            {t("productSize")}: {productSize}
          </p>
        )}

        <div className="dxn-pcard-price">
          {hasOffer && <span className="dxn-pcard-price-old">{compareAt.toLocaleString("fr-DZ")} DA</span>}
          <span className="dxn-pcard-price-now">{productPrice.toLocaleString("fr-DZ")} DA</span>
        </div>

        <div
          className={
            !inStock
              ? "dxn-pcard-stock oos"
              : lowStock
                ? "dxn-pcard-stock warn"
                : "dxn-pcard-stock ok"
          }
        >
          {!inStock ? (
            <>{lang === "ar" ? "غير متوفر حالياً" : "Rupture de stock"}</>
          ) : lowStock ? (
            <>{lang === "ar" ? `متبقي ${product.stockQuantity} فقط` : `Plus que ${product.stockQuantity} en stock`}</>
          ) : (
            <>{lang === "ar" ? "متوفر في المخزن" : "En stock"}</>
          )}
        </div>

        <div className="dxn-pcard-cta">
          <button
            type="button"
            className="dxn-btn dxn-btn-gold"
            onClick={handleAddToCart}
            disabled={!inStock}
            aria-label={`${t("addToCart")} — ${titleText}`}
          >
            <AddCartIcon />
            {lang === "ar" ? "أضف إلى السلة" : "Ajouter au panier"}
          </button>
        </div>
      </div>
    </article>
  );
};

export default ProductCard;