import React, { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import SeoHead from "../components/SeoHead";
import { useLanguage } from "../context/LanguageContext";
import { usePublicContent } from "../hooks/usePublicContent";

const EducationCenterPage: React.FC = () => {
  const { slug } = useParams<{ slug?: string }>();
  const { language } = useLanguage();
  const { articles, loading } = usePublicContent();
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const tx = (ar: string, fr: string) => (language === "ar" ? ar : fr);

  const categoryLabels: Record<string, string> = {
    all: tx("جميع المواضيع", "Tous les sujets"),
    ganoderma: tx("الجانوديرما", "Ganoderma"),
    spirulina: tx("السبيرولينا", "Spiruline"),
    supplements: tx("المكملات الغذائية", "Compléments alimentaires"),
    nutrition: tx("العناصر الغذائية", "Micronutriments & Fibres"),
    usage: tx("الاستخدام والحفظ", "Usage & Conservation"),
    faq: tx("إرشادات السلامة", "Sécurité & Conseils"),
  };

  const filteredArticles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return articles.filter((art) => {
      if (selectedCategory !== "all" && art.category !== selectedCategory) return false;
      if (!q) return true;
      const loc = language === "ar" ? art.ar : art.fr;
      return (
        loc.title.toLowerCase().includes(q) ||
        loc.summary.toLowerCase().includes(q) ||
        loc.scientificInfo.toLowerCase().includes(q)
      );
    });
  }, [articles, selectedCategory, searchQuery, language]);

  // Single Article Detail View (/education/:slug)
  if (slug) {
    const article = articles.find((a) => a.slug === slug);

    if (loading && !article) {
      return (
        <div className="container py-5 text-center">
          <div className="spinner-border text-success" role="status" />
        </div>
      );
    }

    if (!article) {
      return (
        <div className="container py-5">
          <div className="dxn-empty">
            <h2>{tx("المقال غير موجود", "Article introuvable")}</h2>
            <Link to="/education" className="dxn-btn dxn-btn-primary mt-3">
              {tx("العودة إلى مركز المعرفة", "Retour au centre éducatif")}
            </Link>
          </div>
        </div>
      );
    }

    const loc = language === "ar" ? article.ar : article.fr;
    const articleJsonLd = {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: loc.title,
      description: loc.summary,
      author: { "@type": "Organization", name: "DXN NADZ" },
      publisher: { "@type": "Organization", name: "DXN NADZ" },
    };

    return (
      <div className="dxn-page">
        <SeoHead
          title={loc.title}
          description={loc.summary}
          canonicalPath={`/education/${article.slug}`}
          ogType="article"
          jsonLd={articleJsonLd}
        />

        <section className="dxn-hero" style={{ padding: "3rem 0" }}>
          <div className="container">
            <div className="mb-2">
              <Link to="/education" className="text-white text-decoration-none small opacity-75">
                ← {tx("العودة إلى مركز التثقيف بالمنتجات", "Retour au centre éducatif")}
              </Link>
            </div>
            <span className="dxn-hero-eyebrow">
              {categoryLabels[article.category] || article.category} • {article.readingMinutes}{" "}
              {tx("دقائق قراءة", "min de lecture")}
            </span>
            <h1 className="mb-2">{loc.title}</h1>
            <p className="dxn-hero-lead mb-0">{loc.summary}</p>
          </div>
        </section>

        <section className="dxn-section">
          <div className="container" style={{ maxWidth: 880 }}>
            {/* Mandatory prominent disclaimer */}
            <div className="dxn-compliance-banner mb-4" role="note">
              {loc.disclaimer}
            </div>

            {/* 1. Scientifically established */}
            <div className="dxn-evidence-section">
              <span className="dxn-evidence-badge science">
                1. {tx("ما هو مثبت علمياً عن العناصر الغذائية والمكونات", "Données nutritionnelles et scientifiques établies")}
              </span>
              <p className="mb-0" style={{ lineHeight: 1.9 }}>{loc.scientificInfo}</p>
            </div>

            {/* 2. Ingredient studies */}
            {loc.ingredientEvidence && (
              <div className="dxn-evidence-section">
                <span className="dxn-evidence-badge study">
                  2. {tx("سياق الأبحاث حول المكون وجودته الغذائية", "Contexte des études sur les ingrédients")}
                </span>
                <p className="mb-0" style={{ lineHeight: 1.9 }}>{loc.ingredientEvidence}</p>
              </div>
            )}

            {/* 3. Traditional / historical uses */}
            {loc.traditionalUses && (
              <div className="dxn-evidence-section">
                <span className="dxn-evidence-badge tradition">
                  3. {tx("الاستخدامات التقليدية والتاريخية", "Usages traditionnels et historiques")}
                </span>
                <p className="mb-0" style={{ lineHeight: 1.9 }}>{loc.traditionalUses}</p>
              </div>
            )}

            {/* 4. Unproven claims to avoid */}
            {loc.unprovenClaimsNotice && (
              <div className="dxn-evidence-section">
                <span className="dxn-evidence-badge caution">
                  4. {tx("ادعاءات غير مثبتة يجب تجنبها", "Affirmations non prouvées à éviter")}
                </span>
                <p className="mb-0" style={{ lineHeight: 1.9 }}>{loc.unprovenClaimsNotice}</p>
              </div>
            )}

            {/* 5. Official usage & storage */}
            {loc.usageAndStorage && (
              <div className="dxn-evidence-section">
                <span className="dxn-evidence-badge science">
                  5. {tx("إرشادات الاستخدام الصحيح وطريقة التخزين", "Conseils d'utilisation et de conservation")}
                </span>
                <p className="mb-0" style={{ lineHeight: 1.9 }}>{loc.usageAndStorage}</p>
              </div>
            )}

            <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mt-4 pt-3 border-top">
              <Link to="/education" className="dxn-btn dxn-btn-outline">
                {tx("جميع المقالات التثقيفية", "Tous les articles éducatifs")}
              </Link>
              <Link to="/products" className="dxn-btn dxn-btn-primary">
                {tx("استعراض منتجات المتجر", "Parcourir la boutique")}
              </Link>
            </div>
          </div>
        </section>
      </div>
    );
  }

  // Education Center Index View (/education)
  return (
    <div className="dxn-page">
      <SeoHead
        title={tx("مركز المعرفة والتثقيف بالمنتجات", "Centre éducatif produits & nutrition")}
        description={tx(
          "دليل تثقيفي علمي ومتزن حول الجانوديرما، السبيرولينا، المكملات الغذائية، الفيتامينات، الألياف، مضادات الأكسدة، وطريقة الاستخدام والحفظ.",
          "Centre d'information responsable sur le Ganoderma, la spiruline, les compléments alimentaires, les micronutriments et les bonnes pratiques."
        )}
        canonicalPath="/education"
      />

      <section className="dxn-hero" style={{ padding: "3.5rem 0" }}>
        <div className="container">
          <span className="dxn-hero-eyebrow">{tx("التثقيف المسؤول والموثوق", "Éducation & Transparence")}</span>
          <h1 className="mb-2">{tx("مركز التثقيف بالمنتجات والتغذية", "Centre d'éducation produits & nutrition")}</h1>
          <p className="dxn-hero-lead mb-0">
            {tx(
              "محتوى علمي منظم يفرّق بوضوح بين الحقائق الغذائية المثبتة، الدراسات حول المكونات، الاستخدامات التقليدية، والادعاءات غير المثبتة.",
              "Des guides structurés distinguant faits nutritionnels établis, études sur les ingrédients, usages traditionnels et allégations non prouvées."
            )}
          </p>
        </div>
      </section>

      <section className="dxn-section">
        <div className="container">
          <div className="dxn-compliance-banner mb-4">
            <strong>{tx("التزام الامتثال الصحي:", "Engagement de conformité sanitaire :")}</strong>{" "}
            {tx(
              "المكملات الغذائية ومنتجات DXN ليست أدوية طبية، ولا تُقدَّم في هذه المنصة لعلاج أو تشخيص أو الوقاية من أي مرض. استشر طبيبك أو المختص الصحي دائماً عند الحاجة.",
              "Les compléments alimentaires et produits DXN ne sont pas des médicaments et ne remplacent jamais une consultation ni un traitement médical."
            )}
          </div>

          {/* Search & Category Filter */}
          <div className="row g-3 align-items-center mb-4">
            <div className="col-lg-8">
              <div className="dxn-cat-pill-bar">
                {Object.entries(categoryLabels).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    className={selectedCategory === key ? "dxn-cat-pill active" : "dxn-cat-pill"}
                    onClick={() => setSelectedCategory(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="col-lg-4">
              <input
                type="search"
                className="form-control"
                placeholder={tx("ابحث في المواضيع التثقيفية...", "Rechercher un sujet éducatif...")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label={tx("ابحث في مركز المعرفة", "Rechercher")}
              />
            </div>
          </div>

          {filteredArticles.length === 0 ? (
            <div className="dxn-empty">
              <h3>{tx("لا توجد مقالات مطابقة لبحثك", "Aucun article ne correspond à votre recherche")}</h3>
              <button
                type="button"
                className="dxn-btn dxn-btn-outline mt-2"
                onClick={() => {
                  setSelectedCategory("all");
                  setSearchQuery("");
                }}
              >
                {tx("إعادة ضبط البحث", "Réinitialiser")}
              </button>
            </div>
          ) : (
            <div className="row g-4">
              {filteredArticles.map((art) => {
                const loc = language === "ar" ? art.ar : art.fr;
                return (
                  <div key={art.slug} className="col-md-6 col-lg-4">
                    <div className="dxn-info-card d-flex flex-column justify-content-between">
                      <div>
                        <div className="d-flex justify-content-between align-items-center mb-2">
                          <span className="dxn-evidence-badge science mb-0">
                            {categoryLabels[art.category] || art.category}
                          </span>
                          <span className="text-muted small">
                            {art.readingMinutes} {tx("دقائق", "min")}
                          </span>
                        </div>
                        <h2 className="h5 fw-bold mt-2 mb-2">{loc.title}</h2>
                        <p className="text-muted small mb-3" style={{ lineHeight: 1.75 }}>
                          {loc.summary}
                        </p>
                      </div>
                      <Link
                        to={`/education/${encodeURIComponent(art.slug)}`}
                        className="dxn-btn dxn-btn-outline btn-sm w-100"
                      >
                        {tx("قراءة الدليل الكامل", "Lire le guide complet")}
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default EducationCenterPage;
