import React, { useEffect, useState, useCallback } from "react";
import { useLanguage } from "../context/LanguageContext";
import { useCart } from "../context/CartContext";
import { CatalogEntry } from "../utils/cartReconcile";
import { pickProductTitle } from "../components/ProductCard";
import { Container, Row, Col, Button } from "react-bootstrap";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";

const CartPage = () => {
  const { language } = useLanguage();
  const {
    liveItems,
    items,
    removeItem,
    increaseQuantity,
    decreaseQuantity,
    subtotal,
    total,
    reconcile,
  } = useCart();
  const navigate = useNavigate();
  const t = (ar: string, fr: string) => (language === "ar" ? ar : fr);

  const [catalogFailed, setCatalogFailed] = useState(false);

  const fetchAndReconcile = useCallback(async () => {
    try {
      const [productsRes, packsRes] = await Promise.all([
        axios.get(`/api/products?language=${language}`, { timeout: 8000 }),
        axios.get("/api/packs", { timeout: 8000 }),
      ]);

      const products = new Map<string, CatalogEntry>();
      const productList: any[] = Array.isArray(productsRes.data?.data) ? productsRes.data.data : [];
      for (const p of productList) {
        products.set(String(p._id), {
          id: String(p._id),
          price: Number(p.price) || 0,
          stockQuantity: Number(p.stockQuantity) || 0,
          name: pickProductTitle(p, language) || p.sku || "Product",
        });
      }

      const packs = new Map<string, CatalogEntry>();
      const packList: any[] = Array.isArray(packsRes.data?.data) ? packsRes.data.data : [];
      for (const p of packList) {
        packs.set(String(p._id), {
          id: String(p._id),
          price: Number(p.price) || 0,
          stockQuantity: 1,
          name: p.name || "Pack",
        });
      }

      setCatalogFailed(false);
      reconcile(products, packs, true);
    } catch (err) {
      // Network failure: never wipe/mark a real cart invalid on a transient
      // error — the backend remains the final authority at order time.
      console.error("Cart reconcile error:", err);
      setCatalogFailed(true);
      reconcile(undefined, undefined, false);
    }
  }, [language, reconcile]);

  useEffect(() => {
    if (items.length === 0) return;
    void fetchAndReconcile();
  }, [items.length, fetchAndReconcile]);

  const empty = items.length === 0;
  const thereAreInvalid = liveItems.some((i) => i.status !== "ok");
  const allInvalid = liveItems.length > 0 && liveItems.every((i) => i.status !== "ok");

  const reasonText = (item: { status: string; reasons: string[] }): string => {
    if (item.status === "stale") {
      return t(
        "هذا المنتج لم يعد متوفراً — تم حذفه أو إيقافه من المتجر.",
        "Ce produit n'est plus disponible — il a été retiré ou désactivé de la boutique."
      );
    }
    if (item.reasons.includes("quantity-exceeds-stock")) {
      return t(
        "الكمية المطلوبة تتجاوز المخزون المتاح.",
        "La quantité demandée dépasse le stock disponible."
      );
    }
    return t("هذا المنتج نفذت كمية مخزونه حالياً.", "Ce produit est en rupture de stock.");
  };

  return (
    <Container className="mt-4 mb-5">
      <h2 className="dxn-section-title h3 mb-4">{t("سلة التسوق", "Panier")}</h2>

      {catalogFailed && liveItems.length > 0 && (
        <div className="dxn-feedback-error p-3 mb-3" role="status" aria-live="polite">
          {t(
            "تعذر التحقق من توفر المنتجات حالياً. يُرجى المحاولة مجدداً قبل إتمام الطلب.",
            "Impossible de vérifier la disponibilité des produits pour le moment. Réessayez avant de passer commande."
          )}
        </div>
      )}

      {empty ? (
        <div className="dxn-empty">
          <div className="dxn-empty-icon">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="9" cy="21" r="1" />
              <circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
            </svg>
          </div>
          <p className="mb-3">{t("لا توجد منتجات في السلة", "Votre panier est vide")}</p>
          <Link to="/products" className="dxn-btn dxn-btn-primary">
            {t("تصفح المنتجات", "Parcourir les produits")}
          </Link>
        </div>
      ) : allInvalid ? (
        <div className="dxn-feedback-error p-3">
          <strong>{t("المنتجات غير متوفرة حالياً", "Produits indisponibles")}</strong>
          <div className="mt-2">
            {t(
              "جميع المنتجات في سلتك غير متوفرة. احذفها أو اختر منتجات أخرى.",
              "Tous les articles de votre panier sont indisponibles. Supprimez-les ou choisissez d'autres produits."
            )}
          </div>
          <div className="mt-3">
            <Link to="/products" className="dxn-btn dxn-btn-primary">
              {t("الذهاب إلى المنتجات", "Aller aux produits")}
            </Link>
          </div>
        </div>
      ) : (
        <Row className="g-4">
          {/* Items */}
          <Col lg={8}>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <span className="fw-semibold" style={{ color: "#3f4d45" }}>
                {t("محتويات السلة", "Contenu du panier")} ({items.length})
              </span>
            </div>

            {liveItems.map((item, index) => {
              const invalid = item.status !== "ok";
              return (
                <div
                  key={index}
                  className={"dxn-cart-item " + (invalid ? "invalid" : "")}
                  aria-invalid={invalid || undefined}
                >
                  <div
                    className="dxn-cart-thumb d-flex align-items-center justify-content-center"
                    style={{ backgroundColor: "#eaf4ec", fontSize: "1.3rem", fontWeight: 800, color: "#1a5d3a" }}
                    aria-hidden="true"
                  >
                    {(item.name || "?").charAt(0)}
                  </div>

                  <div className="dxn-cart-main">
                    <div className="dxn-cart-name">{item.name}</div>
                    {invalid ? (
                      <span className="text-danger small d-block mt-1" role="status">
                        {reasonText(item)}
                      </span>
                    ) : (
                      <span className="small" style={{ color: "#6b7a70" }}>
                        {item.unitPrice.toLocaleString("fr-DZ")} DA / {t("وحدة", "unité")}
                      </span>
                    )}
                    {invalid && (
                      <span className="text-muted small d-block">{t("الكمية", "Quantité")}: {item.quantity}</span>
                    )}
                  </div>

                  {!invalid && (
                    <div className="dxn-qty">
                      <button
                        type="button"
                        onClick={() => decreaseQuantity(index)}
                        aria-label={t("تقليل الكمية", "Diminuer la quantité")}
                      >
                        −
                      </button>
                      <span className="dxn-qty-value" aria-live="polite">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => increaseQuantity(index)}
                        aria-label={t("زيادة الكمية", "Augmenter la quantité")}
                      >
                        +
                      </button>
                    </div>
                  )}

                  <div className="text-end" style={{ minWidth: 110 }}>
                    <div className="fw-bold" style={{ color: "#0b3d1f" }}>
                      {(item.totalPrice || 0).toLocaleString("fr-DZ")} DA
                    </div>
                  </div>

                  <button
                    type="button"
                    className="dxn-cart-remove"
                    onClick={() => removeItem(index)}
                    aria-label={t("إزالة المنتج من السلة", "Retirer du panier")}
                    title={t("حذف", "Retirer")}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              );
            })}

            {thereAreInvalid && (
              <div className="dxn-feedback-error p-3 mt-2" role="status" aria-live="polite">
                {t(
                  "تحتوي سلتك على منتجات غير متوفرة. احذفها قبل متابعة الدفع.",
                  "Votre panier contient des articles indisponibles. Retirez-les avant de continuer."
                )}
              </div>
            )}
          </Col>

          {/* Summary */}
          <Col lg={4}>
            <div className="dxn-summary dxn-anim-fade-up">
              <div className="dxn-summary-title">{t("ملخص الطلب", "Récapitulatif")}</div>
              <div className="dxn-summary-row">
                <span>{t("المجموع الفرعي", "Sous-total")}</span>
                <strong>{subtotal.toLocaleString("fr-DZ")} DA</strong>
              </div>
              <div className="dxn-summary-row">
                <span>{t("الشحن", "Frais de port")}</span>
                <strong>{t("يُحسب عند إتمام الطلب", "Calculé à la commande")}</strong>
              </div>
              <div className="dxn-summary-total">
                <span>{t("المجموع", "Total")}</span>
                <span>{total.toLocaleString("fr-DZ")} DA</span>
              </div>
              <Button
                variant="primary"
                size="lg"
                className="w-100 mt-3 dxn-btn dxn-btn-gold"
                onClick={() => navigate("/checkout")}
                disabled={empty || allInvalid || thereAreInvalid}
                aria-disabled={empty || allInvalid || thereAreInvalid}
              >
                {thereAreInvalid
                  ? t("احذف المنتجات غير المتوفرة أولاً", "Retirez d'abord les articles indisponibles")
                  : t("متابعة الدفع", "Procéder au paiement")}
              </Button>
              <p className="dxn-subnote text-center mt-3 mb-0">
                {t("الدفع عند الاستلام — لا حاجة لدفع مسبق", "Paiement à la livraison — aucun prépaiement requis")}
              </p>
            </div>
          </Col>
        </Row>
      )}
    </Container>
  );
};

export default CartPage;