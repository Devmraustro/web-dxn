import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import SeoHead from "../components/SeoHead";
import { useLanguage } from "../context/LanguageContext";
import { usePublicContent } from "../hooks/usePublicContent";

const FaqTrustPage: React.FC = () => {
  const { language } = useLanguage();
  const { faqs } = usePublicContent();
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [openSlug, setOpenSlug] = useState<string>("what-is-dxn");

  const tx = (ar: string, fr: string) => (language === "ar" ? ar : fr);

  const categoryLabels: Record<string, string> = {
    all: tx("الكل", "Toutes"),
    company: tx("عن شركة DXN", "À propos de DXN"),
    products: tx("المنتجات", "Produits"),
    ordering: tx("الطلب والتوصيل", "Commande & Livraison"),
    membership: tx("العضوية والفريق", "Adhésion & Équipe"),
    compliance: tx("الامتثال الصحي", "Conformité sanitaire"),
  };

  const filteredFaqs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return faqs.filter((item) => {
      if (selectedCategory !== "all" && item.category !== selectedCategory) return false;
      if (!q) return true;
      const loc = language === "ar" ? item.ar : item.fr;
      return loc.question.toLowerCase().includes(q) || loc.answer.toLowerCase().includes(q);
    });
  }, [faqs, selectedCategory, searchQuery, language]);

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.slice(0, 10).map((f) => {
      const loc = language === "ar" ? f.ar : f.fr;
      return {
        "@type": "Question",
        name: loc.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: loc.answer,
        },
      };
    }),
  };

  return (
    <div className="dxn-page">
      <SeoHead
        title={tx("الأسئلة الشائعة ومركز الثقة", "FAQ & Centre de confiance")}
        description={tx(
          "إجابات واضحة وموثقة حول شركة DXN، المنتجات، الطلب بدون عضوية، الانضمام إلى فريق DXN NADZ، وضوابط الامتثال الصحي.",
          "Réponses claires sur DXN, la commande sans adhésion, l'équipe DXN NADZ et nos engagements de conformité."
        )}
        canonicalPath="/faq"
        jsonLd={faqJsonLd}
      />

      <section className="dxn-hero" style={{ padding: "3.5rem 0" }}>
        <div className="container">
          <span className="dxn-hero-eyebrow">{tx("مركز الثقة والشفافية", "FAQ & Centre de confiance")}</span>
          <h1 className="mb-2">{tx("الأسئلة الشائعة وميثاق الاستخدام", "Questions fréquentes & Engagements")}</h1>
          <p className="dxn-hero-lead mb-0">
            {tx(
              "كل ما تحتاج إلى معرفته حول التسوق، العضوية الاختيارية، نظام البيع المباشر، والضوابط الصحية.",
              "Tout savoir sur vos achats, l'adhésion facultative, la vente directe et la conformité sanitaire."
            )}
          </p>
        </div>
      </section>

      <section className="dxn-section">
        <div className="container">
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
                placeholder={tx("ابحث في الأسئلة الشائعة...", "Rechercher une question...")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label={tx("ابحث في الأسئلة الشائعة", "Rechercher")}
              />
            </div>
          </div>

          {filteredFaqs.length === 0 ? (
            <div className="dxn-empty">
              <h3>{tx("لا توجد أسئلة مطابقة لبحثك", "Aucune question correspondante")}</h3>
              <button
                type="button"
                className="dxn-btn dxn-btn-outline mt-2"
                onClick={() => {
                  setSelectedCategory("all");
                  setSearchQuery("");
                }}
              >
                {tx("إظهار كل الأسئلة", "Afficher toutes les questions")}
              </button>
            </div>
          ) : (
            <div className="d-grid gap-3 mb-5">
              {filteredFaqs.map((item) => {
                const loc = language === "ar" ? item.ar : item.fr;
                const isOpen = openSlug === item.slug;
                return (
                  <div key={item.slug} className="bg-white border rounded-3 p-3 p-md-4 shadow-xs">
                    <button
                      type="button"
                      className="btn w-100 text-start d-flex justify-content-between align-items-center p-0 fw-bold"
                      onClick={() => setOpenSlug(isOpen ? "" : item.slug)}
                      aria-expanded={isOpen}
                    >
                      <span className="fs-6">{loc.question}</span>
                      <span style={{ color: "var(--dxn-green-700)", fontSize: "1.35rem" }}>
                        {isOpen ? "−" : "+"}
                      </span>
                    </button>
                    {isOpen && (
                      <p className="text-muted mb-0 mt-3 pt-3 border-top" style={{ lineHeight: 1.85 }}>
                        {loc.answer}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Trust & Terms Section (Phase 12 — No invented refund/delivery time guarantees) */}
          <div className="row g-4 mt-2">
            <div className="col-md-4">
              <div className="dxn-info-card">
                <h2 className="h5 fw-bold mb-2">{tx("إخلاء المسؤولية الصحية", "Avertissement sanitaire")}</h2>
                <p className="text-muted small mb-0" style={{ lineHeight: 1.8 }}>
                  {tx(
                    "المكملات الغذائية والمشروبات ومنتجات العناية المعروضة في DXN NADZ ليست أدوية طبية، ولا تهدف إلى تشخيص أو علاج أو شفاء أو الوقاية من أي مرض. استشر الطبيب المختص دائماً قبل تناول أي مكمل غذائي.",
                    "Les produits proposés sur DXN NADZ ne sont pas des médicaments et ne visent pas à diagnostiquer, traiter, guérir ou prévenir une maladie."
                  )}
                </p>
              </div>
            </div>

            <div className="col-md-4">
              <div className="dxn-info-card">
                <h2 className="h5 fw-bold mb-2">{tx("شروط الطلب والتسعير", "Conditions de commande")}</h2>
                <p className="text-muted small mb-0" style={{ lineHeight: 1.8 }}>
                  {tx(
                    "تُحسب أسعار المنتجات ورسوم التوصيل حسب الولاية وطريقة التسليم بوضوح قبل إرسال الطلب، ويتم تأكيد الطلبات هاتفياً مع العميل قبل الشحن مع الدفع نقداً عند الاستلام.",
                    "Les prix et frais de livraison par wilaya sont affichés clairement avant validation, et chaque commande fait l'objet d'une confirmation téléphonique."
                  )}
                </p>
              </div>
            </div>

            <div className="col-md-4">
              <div className="dxn-info-card">
                <h2 className="h5 fw-bold mb-2">{tx("حماية الخصوصية والبيانات", "Confidentialité & Données")}</h2>
                <p className="text-muted small mb-3" style={{ lineHeight: 1.8 }}>
                  {tx(
                    "تُستخدم بيانات الطلبات وطلبات الانضمام حصرياً لتنفيذ طلبك أو التواصل معك بناءً على موافقتك، ولا تُباع لأي طرف ثالث.",
                    "Vos informations personnelles sont traitées uniquement pour vos commandes ou demandes de contact et ne sont jamais vendues."
                  )}
                </p>
                <Link to="/privacy" className="small fw-bold text-decoration-none" style={{ color: "var(--dxn-green-700)" }}>
                  {tx("قراءة سياسة الخصوصية الكاملة ←", "Lire la politique de confidentialité →")}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default FaqTrustPage;
