import React, { useCallback, useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";
import { useCart } from "../context/CartContext";
import axios from "axios";
import { Container, Row, Col, Card, Button, Alert, Badge, Spinner } from "react-bootstrap";
import ReviewCard from "../components/ReviewCard";
import { pickProductTitle } from "../components/ProductCard";

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
      <Container className="text-center mt-5 py-5">
        <Spinner animation="border" />
        <p className="mt-2">{t("جارٍ التحميل...", "Chargement...")}</p>
      </Container>
    );
  }

  if (error || !product) {
    return (
      <Container className="mt-5" style={{ maxWidth: 560 }}>
        <Alert variant="danger">{error || t("حدث خطأ", "Une erreur est survenue")}</Alert>
        <Link to="/products" className="btn btn-primary">
          {t("العودة للمنتجات", "Retour aux produits")}
        </Link>
      </Container>
    );
  }

  const title = pickProductTitle(product, language) || product.sku || "DXN Product";
  const price = Number(product.price) || 0;
  const compareAt = product.compareAtPrice ? Number(product.compareAtPrice) : 0;
  const imageUrl = product.image || (Array.isArray(product.images) && product.images.length ? product.images[0] : "");
  const gallery = Array.isArray(product.images) && product.images.length > 1 ? product.images : [];
  const inStock = typeof product.stockQuantity !== "number" || product.stockQuantity > 0;

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

  return (
    <Container className="mt-4">
      <nav aria-label="breadcrumb" className="mb-3">
        <Link to="/products" className="text-decoration-none">
          {t("المنتجات", "Produits")}
        </Link>
        <span aria-hidden="true" className="mx-2">/</span>
        <span>{title}</span>
      </nav>

      <Row>
        <Col md={6}>
          <Card className="mb-3">
            <div className="p-3 text-center bg-light" style={{ minHeight: 260 }}>
              {activeImage ? (
                <img
                  src={activeImage}
                  alt={title}
                  style={{ maxWidth: "100%", maxHeight: 420, objectFit: "contain" }}
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
          </Card>
          {(() => {
            const thumbnails = Array.from(new Set([imageUrl, ...gallery].filter(Boolean)));
            return thumbnails.length > 1 ? (
              <div className="d-flex gap-2 mb-3 flex-wrap">
                {thumbnails.map((url, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="btn btn-outline-secondary p-1"
                    style={{ width: 64, height: 64, overflow: "hidden" }}
                    onClick={() => setActiveImage(url)}
                    aria-label={t("عرض الصورة", "Voir l'image")}
                  >
                    <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </button>
                ))}
              </div>
            ) : null;
          })()}
        </Col>

        <Col md={6}>
          <h1 className="mb-2">{title}</h1>
          {product.sku && (
            <p className="text-muted small">
              {t("المرجع", "Réf")}: {product.sku}
            </p>
          )}

          <div className="mb-3">
            {compareAt > price && price > 0 ? (
              <>
                <span className="text-muted text-decoration-line-through me-2">{compareAt} DA</span>
                <span className="fs-3 fw-bold text-danger">{price} DA</span>
              </>
            ) : (
              <span className="fs-3 fw-bold">{price} DA</span>
            )}
          </div>

          <div className="mb-3">
            {inStock ? (
              <Badge bg="success" pill>
                {t("متوفر", "En stock")}
              </Badge>
            ) : (
              <Badge bg="secondary" pill>
                {t("غير متوفر حالياً", "Rupture de stock")}
              </Badge>
            )}
            {product.isFeatured && (
              <Badge bg="warning" pill className="ms-2 text-dark">
                {t("مميز", "En vedette")}
              </Badge>
            )}
          </div>

          {product.size && (
            <p className="mb-2">
              <strong>{t("الحجم", "Taille")}:</strong> {product.size}
            </p>
          )}

          {product.description && (
            <div className="mb-4">
              <h2 className="h5">{t("الوصف", "Description")}</h2>
              <p style={{ whiteSpace: "pre-line" }}>{product.description}</p>
            </div>
          )}

          <div className="d-flex gap-2 flex-wrap align-items-center mb-3">
            <Button
              variant="primary"
              size="lg"
              onClick={handleAdd}
              disabled={!inStock}
              aria-busy={added}
            >
              {added
                ? t("تمت الإضافة ✓", "Ajouté ✓")
                : t("أضف إلى السلة", "Ajouter au panier")}
            </Button>
            <Link to="/cart" className="btn btn-outline-primary btn-lg">
              {t("الذهاب إلى السلة", "Voir le panier")}
            </Link>
          </div>

          <div className="text-muted small">
            {t(
              "الدفع عند الاستلام متاح لجميع الولايات الـ 58. يتم تأكيد الطلب عبر الهاتف.",
              "Paiement à la livraison disponible pour les 58 wilayas. Commande confirmée par téléphone."
            )}
          </div>
        </Col>
      </Row>

      {reviews.length > 0 && (
        <Row className="mt-5">
          <Col>
            <h2 className="h4 mb-3">{t("تقييمات العملاء", "Avis clients")}</h2>
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
