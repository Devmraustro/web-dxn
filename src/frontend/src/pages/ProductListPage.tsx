import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";
import axios from "axios";
import ProductCard from "../components/ProductCard";
import { Container, Row, Col } from "react-bootstrap";

const ProductListPage = () => {
  const { language } = useLanguage();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadProducts = async () => {
      try {
        const response = await axios.get(`/api/products?language=${language}`);
        setProducts(response.data.data);
        setLoading(false);
      } catch (err) {
        console.error("Error loading products:", err);
        setError("Failed to load products");
        setLoading(false);
      }
    };

    loadProducts();
  }, [language]);

  const t = (ar: string, fr: string) => (language === "ar" ? ar : fr);

  if (loading) {
    return (
      <div className="dxn-loading" role="status" aria-live="polite">
        <div className="dxn-loading-ring"></div>
        <div>{t("جارٍ تحميل المنتجات...", "Chargement des produits...")}</div>
      </div>
    );
  }
  if (error) {
    return (
      <Container className="mt-5" style={{ maxWidth: 560 }}>
        <div className="dxn-feedback-error p-3" role="alert">
          {t("فشل تحميل المنتجات", "Échec du chargement des produits")}
        </div>
      </Container>
    );
  }

  return (
    <>
      {/* Hero */}
      <section className="dxn-hero dxn-anim-fade-up">
        <div className="dxn-hero-inner">
          <span className="dxn-hero-kicker">
            {t("مكملات غذائية طبيعية من DXN", "Compléments alimentaires naturels DXN")}
          </span>
          <h1 className="dxn-hero-title">
            {language === "ar" ? (
              <>
                منتجات طبيعية <span className="dxn-hero-gold">لصحة أفضل</span>
              </>
            ) : (
              <>
                Des produits naturels pour <span className="dxn-hero-gold">votre bien-être</span>
              </>
            )}
          </h1>
          <p className="dxn-hero-text">
            {t(
              "اكتشف تشكيلة DXN من المكملات الغذائية والمنتجات الصحية. توصيل إلى جميع الولايات الـ 58 مع الدفع عند الاستلام وتأكيد الطلب عبر الهاتف.",
              "Découvrez la gamme DXN de compléments alimentaires et produits de bien-être. Livraison vers les 58 wilayas, paiement à la livraison et confirmation par téléphone."
            )}
          </p>
          <div className="dxn-hero-cta">
            <a href="#products" className="dxn-btn dxn-btn-gold">
              {t("تصفح المنتجات", "Parcourir les produits")}
            </a>
            <Link to="/checkout" className="dxn-btn dxn-btn-outline" style={{ borderColor: "#fff", color: "#fff" }}>
              {t("إتمام الطلب", "Passer commande")}
            </Link>
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section className="dxn-trust" aria-label={t("مزايا المتجر", "Nos garanties")}>
        <div className="dxn-trust-item">
          <div className="dxn-trust-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
          </div>
          <div>
            <div className="dxn-trust-title">{t("توصيل 58 ولاية", "Livraison 58 wilayas")}</div>
            <div className="dxn-trust-sub">{t("إلى جميع ولايات الجزائر", "Partout en Algérie")}</div>
          </div>
        </div>
        <div className="dxn-trust-item">
          <div className="dxn-trust-icon gold">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
              <line x1="1" y1="10" x2="23" y2="10" />
            </svg>
          </div>
          <div>
            <div className="dxn-trust-title">{t("الدفع عند الاستلام", "Paiement à la livraison")}</div>
            <div className="dxn-trust-sub">{t("ادفع عند وصول طلبك", "Payez à la réception")}</div>
          </div>
        </div>
        <div className="dxn-trust-item">
          <div className="dxn-trust-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <div>
            <div className="dxn-trust-title">{t("منتجات DXN أصلية", "Produits DXN authentiques")}</div>
            <div className="dxn-trust-sub">{t("تأكيد الطلب عبر الهاتف", "Confirmation par téléphone")}</div>
          </div>
        </div>
      </section>

      {/* Products */}
      <section id="products" className="mt-5">
        <div className="d-flex align-items-center gap-3 flex-wrap mb-3">
          <div>
            <span className="dxn-chip">{language === "ar" ? "التشكيلة" : "La gamme"}</span>
            <h2 className="dxn-section-title h3">
              {t("منتجاتنا", "Nos produits")}
            </h2>
          </div>
        </div>
        <p className="dxn-section-sub">
          {t(
            "جميع الأسعار بالدينار الجزائري (دج). الأسعار والمخزون قابلة للتحديث بشكل مستمر.",
            "Tous les prix sont en dinars algériens (DA). Prix et stocks peuvent être mis à jour à tout moment."
          )}
        </p>

        {products.length === 0 ? (
          <div className="dxn-empty">
            <div className="dxn-empty-icon">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="9" cy="21" r="1" />
                <circle cx="20" cy="21" r="1" />
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
              </svg>
            </div>
            <p className="mb-0">{t("لا توجد منتجات حالياً", "Aucun produit disponible")}</p>
          </div>
        ) : (
          <Row>
            {products.map((product, index) => (
              <Col key={product._id} xs={12} sm={6} md={4} xl={3} className="mb-4 d-flex">
                <div className={`w-100 dxn-anim-fade-up dxn-stagger-${(index % 6) + 1}`}>
                  <ProductCard product={product} language={language} />
                </div>
              </Col>
            ))}
          </Row>
        )}
      </section>
    </>
  );
};

export default ProductListPage;