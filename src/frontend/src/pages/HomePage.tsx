import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import ProductCard, { pickProductImage, pickProductTitle } from "../components/ProductCard";
import ReviewCard from "../components/ReviewCard";
import SeoHead from "../components/SeoHead";
import { useLanguage } from "../context/LanguageContext";
import { useSiteSettings } from "../context/SiteSettingsContext";
import { usePublicContent } from "../hooks/usePublicContent";
import { STORE_EMAIL } from "../config/site";

const HomePage: React.FC = () => {
  const { language } = useLanguage();
  const { settings } = useSiteSettings();
  const { articles, faqs } = usePublicContent();
  const [products, setProducts] = useState<any[]>([]);
  const [offers, setOffers] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [openFaqIndex, setOpenFaqIndex] = useState<number>(0);

  const tx = (ar: string, fr: string) => (language === "ar" ? ar : fr);

  useEffect(() => {
    let active = true;
    const loadHomeData = async () => {
      try {
        setLoading(true);
        const [productsRes, offersRes, reviewsRes] = await Promise.all([
          api.get(`/products?language=${language}`),
          api.get("/offers").catch(() => ({ data: { data: [] } })),
          api.get("/reviews?limit=3").catch(() => ({ data: { data: [] } })),
        ]);
        if (!active) return;
        setProducts(productsRes.data?.data || []);
        setOffers(offersRes.data?.data || []);
        setReviews(reviewsRes.data?.data || []);
      } catch {
        // Keep clean empty states on transient error
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadHomeData();
    return () => {
      active = false;
    };
  }, [language]);

  const featuredProducts = products.filter((p) => p.isFeatured);
  const displayProducts = (featuredProducts.length > 0 ? featuredProducts : products).slice(0, 8);
  const heroProductWithGenuinePhoto = displayProducts.find((p) => Boolean(pickProductImage(p)));

  const categories = [
    {
      slug: "all",
      title: tx("الكل", "Tous les produits"),
      desc: tx("استعرض كامل تشكيلة المنتجات المتوفرة حالياً في المتجر.", "Parcourez l'ensemble des produits actuellement disponibles."),
      badge: "DXN",
    },
    {
      slug: "supplements",
      title: tx("المكملات الغذائية", "Compléments alimentaires"),
      desc: tx("مكملات غذائية لدعم النظام الغذائي المتوازن وفق إرشادات العبوة الرسمية.", "Compléments nutritionnels pour accompagner une alimentation équilibrée."),
      badge: tx("تغذية", "Nutrition"),
    },
    {
      slug: "cosmetics",
      title: tx("الكوسميتيك", "Cosmétiques & Soins"),
      desc: tx("منتجات العناية بالبشرة والعناية الشخصية للاستخدام الظاهري اليومي.", "Soins cosmétiques et produits d'hygiène pour l'usage externe quotidien."),
      badge: tx("عناية", "Soins"),
    },
    {
      slug: "beverages",
      title: tx("المشروبات والقهوة", "Boissons & Cafés"),
      desc: tx("مشروبات يومية ساخنة وباردة بنكهات مميزة.", "Boissons chaudes et froides savoureuses pour le quotidien."),
      badge: tx("مشروبات", "Boissons"),
    },
  ];

  const whyPillars = [
    {
      title: tx("تأسيس عريق منذ 1993", "Fondée en Malaisie en 1993"),
      body: tx(
        "انطلقت شركة DXN من ماليزيا وتوسعت عبر شبكة توزيع دولية منظمة في عشرات الأسواق.",
        "Née en Malaisie en 1993, DXN s'est développée à travers un réseau international structuré."
      ),
    },
    {
      title: tx("تنوع فئات المنتجات", "Gamme de produits diversifiée"),
      body: tx(
        "مكملات غذائية، مشروبات يومية، ومنتجات كوسميتيك وعناية شخصية تلبي احتياجات الأسرة.",
        "Compléments alimentaires, boissons quotidiennes et soins cosmétiques adaptés au quotidien."
      ),
    },
    {
      title: tx("تكامل الزراعة والتصنيع", "Production intégrée « One Dragon »"),
      body: tx(
        "إشراف متكامل من الزراعة والمعالجة إلى التعبئة والتغليف لضمان ثبات المواصفات.",
        "Maîtrise des étapes de culture, transformation et conditionnement au sein du groupe."
      ),
    },
    {
      title: tx("تثقيف مسؤول وشفاف", "Information responsable et conforme"),
      body: tx(
        "نقدم شرحاً علمياً متزناً للمكونات وطريقة الاستخدام دون أي مبالغات أو ادعاءات طبية.",
        "Une approche éducative rigoureuse sans aucune promesse médicale exagérée."
      ),
    },
  ];

  const businessSteps = [
    {
      num: "01",
      title: tx("تعرّف على المنتجات والشركة", "Découvrir l'entreprise et les produits"),
      body: tx("اطلع على تاريخ DXN ومكونات منتجاتها والفرق الواضح بين التسوق كعميل والعمل كعضو.", "Comprenez l'histoire de DXN, ses produits et la distinction entre client et distributeur."),
    },
    {
      num: "02",
      title: tx("أرسل طلب الانضمام عبر المنصة", "Envoyer une demande d'accompagnement"),
      body: tx("عبّئ نموذج الانضمام ليتواصل معك فريق DXN للحياة الطبيعية عبر وسيلتك المفضلة دون أي التزام مسبق.", "Remplissez le formulaire pour être recontacté par notre équipe via votre canal préféré."),
    },
    {
      num: "03",
      title: tx("الإرشاد والتسجيل الرسمي", "Orientation et inscription officielle"),
      body: tx("نرافقك خطوة بخطوة في إجراءات التسجيل الرسمي الصحيح وشرح نظام النقاط (PV).", "Accompagnement personnalisé pour effectuer votre inscription officielle et comprendre les points PV."),
    },
    {
      num: "04",
      title: tx("التدريب وبناء النشاط بمسؤولية", "Formation et développement progressif"),
      body: tx("النتائج تعتمد على المبيعات الفعلية للمنتجات والمتابعة المستمرة دون وعود بأرباح تلقائية.", "Le développement repose sur les ventes réelles et la formation continue, sans promesse de gain automatique."),
    },
  ];

  const previewArticles = articles.slice(0, 3);
  const previewFaqs = faqs.slice(0, 4);

  const orgJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: settings.brandName || "DXN Natural Life",
    url: "https://dxnnadz.vercel.app/",
    email: settings.contactEmail || STORE_EMAIL,
    description: tx(
      "منصة DXN للحياة الطبيعية للتسوق المباشر، التثقيف الموثوق بالمنتجات، والانضمام إلى فريق البيع المباشر.",
      "Plateforme DXN Natural Life — Boutique, éducation produits et accompagnement d'équipe."
    ),
  };

  return (
    <div className="dxn-page">
      <SeoHead
        title={tx("DXN للحياة الطبيعية — اكتشف عالم DXN", "DXN Natural Life — Découvrez l'univers DXN")}
        description={tx(
          "اكتشف عالم DXN مع منصة DXN للحياة الطبيعية: منتجات متنوعة، معرفة موثوقة، وفرصة لتطوير نشاطك التجاري مع التوصيل عبر ولايات الجزائر (69 ولاية — حسب تغطية التوصيل).",
          "Découvrez l'univers DXN avec DXN Natural Life : produits variés, savoir fiable et opportunité de développer votre activité à travers les 69 wilayas d'Algérie."
        )}
        canonicalPath="/"
        jsonLd={orgJsonLd}
      />

      {/* 1. HERO BANNER (Phase 2.1) */}
      <section className="dxn-hero">
        <div className="container dxn-hero-inner">
          <div className="row align-items-center g-4">
            <div className="col-lg-7">
              <span className="dxn-hero-eyebrow">
                <span aria-hidden="true">✦</span>
                {settings.brandName || "DXN Natural Life"} — {tx("منصة التسوق والمعرفة والفريق", "Boutique • Savoir • Équipe")}
              </span>
              <h1>{tx("اكتشف عالم DXN", "Découvrez l'univers DXN")}</h1>
              <p className="dxn-hero-lead">
                {tx(
                  "منتجات متنوعة، معرفة موثوقة، وفرصة لتطوير نشاطك التجاري.",
                  "Des produits variés, une information fiable et une opportunité structurée pour développer votre activité commerciale."
                )}
              </p>
              <div className="dxn-hero-cta">
                <Link to="/products" className="dxn-btn dxn-btn-gold dxn-btn-lg">
                  {tx("اكتشف المنتجات", "Découvrir les produits")}
                </Link>
                <Link to="/join" className="dxn-btn dxn-btn-ghost dxn-btn-lg">
                  {tx("انضم إلى فريقنا", "Rejoindre notre équipe")}
                </Link>
              </div>
              <div className="mt-4 d-flex flex-wrap gap-3 small" style={{ color: "rgba(255,255,255,0.86)" }}>
                <span>✓ {tx("شراء مباشر بدون اشتراط عضوية", "Achat libre sans adhésion obligatoire")}</span>
                <span>✓ {tx("الدفع نقداً عند الاستلام", "Paiement à la livraison")}</span>
                <span>✓ {tx("محتوى تثقيفي مسؤول وموثوق", "Contenu éducatif conforme")}</span>
              </div>
            </div>

            <div className="col-lg-5">
              <div className="dxn-hero-showcase">
                {heroProductWithGenuinePhoto ? (
                  <div className="text-center">
                    <img
                      src={pickProductImage(heroProductWithGenuinePhoto)}
                      alt={pickProductTitle(heroProductWithGenuinePhoto, language)}
                      className="dxn-hero-showcase-img mb-3"
                    />
                    <div className="small text-uppercase fw-bold" style={{ color: "#fce588" }}>
                      {tx("من تشكيلة المتجر الأصلية", "Sélection officielle en boutique")}
                    </div>
                    <h2 className="h5 fw-bold text-white mt-1 mb-2">
                      {pickProductTitle(heroProductWithGenuinePhoto, language)}
                    </h2>
                    <Link
                      to={`/product/${encodeURIComponent(heroProductWithGenuinePhoto.slug)}`}
                      className="dxn-btn dxn-btn-light btn-sm"
                    >
                      {tx("عرض تفاصيل المنتج", "Voir la fiche produit")}
                    </Link>
                  </div>
                ) : (
                  <div>
                    <div className="small fw-bold mb-2" style={{ color: "#fce588" }}>
                      {settings.brandName || "DXN Natural Life"}
                    </div>
                    <h2 className="h4 fw-bold text-white mb-3">
                      {tx("منصة متكاملة للتسوق والتثقيف وبناء الفريق", "Une plateforme complète : Produits, Éducation & Réseau")}
                    </h2>
                    <ul className="list-unstyled mb-0 d-grid gap-2 small" style={{ color: "rgba(255,255,255,0.9)" }}>
                      <li>• {tx("تسوّق المكملات الغذائية والكوسميتيك بأسعار واضحة", "Commandez compléments et cosmétiques en toute clarté")}</li>
                      <li>• {tx("حقل اختياري لإدخال رقم عضويتك الحالية عند الطلب", "Champ optionnel pour votre numéro de membre DXN au paiement")}</li>
                      <li>• {tx("مركز معرفة علمي يشرح المكونات وطريقة الحفظ والاستخدام", "Centre éducatif détaillant ingrédients, usage et conservation")}</li>
                      <li>• {tx("مرافقة شخصية للراغبين في الانضمام إلى فريق DXN للحياة الطبيعية", "Accompagnement personnalisé pour rejoindre l'équipe DXN Natural Life")}</li>
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. FEATURED PRODUCTS SECTION */}
      <section className="dxn-section">
        <div className="container">
          <div className="d-flex flex-wrap justify-content-between align-items-end mb-4 gap-2">
            <div>
              <span className="dxn-section-eyebrow">{tx("المتجر الإلكتروني", "Boutique en ligne")}</span>
              <h2 className="dxn-section-title mb-1">{tx("منتجات مختارة من DXN", "Produits DXN à découvrir")}</h2>
              <p className="dxn-section-sub mb-0">
                {tx("اطلب مباشرة بدون الحاجة لعضوية، مع إمكانية إضافة رقم عضويتك اختيارياً عند الدفع.", "Commandez directement sans obligation d'adhésion, avec paiement à la livraison.")}
              </p>
            </div>
            <Link to="/products" className="dxn-btn dxn-btn-outline">
              {tx("عرض كل المنتجات", "Voir tout le catalogue")}
            </Link>
          </div>

          {loading ? (
            <div className="row g-3 g-md-4">
              {Array.from({ length: 4 }).map((_, idx) => (
                <div key={idx} className="col-6 col-md-4 col-lg-3">
                  <div className="dxn-skeleton-card">
                    <div className="dxn-skeleton dxn-skeleton-media" />
                    <div className="p-3">
                      <div className="dxn-skeleton dxn-skeleton-line sm" />
                      <div className="dxn-skeleton dxn-skeleton-line lg" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : displayProducts.length === 0 ? (
            <div className="dxn-empty">
              <h3>{tx("تشكيلة المنتجات قيد التحديث", "Catalogue en cours de mise à jour")}</h3>
              <p className="mb-3">
                {tx(
                  "تُعرض هنا المنتجات الأصلية المعتمدة فور تفعيلها من إدارة المتجر. يمكنك التواصل معنا للاستفسار عن التوفر الحالي.",
                  "Les produits officiels s'affichent ici dès leur activation par l'administration. Contactez-nous pour toute demande."
                )}
              </p>
              <Link to="/contact" className="dxn-btn dxn-btn-primary">
                {tx("تواصل معنا للاستفسار", "Nous contacter")}
              </Link>
            </div>
          ) : (
            <div className="row g-3 g-md-4">
              {displayProducts.map((product: any) => (
                <div key={product._id} className="col-6 col-md-4 col-lg-3">
                  <ProductCard product={product} language={language} />
                </div>
              ))}
            </div>
          )}

          {offers.length > 0 && (
            <div className="mt-4 pt-2">
              <div className="row g-3">
                {offers.slice(0, 2).map((offer: any) => (
                  <div key={offer._id} className="col-md-6">
                    <div className="dxn-offer-card">
                      <div>
                        <span className="dxn-offer-badge">
                          {offer.type === "percentage" ? `-${offer.value}%` : `-${offer.value} DA`}
                        </span>
                        <h3 className="h6 fw-bold mt-2 mb-1">{offer.title}</h3>
                      </div>
                      <Link to="/products" className="dxn-btn dxn-btn-outline btn-sm">
                        {tx("استفد من العرض", "Voir l'offre")}
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 3. PRODUCT CATEGORIES SECTION */}
      <section className="dxn-section dxn-section-alt">
        <div className="container">
          <div className="dxn-section-head">
            <span className="dxn-section-eyebrow">{tx("تصنيفات المتجر", "Catégories")}</span>
            <h2 className="dxn-section-title">{tx("تصفّح حسب الفئة", "Explorer par catégorie")}</h2>
          </div>
          <div className="row g-3 g-md-4">
            {categories.map((cat) => (
              <div key={cat.slug} className="col-sm-6 col-lg-3">
                <Link
                  to={cat.slug === "all" ? "/products" : `/products?category=${cat.slug}`}
                  className="text-decoration-none text-reset d-block h-100"
                >
                  <div className="dxn-info-card d-flex flex-column justify-content-between">
                    <div>
                      <span className="badge rounded-pill mb-2" style={{ background: "#e6f4ec", color: "#0b3d1f" }}>
                        {cat.badge}
                      </span>
                      <h3 className="h5 fw-bold mb-2">{cat.title}</h3>
                      <p className="text-muted small mb-3">{cat.desc}</p>
                    </div>
                    <span className="fw-bold small" style={{ color: "var(--dxn-green-700)" }}>
                      {tx("استعراض الفئة ←", "Voir la catégorie →")}
                    </span>
                  </div>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. WHY DXN SECTION */}
      <section className="dxn-section">
        <div className="container">
          <div className="d-flex flex-wrap justify-content-between align-items-end mb-4 gap-2">
            <div>
              <span className="dxn-section-eyebrow">{tx("القيمة والجودة", "Valeur & Qualité")}</span>
              <h2 className="dxn-section-title mb-0">{tx("لماذا يختار الكثيرون DXN؟", "Pourquoi tant de personnes choisissent DXN ?")}</h2>
            </div>
            <Link to="/why-dxn" className="dxn-btn dxn-btn-outline">
              {tx("تفاصيل أكثر", "En savoir plus")}
            </Link>
          </div>
          <div className="row g-3 g-md-4">
            {whyPillars.map((p, idx) => (
              <div key={idx} className="col-md-6 col-lg-3">
                <div className="dxn-info-card">
                  <div className="dxn-step-num mb-3">{idx + 1}</div>
                  <h3 className="h6 fw-bold mb-2">{p.title}</h3>
                  <p className="text-muted small mb-0">{p.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5 & 6. ABOUT DXN PREVIEW & MEET THE FOUNDER PREVIEW */}
      <section className="dxn-section dxn-section-alt">
        <div className="container">
          <div className="row g-4">
            <div className="col-lg-6">
              <div className="dxn-info-card d-flex flex-column justify-content-between">
                <div>
                  <span className="dxn-section-eyebrow">{tx("نبذة تعريفية", "Présentation")}</span>
                  <h2 className="h4 fw-bold mt-1 mb-3">{tx("من هي شركة DXN؟", "Qui est l'entreprise DXN ?")}</h2>
                  <p className="text-muted" style={{ lineHeight: 1.8 }}>
                    {tx(
                      "تأسست شركة DXN في ماليزيا عام 1993 بولاية قدح (Kedah)، وتُعرف بنموذج «التنين الواحد» (One Dragon) الذي يجمع بين زراعة المواد الخام، التصنيع، التعبئة، والتسويق المباشر ضمن منظومة متكاملة.",
                      "Fondée en 1993 dans l'État de Kedah en Malaisie, DXN s'appuie sur le modèle intégré « One Dragon » couvrant la culture, la transformation industrielle et la distribution internationale."
                    )}
                  </p>
                </div>
                <div className="mt-3">
                  <Link to="/about" className="dxn-btn dxn-btn-primary">
                    {tx("اقرأ قصة شركة DXN", "Découvrir l'histoire de DXN")}
                  </Link>
                </div>
              </div>
            </div>

            <div className="col-lg-6">
              <div className="dxn-info-card d-flex flex-column justify-content-between">
                <div>
                  <span className="dxn-section-eyebrow">{tx("القيادة والتأسيس", "Fondateur")}</span>
                  <h2 className="h4 fw-bold mt-1 mb-3">{tx("تعرّف على مؤسس DXN", "Rencontrez le fondateur de DXN")}</h2>
                  <p className="text-muted" style={{ lineHeight: 1.8 }}>
                    {tx(
                      "أسس داتوك الدكتور ليم سيو جين (Datuk Dr. Lim Siow Jin)، خريج المعهد الهندي للتكنولوجيا (IIT)، شركة DXN عام 1993 بعد اهتمام بحثي طويل باستزراع الفطريات الغذائية وتطوير منتجات استهلاكية ذات جودة منضبطة.",
                      "Diplômé de l'Indian Institute of Technology (IIT), Datuk Dr. Lim Siow Jin a fondé DXN en 1993 avec une vision axée sur la culture contrôlée du Ganoderma et la qualité industrielle."
                    )}
                  </p>
                </div>
                <div className="mt-3">
                  <Link to="/founder" className="dxn-btn dxn-btn-outline">
                    {tx("السيرة الكاملة للمؤسس", "Lire la biographie du fondateur")}
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 7. PRODUCT EDUCATION PREVIEW */}
      <section className="dxn-section">
        <div className="container">
          <div className="d-flex flex-wrap justify-content-between align-items-end mb-4 gap-2">
            <div>
              <span className="dxn-section-eyebrow">{tx("معرفة موثوقة", "Centre éducatif")}</span>
              <h2 className="dxn-section-title mb-1">{tx("مركز التثقيف بالمنتجات والمكونات", "Comprendre les ingrédients et le bon usage")}</h2>
              <p className="dxn-section-sub mb-0">
                {tx("مقالات علمية متوازنة تفصل بوضوح بين الحقائق الغذائية المثبتة والاستخدامات التقليدية وطريقة الحفظ.", "Guides éducatifs distinguant données nutritionnelles établies, usages traditionnels et conseils de conservation.")}
              </p>
            </div>
            <Link to="/education" className="dxn-btn dxn-btn-primary">
              {tx("تصفّح مركز المعرفة", "Accéder au centre éducatif")}
            </Link>
          </div>

          <div className="row g-3 g-md-4">
            {previewArticles.map((art) => {
              const loc = language === "ar" ? art.ar : art.fr;
              return (
                <div key={art.slug} className="col-md-4">
                  <div className="dxn-info-card d-flex flex-column justify-content-between">
                    <div>
                      <span className="dxn-evidence-badge science">
                        {tx("دليل تثقيفي", "Guide éducatif")} • {art.readingMinutes} {tx("دقائق", "min")}
                      </span>
                      <h3 className="h5 fw-bold mb-2">{loc.title}</h3>
                      <p className="text-muted small mb-3">{loc.summary}</p>
                    </div>
                    <Link
                      to={`/education/${encodeURIComponent(art.slug)}`}
                      className="fw-bold small text-decoration-none"
                      style={{ color: "var(--dxn-green-700)" }}
                    >
                      {tx("اقرأ المقال كاملاً ←", "Lire l'article complet →")}
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="dxn-compliance-banner mt-4">
            <strong>{tx("تنبيه صحي:", "Note sanitaire :")}</strong>{" "}
            {tx(
              "جميع المكملات الغذائية المعروضة هي منتجات غذائية لدعم نمط الحياة المتوازن وليست أدوية طبية، ولا تُستخدم لتشخيص أو علاج أو الوقاية من الأمراض.",
              "Les compléments alimentaires présentés ne sont pas des médicaments et ne remplacent ni une alimentation équilibrée ni un avis médical."
            )}
          </div>
        </div>
      </section>

      {/* 8. HOW DXN BUSINESS WORKS */}
      <section className="dxn-section dxn-section-alt">
        <div className="container">
          <div className="dxn-section-head">
            <span className="dxn-section-eyebrow">{tx("فرصة العمل المنظم", "Modèle d'activité")}</span>
            <h2 className="dxn-section-title">{tx("كيف يعمل نظام العمل والعضوية في DXN؟", "Comment fonctionne l'activité DXN ?")}</h2>
            <p className="dxn-section-sub">
              {tx(
                "شرح شفاف وواقعي لنموذج البيع المباشر خطوة بخطوة دون أي مبالغات.",
                "Une présentation claire et transparente du fonctionnement de la vente directe."
              )}
            </p>
          </div>
          <div className="row g-3 g-md-4">
            {businessSteps.map((s) => (
              <div key={s.num} className="col-sm-6 col-lg-3">
                <div className="dxn-step-card">
                  <div className="dxn-step-num">{s.num}</div>
                  <h3>{s.title}</h3>
                  <p>{s.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 9. JOIN OUR TEAM BANNER */}
      <section className="dxn-section">
        <div className="container">
          <div className="dxn-cta-band">
            <h2 className="mb-2">{tx("انضم إلى فريق DXN للحياة الطبيعية", "Rejoignez l'équipe DXN Natural Life")}</h2>
            <p className="mb-4">
              {tx(
                "سواء كنت ترغب في التعرف على نظام العضوية أو بدء نشاطك التجاري في البيع المباشر بمرافقة وتدريب مستمر، سيسعد فريقنا بالتواصل معك والإجابة عن جميع استفساراتك.",
                "Vous souhaitez comprendre les avantages membres ou développer une activité de vente directe encadrée ? Notre équipe vous accompagne étape par étape."
              )}
            </p>
            <div className="d-flex flex-wrap justify-content-center gap-3">
              <Link to="/join" className="dxn-btn dxn-btn-gold dxn-btn-lg">
                {tx("قدّم طلب الانضمام الآن", "Remplir le formulaire d'adhésion")}
              </Link>
              <Link to="/faq" className="dxn-btn dxn-btn-ghost dxn-btn-lg">
                {tx("اطلع على الأسئلة الشائعة", "Consulter la FAQ")}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 10. FREQUENTLY ASKED QUESTIONS PREVIEW */}
      <section className="dxn-section dxn-section-alt">
        <div className="container">
          <div className="d-flex flex-wrap justify-content-between align-items-end mb-4 gap-2">
            <div>
              <span className="dxn-section-eyebrow">{tx("إجابات واضحة", "Questions fréquentes")}</span>
              <h2 className="dxn-section-title mb-0">{tx("الأسئلة الشائعة", "Questions fréquemment posées")}</h2>
            </div>
            <Link to="/faq" className="dxn-btn dxn-btn-outline">
              {tx("كل الأسئلة الشائعة", "Voir toutes les questions")}
            </Link>
          </div>
          <div className="d-grid gap-3">
            {previewFaqs.map((item, idx) => {
              const loc = language === "ar" ? item.ar : item.fr;
              const isOpen = openFaqIndex === idx;
              return (
                <div key={item.slug} className="bg-white border rounded-3 p-3 shadow-xs">
                  <button
                    type="button"
                    className="btn w-100 text-start d-flex justify-content-between align-items-center p-0 fw-bold"
                    onClick={() => setOpenFaqIndex(isOpen ? -1 : idx)}
                    aria-expanded={isOpen}
                  >
                    <span>{loc.question}</span>
                    <span style={{ color: "var(--dxn-green-700)", fontSize: "1.25rem" }}>
                      {isOpen ? "−" : "+"}
                    </span>
                  </button>
                  {isOpen && (
                    <p className="text-muted mb-0 mt-3 pt-2 border-top" style={{ lineHeight: 1.75 }}>
                      {loc.answer}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 11. CUSTOMER TESTIMONIALS (GENUINE AUTHORIZED ONLY — Phase 2.2 #11) */}
      <section className="dxn-section">
        <div className="container">
          <div className="dxn-section-head">
            <span className="dxn-section-eyebrow">{tx("تجارب العملاء", "Avis vérifiés")}</span>
            <h2 className="dxn-section-title">{tx("آراء وتقييمات العملاء", "Témoignages de nos clients")}</h2>
          </div>
          {reviews.length > 0 ? (
            <div className="row g-3 g-md-4">
              {reviews.slice(0, 3).map((rev: any) => (
                <div key={rev._id} className="col-md-4">
                  <ReviewCard review={rev} />
                </div>
              ))}
            </div>
          ) : (
            <div className="dxn-info-card text-center py-4">
              <p className="mb-1 fw-bold">
                {tx(
                  "نلتزم بعرض التقييمات الحقيقية والمعتمدة من عملائنا الفعليين فقط.",
                  "Nous publions exclusivement des avis authentiques vérifiés de clients réels."
                )}
              </p>
              <p className="text-muted small mb-0">
                {tx(
                  "لا نستخدم أي شهادات أو مراجعات مصطنعة حفاظاً على المصداقية والشفافية.",
                  "Aucun témoignage fictif n'est affiché afin de garantir une transparence totale."
                )}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* 12. CONTACT SECTION */}
      <section className="dxn-section dxn-section-alt">
        <div className="container">
          <div className="row align-items-center g-4">
            <div className="col-lg-7">
              <span className="dxn-section-eyebrow">{tx("نحن في خدمتك", "À votre écoute")}</span>
              <h2 className="dxn-section-title mb-2">{tx("هل لديك استفسار حول المنتجات أو الانضمام؟", "Une question sur nos produits ou l'équipe ?")}</h2>
              <p className="text-muted mb-3">
                {tx(
                  "تواصل مباشرة مع فريق DXN للحياة الطبيعية عبر نموذج المراسلة السريع أو البريد الإلكتروني الرسمي، وسنرد عليك في أقرب وقت.",
                  "Écrivez directement à l'équipe DXN Natural Life via notre formulaire de contact ou par e-mail."
                )}
              </p>
              <div className="small text-muted">
                <strong>{tx("البريد الإلكتروني الرسمي:", "Email officiel :")}</strong>{" "}
                <a href={`mailto:${settings.contactEmail || STORE_EMAIL}`}>
                  {settings.contactEmail || STORE_EMAIL}
                </a>
              </div>
            </div>
            <div className="col-lg-5 text-lg-end">
              <div className="d-flex flex-wrap gap-3 justify-content-lg-end">
                <Link to="/contact" className="dxn-btn dxn-btn-primary dxn-btn-lg">
                  {tx("أرسل رسالة الآن", "Envoyer un message")}
                </Link>
                {settings.whatsappUrl && (
                  <a
                    href={settings.whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="dxn-btn dxn-btn-outline dxn-btn-lg"
                  >
                    {tx("تواصل عبر واتساب", "WhatsApp direct")}
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
