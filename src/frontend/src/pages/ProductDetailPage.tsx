import React, { useCallback, useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import axios from "axios";
import { Container, Row, Col, Button } from "react-bootstrap";
import { useLanguage } from "../context/LanguageContext";
import { useCart } from "../context/CartContext";
import { useSiteSettings } from "../context/SiteSettingsContext";
import ReviewCard from "../components/ReviewCard";
import ProductCard, {
  pickProductCategoryLabel,
  pickProductDescription,
  pickProductTitle,
} from "../components/ProductCard";
import SeoHead from "../components/SeoHead";

function pickTranslatedField(product: any, field: string, language: string): string {
  if (!product) return "";
  const want = language === "ar" ? "ar" : "fr";
  if (Array.isArray(product.translations)) {
    const exact = product.translations.find((tr: any) => tr.language === want && tr[field]);
    if (exact?.[field]) return String(exact[field]);
    const fallback = product.translations.find((tr: any) => tr[field]);
    if (fallback?.[field]) return String(fallback[field]);
  }
  if (typeof product[field] === "string" && product[field]) {
    return product[field];
  }
  return "";
}

const ProductDetailPage = () => {
  const { language } = useLanguage();
  const { slug } = useParams<{ slug: string }>();
  const { addItem } = useCart();
  const { settings } = useSiteSettings();

  const [product, setProduct] = useState<any>(null);
  const [relatedProducts, setRelatedProducts] = useState<any[]>([]);
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
      setActiveImage(
        data.image || (Array.isArray(data.images) && data.images.length ? data.images[0] : "")
      );

      // Load reviews & related products in parallel
      const [reviewsRes, catalogRes] = await Promise.all([
        axios.get(`/api/reviews/product/${data._id}`).catch(() => ({ data: { data: [] } })),
        axios
          .get(`/api/products?language=${language}`)
          .catch(() => ({ data: { data: [] } })),
      ]);

      setReviews(reviewsRes.data?.data || []);
      const allActive: any[] = Array.isArray(catalogRes.data?.data) ? catalogRes.data.data : [];
      const others = allActive.filter((p) => String(p._id) !== String(data._id));
      const sameCategory = others.filter(
        (p) => p.category && data.category && p.category === data.category
      );
      setRelatedProducts((sameCategory.length >= 2 ? sameCategory : others).slice(0, 4));
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
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="dxn-loading" role="status">
        <div className="dxn-loading-ring" />
        <div>{t("جارٍ التحميل...", "Chargement...")}</div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <Container className="mt-5 mb-5" style={{ maxWidth: 560 }}>
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
  const specifications = pickTranslatedField(product, "specifications", language);
  const ingredients = pickTranslatedField(product, "ingredients", language);
  const usageInstructions = pickTranslatedField(product, "usageInstructions", language);
  const storageInstructions = pickTranslatedField(product, "storageInstructions", language);
  const sizeText = pickTranslatedField(product, "size", language);

  const price = Number(product.price) || 0;
  const compareAt = product.compareAtPrice ? Number(product.compareAtPrice) : 0;
  const imageUrl =
    product.image || (Array.isArray(product.images) && product.images.length ? product.images[0] : "");
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

  const whatsappInquiryHref = settings.whatsappUrl
    ? `${settings.whatsappUrl}${settings.whatsappUrl.includes("?") ? "&" : "?"}text=${encodeURIComponent(
        language === "ar"
          ? `السلام عليكم فريق DXN NADZ، أود الاستفسار عن المنتج: ${title} (${product.sku || ""})`
          : `Bonjour DXN NADZ, je souhaite me renseigner sur le produit : ${title} (${product.sku || ""})`
      )}`
    : "";

  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: title,
    description: description || title,
    sku: product.sku || "",
    ...(imageUrl ? { image: imageUrl } : {}),
    brand: { "@type": "Brand", name: "DXN" },
    offers: {
      "@type": "Offer",
      price,
      priceCurrency: "DZD",
      availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    },
  };

  return (
    <Container className="mt-4 mb-5">
      <SeoHead
        title={title}
        description={description ? description.slice(0, 160) : title}
        canonicalPath={`/product/${encodeURIComponent(product.slug || slug || "")}`}
        ogType="product"
        ogImage={imageUrl || undefined}
        jsonLd={productJsonLd}
      />

      <nav aria-label="breadcrumb" className="dxn-breadcrumb mb-3">
        <Link to="/">{t("الرئيسية", "Accueil")}</Link>
        <span aria-hidden="true" className="mx-2">/</span>
        <Link to="/products">{t("المنتجات", "Produits")}</Link>
        {product.category && (
          <>
            <span aria-hidden="true" className="mx-2">/</span>
            <Link to={`/products?category=${encodeURIComponent(product.category)}`}>
              {pickProductCategoryLabel(product.category, language)}
            </Link>
          </>
        )}
        <span aria-hidden="true" className="mx-2">/</span>
        <span>{title}</span>
      </nav>

      <Row className="g-4">
        <Col md={6}>
          <div className="dxn-detail-gallery dxn-anim-fade-up">
            <div className="text-center d-flex align-items-center justify-content-center" style={{ minHeight: 320 }}>
              {activeImage ? (
                <img
                  src={activeImage}
                  alt={title}
                  className="dxn-detail-main-img"
                  onError={() => setActiveImage("")}
                />
              ) : (
                <div className="py-5 text-secondary">
                  <div className="fw-bold mb-1" style={{ fontSize: "1.2rem", color: "#0b3d1f" }}>
                    DXN NADZ
                  </div>
                  <div className="small">
                    {t("الصورة الرسمية للمنتج غير مرفقة حالياً", "Photo officielle non disponible pour le moment")}
                  </div>
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

        <Col md={6} className="dxn-anim-fade-up">
          <div className="mb-2">
            <span className="badge rounded-pill" style={{ background: "#e6f4ec", color: "#0b3d1f" }}>
              {pickProductCategoryLabel(product.category, language)}
            </span>
          </div>
          <h1 className="mb-1" style={{ fontWeight: 800, color: "#0b3d1f" }}>{title}</h1>
          {product.sku && (
            <p className="text-muted small mb-2">
              {t("رمز المنتج (SKU)", "Référence SKU")}: {product.sku}
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
            {typeof product.points === "number" && product.points > 0 && (
              <span className="dxn-chip" style={{ backgroundColor: "#f0f4f1", color: "#0b3d1f", marginBottom: 0 }}>
                {t(`نقاط DXN (PV): ${product.points}`, `Points DXN (PV): ${product.points}`)}
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

          {sizeText && (
            <p className="mb-3">
              <span className="dxn-detail-size">
                {t("الحجم / العبوة", "Format / Contenance")}: {sizeText}
              </span>
            </p>
          )}

          {description && (
            <div className="mb-4">
              <h2 className="h6 fw-bold" style={{ color: "#0b3d1f" }}>
                {t("نظرة عامة على المنتج", "Aperçu du produit")}
              </h2>
              <p className="mb-0" style={{ whiteSpace: "pre-line", color: "#4a5a50", lineHeight: 1.8 }}>
                {description}
              </p>
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
              {added ? t("تمت الإضافة ✓", "Ajouté ✓") : t("أضف إلى السلة", "Ajouter au panier")}
            </Button>
            <Link to="/cart" className="dxn-btn dxn-btn-outline">
              {t("الذهاب إلى السلة", "Voir le panier")}
            </Link>
            {whatsappInquiryHref ? (
              <a
                href={whatsappInquiryHref}
                target="_blank"
                rel="noopener noreferrer"
                className="dxn-btn dxn-btn-primary"
              >
                {t("استفسر عبر واتساب", "Question via WhatsApp")}
              </a>
            ) : (
              <Link
                to={`/contact?subject=${encodeURIComponent(title)}`}
                className="dxn-btn dxn-btn-outline"
              >
                {t("استفسر عن هذا المنتج", "Poser une question")}
              </Link>
            )}
          </div>

          <div className="dxn-detail-note">
            <span>
              {t(
                "الدفع نقداً عند الاستلام متاح عبر ولايات الجزائر (69 ولاية — حسب تغطية شركة التوصيل) • لا يُشترط رقم عضوية للشراء (يمكن إضافته اختيارياً عند الدفع).",
                "Paiement à la livraison en Algérie (69 wilayas — selon couverture du transporteur) • Aucun numéro d'adhésion requis pour commander."
              )}
            </span>
          </div>
        </Col>
      </Row>

      {/* Detailed Ingredients, Specifications & Official Usage (Phase 4.2) */}
      <Row className="g-4 mt-3">
        <Col md={6}>
          <div className="dxn-info-card">
            <h2 className="h5 fw-bold mb-2" style={{ color: "#0b3d1f" }}>
              {t("المكونات والمواصفات", "Ingrédients & Spécifications")}
            </h2>
            {ingredients ? (
              <p className="text-muted mb-2" style={{ whiteSpace: "pre-line", lineHeight: 1.8 }}>
                <strong>{t("المكونات:", "Ingrédients :")}</strong> {ingredients}
              </p>
            ) : null}
            {specifications ? (
              <p className="text-muted mb-0" style={{ whiteSpace: "pre-line", lineHeight: 1.8 }}>
                {specifications}
              </p>
            ) : null}
            {!ingredients && !specifications && (
              <p className="text-muted small mb-0" style={{ lineHeight: 1.8 }}>
                {t(
                  "يرجى مراجعة الملصق الرسمي المطبوع على عبوة المنتج الأصلية للاطلاع على جدول القيم الغذائية وقائمة المكونات التفصيلية الخاصة بكل تشغيلة.",
                  "Veuillez consulter l'étiquette officielle figurant sur l'emballage d'origine pour la liste complète des ingrédients et valeurs nutritionnelles."
                )}
              </p>
            )}
          </div>
        </Col>

        <Col md={6}>
          <div className="dxn-info-card">
            <h2 className="h5 fw-bold mb-2" style={{ color: "#0b3d1f" }}>
              {t("طريقة الاستخدام والحفظ الرسمية", "Mode d'emploi officiel & Conservation")}
            </h2>
            <p className="text-muted mb-2" style={{ whiteSpace: "pre-line", lineHeight: 1.8 }}>
              {usageInstructions ||
                t(
                  "تُتبع الحصة وطريقة التحضير أو الاستخدام الموضحة على العبوة الرسمية للمنتج حصراً (منتجات الكوسميتيك والعناية الشخصية مخصصة للاستعمال الخارجي فقط).",
                  "Suivez exclusivement le mode d'emploi et la portion journalière indiqués sur l'emballage officiel (usage externe uniquement pour les cosmétiques)."
                )}
            </p>
            <p className="text-muted small mb-0" style={{ lineHeight: 1.75 }}>
              <strong>{t("التخزين:", "Conservation :")}</strong>{" "}
              {storageInstructions ||
                t(
                  "يُحفظ في مكان بارد وجاف بعيداً عن الرطوبة وأشعة الشمس المباشرة وبعيداً عن متناول الأطفال.",
                  "À conserver dans un endroit frais et sec, à l'abri du soleil et hors de portée des enfants."
                )}
            </p>
          </div>
        </Col>
      </Row>

      <div className="dxn-compliance-banner mt-4">
        <strong>{t("تنبيه صحي:", "Avertissement sanitaire :")}</strong>{" "}
        {t(
          "المكملات الغذائية ومنتجات DXN ليست أدوية طبية، ولا تهدف إلى تشخيص أي مرض أو علاجه أو الشفاء منه أو الوقاية منه. استشر الطبيب قبل الاستخدام في حال الحمل أو الرضاعة أو تناول أدوية طبية.",
          "Les compléments alimentaires et produits DXN ne sont pas des médicaments et ne visent pas à diagnostiquer, traiter, guérir ou prévenir une maladie."
        )}
      </div>

      {/* Genuine Published Reviews */}
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

      {/* Related Products (Phase 4.2) */}
      {relatedProducts.length > 0 && (
        <div className="mt-5 pt-3 border-top">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h2 className="h4 fw-bold mb-0">{t("منتجات ذات صلة", "Produits similaires")}</h2>
            <Link to="/products" className="small fw-bold text-decoration-none" style={{ color: "var(--dxn-green-700)" }}>
              {t("عرض الكل ←", "Tout voir →")}
            </Link>
          </div>
          <Row className="g-3 g-md-4">
            {relatedProducts.map((rel) => (
              <Col key={rel._id} xs={6} md={3}>
                <ProductCard product={rel} language={language} />
              </Col>
            ))}
          </Row>
        </div>
      )}
    </Container>
  );
};

export default ProductDetailPage;
