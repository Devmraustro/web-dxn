import React, { useCallback, useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";
import { useCart } from "../context/CartContext";
import axios from "axios";
import { Container, Row, Col, Button } from "react-bootstrap";
import ReviewCard from "../components/ReviewCard";
import { pickProductTitle, pickProductDescription } from "../components/ProductCard";

const ProductDetailPage = () => {
  const { language } = useLanguage();
  const { slug } = useParams<{ slug: string }>();
  const { addItem } = useCart();

  const [product, setProduct] = useState<any>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(false);
  const [activeImage, setActiveImage] = useState("");

  const t = (ar: string, fr: string) => (language === "ar" ? ar : fr);

  const load = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(
        `/api/products/slug/${encodeURIComponent(slug)}?language=${language}`
      );
      const data = response.data?.data;
      if (!data) {
        setError(t("المنتج غير موجود", "Produit introuvable"));
        setLoading(false);
        return;
      }
      setProduct(data);
      setActiveImage(data.image || (Array.isArray(data.images) && data.images.length ? data.images[0] : ""));
      // Reviews (public, published only)
      try {
        const reviewsResponse = await axios.get(`/api/reviews/product/${data._id}`);
        setReviews(reviewsResponse.data?.data || []);
      } catch {
        setReviews([]);
      }
      setLoading(false);
    } catch (err: any) {
      console.error("Error loading product:", err);
      if (err?.response?.status === 404) {
        setError(t("المنتج غير موجود", "Produit introuvable"));
      } else {
        setError(t("تعذر تحميل المنتج", "Impossible de charger le produit"));
      }
      setLoading(false);
    }
  }, [slug, language]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="dxn-loading" role="status">
        <div className="dxn-loading-ring"></div>
        <div>{t("جارٍ التحميل...", "Chargement...")}</div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <Container className="mt-5" style={{ maxWidth: 560 }}>
        <div className="dxn-feedback-error p-3 mb-3" role="alert">
          {error || t("حدث خطأ", "Une erreur est survenue")}
        </div>
        <Link to="/products" className="dxn-btn dxn-btn-primary">
          {t("العودة للمنتجات", "Retour aux produits")}
        </Link>
      </Container>
    );
  }

  const title = pickProductTitle(product, language) || product.sku || "DXN Product";
  const description = pickProductDescription(product, language);
  const price = Number(product.price) || 0;
  const compareAt = product.compareAtPrice ? Number(product.compareAtPrice) : 0;
  const imageUrl = product.image || (Array.isArray(product.images) && product.images.length ? product.images[0] : "");
  const gallery = Array.isArray(product.images) && product.images.length > 1 ? product.images : [];
  const inStock = typeof product.stockQuantity !== "number" || product.stockQuantity > 0;
  const hasOffer = compareAt > price && price > 0;

  const handleAdd = () => {
    addItem({
      productId: product._id,
      name: title,
      unitPrice: price,
      quantity: 1,
      totalPrice: price,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2500);
  };

  const thumbnails = Array.from(new Set([imageUrl, ...gallery].filter(Boolean)));

  return (
    <Container className="mt-4">
      {/* Breadcrumb */}
      <nav aria-label="breadcrumb" className="dxn-breadcrumb mb-3">
        <Link to="/products">{t("المنتجات", "Produits")}</Link>
        <span aria-hidden="true" className="mx-2">/</span>
        <span>{title}</span>
      </nav>

      <Row className="g-4">
        {/* Gallery */}
        <Col md={6}>
          <div className="dxn-detail-gallery dxn-anim-fade-up">
            <div className="text-center" style={{ minHeight: 300 }}>
              {activeImage ? (
                <img
                  src={activeImage}
                  alt={title}
                  className="dxn-detail-main-img"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = "none";
                  }}
                />
              ) : (
                <div className="py-5 text-secondary">
                  {t("لا توجد صورة", "Aucune image disponible")}
                </div>
              )}
            </div>
          </div>
          {thumbnails.length > 1 && (
            <div className="d-flex gap-2 mt-3 flex-wrap">
              {thumbnails.map((url, idx) => (
                <button
                  key={idx}
                  type="button"
                  className={"dxn-thumb " + (url === activeImage ? "active" : "")}
                  onClick={() => setActiveImage(url)}
                  aria-label={t("عرض الصورة", "Voir l'image")}
                >
                  <img src={url} alt="" />
                </button>
              ))}
            </div>
          )}
        </Col>

        {/* Info */}
        <Col md={6} className="dxn-anim-fade-up">
          <h1 className="mb-1" style={{ fontWeight: 800, color: "#0b3d1f" }}>{title}</h1>
          {product.sku && (
            <p className="text-muted small mb-2">
              {t("المرجع", "Réf")}: {product.sku}
            </p>
          )}

          <div className="d-flex align-items-center gap-2 flex-wrap mb-3">
            {inStock ? (
              <span className="dxn-pcard-stock ok mb-0" style={{ border: 0, padding: 0 }}>
                {t("متوفر في المخزن", "En stock")}
              </span>
            ) : (
              <span className="dxn-pcard-stock oos mb-0" style={{ border: 0, padding: 0 }}>
                {t("غير متوفر حالياً", "Rupture de stock")}
              </span>
            )}
            {product.isFeatured && (
              <span className="dxn-chip" style={{ marginBottom: 0 }}>
                {t("مميز", "En vedette")}
              </span>
            )}
          </div>

          <div className="mb-3">
            {hasOffer ? (
              <div className="d-flex align-items-baseline gap-2 flex-wrap">
                <span className="dxn-pcard-price-old" style={{ fontSize: "1.1rem" }}>
                  {compareAt.toLocaleString("fr-DZ")} DA
                </span>
                <span className="dxn-detail-price">{price.toLocaleString("fr-DZ")} DA</span>
                <span className="dxn-pcard-offer" style={{ position: "static" }}>
                  {t("خصم", "Promo")} {Math.round((1 - price / compareAt) * 100)}%
                </span>
              </div>
            ) : (
              <span className="dxn-detail-price">{price.toLocaleString("fr-DZ")} DA</span>
            )}
          </div>

          {product.size && (
            <p className="mb-3">
              <span className="dxn-detail-size">
                {t("الحجم", "Taille")}: {product.size}
              </span>
            </p>
          )}

          {description && (
            <div className="mb-4">
              <h2 className="h5 fw-bold" style={{ color: "#0b3d1f" }}>
                {t("الوصف", "Description")}
              </h2>
              <p style={{ whiteSpace: "pre-line", color: "#4a5a50" }}>{description}</p>
            </div>
          )}

          <div className="d-flex gap-2 flex-wrap align-items-center mb-3">
            <Button
              variant="primary"
              size="lg"
              className="dxn-btn dxn-btn-gold"
              onClick={handleAdd}
              disabled={!inStock}
              aria-busy={added}
            >
              {added
                ? t("تمت الإضافة ✓", "Ajouté ✓")
                : t("أضف إلى السلة", "Ajouter au panier")}
            </Button>
            <Link to="/cart" className="dxn-btn dxn-btn-outline">
              {t("الذهاب إلى السلة", "Voir le panier")}
            </Link>
          </div>

          <div className="dxn-detail-note">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }}>
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <span>
              {t(
                "الدفع عند الاستلام متاح لجميع الولايات الـ 58. يتم تأكيد الطلب عبر الهاتف.",
                "Paiement à la livraison disponible pour les 58 wilayas. Commande confirmée par téléphone."
              )}
            </span>
          </div>
        </Col>
      </Row>

      {reviews.length > 0 && (
        <Row className="mt-5">
          <Col>
            <h2 className="h4 mb-3 dxn-detail-reviews-title">{t("تقييمات العملاء", "Avis clients")}</h2>
            {reviews.map((review: any) => (
              <ReviewCard key={review._id} review={review} />
            ))}
          </Col>
        </Row>
      )}
    </Container>
  );
};

export default ProductDetailPage;