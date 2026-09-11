import React, { useEffect, useState, useCallback } from "react";
import { useLanguage } from "../context/LanguageContext";
import { useCart } from "../context/CartContext";
import { CatalogEntry } from "../utils/cartReconcile";
import { pickProductTitle } from "../components/ProductCard";
import { Container, Table, Button, Alert } from "react-bootstrap";
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
    <>
      <Container>
        <h2 className="mb-4">{t("سلة التسوق", "Panier")}</h2>

        {catalogFailed && liveItems.length > 0 && (
          <Alert variant="warning" role="status" aria-live="polite">
            {t(
              "تعذر التحقق من توفر المنتجات حالياً. يُرجى المحاولة مجدداً قبل إتمام الطلب.",
              "Impossible de vérifier la disponibilité des produits pour le moment. Réessayez avant de passer commande."
            )}
          </Alert>
        )}

        {empty ? (
          <Alert variant="info">
            {t("لا توجد منتجات في السلة", "Votre panier est vide")}{" "}
            <Link to="/products">{t("تصفح المنتجات", "Parcourir les produits")}</Link>
          </Alert>
        ) : allInvalid ? (
          <Alert variant="warning" role="status" aria-live="polite">
            <strong>{t("المنتجات غير متوفرة حالياً", "Produits indisponibles")}</strong>
            <div className="mt-2">
              {t(
                "جميع المنتجات في سلتك غير متوفرة. احذفها أو اختر منتجات أخرى.",
                "Tous les articles de votre panier sont indisponibles. Supprimez-les ou choisissez d'autres produits."
              )}
            </div>
            <div className="mt-3">
              <Link to="/products" className="btn btn-primary">
                {t("الذهاب إلى المنتجات", "Aller aux produits")}
              </Link>
            </div>
          </Alert>
        ) : (
          <Container>
            <Table striped bordered hover>
              <caption style={{ captionSide: "top" }}>
                {t("محتويات السلة", "Contenu du panier")}
              </caption>
              <thead>
                <tr>
                  <th>{t("المنتج", "Produit")}</th>
                  <th>{t("الكمية", "Quantité")}</th>
                  <th>{t("السعر", "Prix")}</th>
                  <th>{t("المجموع", "Total")}</th>
                  <th aria-label={t("إزالة", "Supprimer")}></th>
                </tr>
              </thead>
              <tbody>
                {liveItems.map((item, index) => {
                  const invalid = item.status !== "ok";
                  return (
                    <tr key={index} className={invalid ? "table-warning" : undefined} aria-invalid={invalid || undefined}>
                      <td>
                        <div>{item.name}</div>
                        {invalid && (
                          <span className="text-danger small d-block mt-1" role="status">
                            ⚠ {reasonText(item)}
                          </span>
                        )}
                      </td>
                      <td>
                        {!invalid && (
                          <>
                            <Button
                              variant="link"
                              size="sm"
                              onClick={() => decreaseQuantity(index)}
                              aria-label={t("تقليل الكمية", "Diminuer la quantité")}
                              style={{ padding: 0 }}
                            >
                              -
                            </Button>
                            <span aria-live="polite">{item.quantity}</span>
                            <Button
                              variant="link"
                              size="sm"
                              onClick={() => increaseQuantity(index)}
                              aria-label={t("زيادة الكمية", "Augmenter la quantité")}
                              style={{ padding: 0 }}
                            >
                              +
                            </Button>
                          </>
                        )}
                        {invalid && <span>{item.quantity}</span>}
                      </td>
                      <td>{item.unitPrice} DA</td>
                      <td>{item.totalPrice} DA</td>
                      <td>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => removeItem(index)}
                          aria-label={t("إزالة المنتج من السلة", "Retirer du panier")}
                        >
                          {t("حذف", "Retirer")}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>

            {thereAreInvalid && (
              <Alert variant="warning" role="status" aria-live="polite">
                {t(
                  "تحتوي سلتك على منتجات غير متوفرة. احذفها قبل متابعة الدفع.",
                  "Votre panier contient des articles indisponibles. Retirez-les avant de continuer."
                )}
              </Alert>
            )}

            <div className="cart-footer mt-4">
              <div className="row">
                <div className="col-6">
                  <strong>{t("المجموع الفرعي", "Sous-total")}:</strong> {subtotal} DA
                </div>
                <div className="col-6">
                  <strong>{t("الشحن", "Frais de port")}:</strong> 0 DA
                </div>
              </div>
              <div className="row mt-3">
                <div className="col-12">
                  <hr />
                </div>
              </div>
              <div className="row">
                <div className="col-12">
                  <strong>{t("المجموع", "Total")}:</strong> {total} DA
                </div>
              </div>
            </div>
          </Container>
        )}

        <Button
          variant="primary"
          size="lg"
          className="w-100 dxn-btn dxn-btn-primary"
          onClick={() => navigate("/checkout")}
          style={{ marginTop: "20px" }}
          disabled={empty || allInvalid || thereAreInvalid}
          aria-disabled={empty || allInvalid || thereAreInvalid}
          aria-busy={false}
        >
          {thereAreInvalid
            ? t("احذف المنتجات غير المتوفرة أولاً", "Retirez d'abord les articles indisponibles")
            : t("متابعة الدفع", "Procéder au paiement")}
        </Button>
      </Container>
    </>
  );
};

export default CartPage;