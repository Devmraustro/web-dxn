import React, { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import axios from "axios";
import { Container, Row, Col } from "react-bootstrap";
import ProductCard, { pickProductDescription, pickProductTitle } from "../components/ProductCard";
import SeoHead from "../components/SeoHead";
import { useLanguage } from "../context/LanguageContext";

const ProductListPage = () => {
  const { language } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialCategory = (searchParams.get("category") || "all").toLowerCase();

  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory);
  const [searchQuery, setSearchQuery] = useState<string>(searchParams.get("q") || "");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const t = (ar: string, fr: string) => (language === "ar" ? ar : fr);

  useEffect(() => {
    const paramCat = (searchParams.get("category") || "all").toLowerCase();
    setSelectedCategory(paramCat);
  }, [searchParams]);

  useEffect(() => {
    let active = true;
    const loadCatalog = async () => {
      try {
        setLoading(true);
        const [prodRes, catRes] = await Promise.all([
          axios.get(`/api/products?language=${language}`),
          axios.get("/api/categories").catch(() => ({ data: { data: [] } })),
        ]);
        if (!active) return;
        setProducts(Array.isArray(prodRes.data?.data) ? prodRes.data.data : []);
        setCategories(Array.isArray(catRes.data?.data) ? catRes.data.data : []);
        setError(null);
      } catch (err) {
        if (!active) return;
        console.error("Error loading products:", err);
        setError("Failed to load products");
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadCatalog();
    return () => {
      active = false;
    };
  }, [language]);

  const handleSelectCategory = (slug: string) => {
    setSelectedCategory(slug);
    const next = new URLSearchParams(searchParams);
    if (slug === "all") {
      next.delete("category");
    } else {
      next.set("category", slug);
    }
    setSearchParams(next, { replace: true });
  };

  // Ensure the 3 core required filter tabs are always present + any dynamic DB categories
  const filterTabs = useMemo(() => {
    const tabs: Array<{ slug: string; label: string }> = [
      { slug: "all", label: t("الكل", "Tous") },
      { slug: "supplements", label: t("المكملات الغذائية", "Compléments alimentaires") },
      { slug: "cosmetics", label: t("الكوسميتيك", "Cosmétiques") },
    ];
    const seen = new Set(tabs.map((x) => x.slug));
    for (const c of categories) {
      const s = String(c?.slug || "").toLowerCase();
      if (s && !seen.has(s) && c.isActive !== false) {
        seen.add(s);
        tabs.push({
          slug: s,
          label: language === "ar" ? c.nameAr || s : c.nameFr || s,
        });
      }
    }
    return tabs;
  }, [categories, language]); // eslint-disable-line react-hooks/exhaustive-deps

  // Instant client-side category & search filtering (zero page reload!)
  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return products.filter((p) => {
      if (selectedCategory !== "all") {
        const pCat = String(p.category || "general").toLowerCase();
        if (pCat !== selectedCategory) return false;
      }
      if (!q) return true;
      const title = pickProductTitle(p, language).toLowerCase();
      const desc = pickProductDescription(p, language).toLowerCase();
      const sku = String(p.sku || "").toLowerCase();
      return title.includes(q) || desc.includes(q) || sku.includes(q);
    });
  }, [products, selectedCategory, searchQuery, language]);

  return (
    <div className="dxn-page">
      <SeoHead
        title={t("المنتجات — متجر DXN للحياة الطبيعية", "Catalogue Produits — DXN Natural Life")}
        description={t(
          "تصفّح منتجات DXN الأصلية من المكملات الغذائية والكوسميتيك والمشروبات مع التوصيل عبر ولايات الجزائر (69 ولاية — حسب تغطية شركة التوصيل) والدفع عند الاستلام.",
          "Parcourez les produits authentiques DXN : compléments alimentaires, cosmétiques et boissons avec livraison en Algérie (69 wilayas — selon couverture du transporteur) et paiement à la livraison."
        )}
        canonicalPath="/products"
      />

      <section className="dxn-hero" style={{ padding: "3.2rem 0" }}>
        <div className="container dxn-hero-inner">
          <span className="dxn-hero-eyebrow">
            {t("كتالوج منتجات DXN للحياة الطبيعية", "Catalogue officiel DXN Natural Life")}
          </span>
          <h1 className="mb-2">
            {t("اكتشف تشكيلة منتجات DXN", "Découvrez notre gamme de produits DXN")}
          </h1>
          <p className="dxn-hero-lead mb-0">
            {t(
              "تسوّق مباشرة بدون اشتراط عضوية، مع توصيل عبر ولايات الجزائر (69 ولاية — حسب تغطية شركة التوصيل) والدفع عند الاستلام.",
              "Commandez librement sans adhésion obligatoire, avec livraison en Algérie (69 wilayas — selon couverture du transporteur) et paiement à la livraison."
            )}
          </p>
        </div>
      </section>

      <Container id="products" className="py-4 my-2">
        {/* Category Filter Tabs & Instant Search Bar (Phase 4.1) */}
        <div className="bg-white border rounded-4 p-3 p-md-4 mb-4 shadow-xs">
          <Row className="g-3 align-items-center">
            <Col lg={8}>
              <div
                className="dxn-cat-pill-bar"
                role="tablist"
                aria-label={t("تصفية المنتجات حسب الفئة", "Filtrer par catégorie")}
              >
                {filterTabs.map((tab) => (
                  <button
                    key={tab.slug}
                    type="button"
                    role="tab"
                    aria-selected={selectedCategory === tab.slug}
                    className={selectedCategory === tab.slug ? "dxn-cat-pill active" : "dxn-cat-pill"}
                    onClick={() => handleSelectCategory(tab.slug)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </Col>
            <Col lg={4}>
              <input
                type="search"
                className="form-control"
                placeholder={t("ابحث باسم المنتج أو الوصف أو الرمز...", "Rechercher par nom, description ou réf...")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label={t("ابحث عن منتج", "Rechercher un produit")}
              />
            </Col>
          </Row>
        </div>

        {loading ? (
          <div className="dxn-loading" role="status" aria-live="polite">
            <div className="dxn-loading-ring" />
            <div>{t("جارٍ تحميل المنتجات...", "Chargement des produits...")}</div>
          </div>
        ) : error ? (
          <div className="dxn-feedback-error p-3" role="alert">
            {t("فشل تحميل المنتجات. يرجى المحاولة مرة أخرى.", "Échec du chargement des produits.")}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="dxn-empty">
            <h3>{t("لا توجد منتجات مطابقة حالياً", "Aucun produit correspondant")}</h3>
            <p className="mb-3">
              {products.length === 0
                ? t(
                    "قائمة المنتجات قيد التجهيز والتحديث حالياً. يمكنك التواصل معنا للاستفسار عن المنتجات المتوفرة.",
                    "Le catalogue est en cours d'actualisation. Contactez-nous pour toute demande de disponibilité."
                  )
                : t(
                    "جرّب اختيار تصنيف آخر أو مسح كلمة البحث لعرض كافة المنتجات المتوفرة.",
                    "Essayez une autre catégorie ou effacez la recherche."
                  )}
            </p>
            {products.length > 0 ? (
              <button
                type="button"
                className="dxn-btn dxn-btn-outline"
                onClick={() => {
                  handleSelectCategory("all");
                  setSearchQuery("");
                }}
              >
                {t("عرض كل المنتجات", "Afficher tous les produits")}
              </button>
            ) : (
              <Link to="/contact" className="dxn-btn dxn-btn-primary">
                {t("تواصل معنا", "Contactez-nous")}
              </Link>
            )}
          </div>
        ) : (
          <>
            <div className="d-flex justify-content-between align-items-center mb-3 small text-muted">
              <span>
                {t("عدد المنتجات المعروضة:", "Produits affichés :")} <strong>{filteredProducts.length}</strong>
              </span>
              <Link to="/education" className="text-decoration-none fw-semibold" style={{ color: "var(--dxn-green-700)" }}>
                {t("اقرأ إرشادات الاستخدام والحفظ ←", "Conseils d'utilisation & conservation →")}
              </Link>
            </div>
            <Row className="g-3 g-md-4">
              {filteredProducts.map((product: any) => (
                <Col key={product._id} xs={6} md={4} lg={3}>
                  <ProductCard product={product} language={language} />
                </Col>
              ))}
            </Row>
          </>
        )}
      </Container>
    </div>
  );
};

export default ProductListPage;
