import React from "react";
import { Button } from "react-bootstrap";
import { useTranslation } from "react-i18next";
import { useCart } from "../context/CartContext";

interface ProductCardProps {
  product: any;
  language: string;
}

const ProductCard = ({ product, language }: ProductCardProps) => {
  const { t } = useTranslation();
  const { addItem } = useCart();
  const productTitle = language === "ar"
    ? product.translations?.find((tr: any) => tr.language === "ar")?.title
    : product.translations?.find((tr: any) => tr.language === "fr")?.title || product.title;
  const productDescription = language === "ar"
    ? product.translations?.find((tr: any) => tr.language === "ar")?.description
    : product.translations?.find((tr: any) => tr.language === "fr")?.description;
  const productSize = product.size || "";
  const productPrice = product.price || 0;

  // Check for promotional price
  const hasPromo = product.promoPrice || product.compareAtPrice;
  const displayPrice = hasPromo
    ? `${product.promoPrice || product.price} DA (${language === "ar" ? "كان" : "était"} ${product.compareAtPrice} DA)`
    : `${productPrice} DA`;

  const handleAddToCart = () => {
    addItem({
      productId: product._id,
      name: productTitle || t("productName", "Product"),
      unitPrice: productPrice,
      quantity: 1,
      totalPrice: productPrice,
    });
  };

  return (
    <article className="product-card" aria-label={productTitle || t("productName", "Product")}>
      <div className="product-image">
        <div
          style={{
            width: "100%",
            height: 200,
            backgroundColor: "#f0f0f0",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#666",
          }}
        >
          {productTitle?.substring(0, 12)}
        </div>
      </div>

      <div className="product-info">
        <h2 className="product-name">{productTitle || t("productName", "Product")}</h2>
        {productSize && <p className="product-size">{t("productSize")}: {productSize}</p>}
        <p className="product-price" aria-label={displayPrice}>{displayPrice}</p>
      </div>

      <div className="product-action">
        <Button
          variant="primary"
          size="sm"
          onClick={handleAddToCart}
          aria-label={t("addToCart")}
          style={{ width: "100%" }}
        >
          {t("addToCart")}
        </Button>
      </div>
    </article>
  );
};

export default ProductCard;