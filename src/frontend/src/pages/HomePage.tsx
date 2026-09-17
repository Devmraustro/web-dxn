import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { Container, Row, Col } from "react-bootstrap";
import { useLanguage } from "../context/LanguageContext";
import ProductCard, {
  pickProductTitle,
  pickProductDescription,
  pickProductImage,
} from "../components/ProductCard";
import { STORE_EMAIL, STORE_EMAIL_MAILTO } from "../config/site";

const MAX_FEATURED = 8;
const MAX_HERO_SHOTS = 3;
// A real product-image collage only makes sense once there is a small genuine
// collection (>= 2 distinct images). A single upload-test image is not a
// collection, so the elegant abstract DXN panel is preferred instead.
const MIN_HERO_SHOTS = 2;

const PinIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

const CardIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
    <line x1="1" y1="10" x2="23" y2="10" />
  </svg>
);

const ShieldIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const CheckIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const SparkIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3l1.9 5.8a2 2 0 0 0 1.3 1.3L21 12l-5.8 1.9a2 2 0 0 0-1.3 1.3L12 21l-1.9-5.8a2 2 0 0 0-1.3-1.3L3 12l5.8-1.9a2 2 0 0 0 1.3-1.3z" />
  </svg>
);

const LeafIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z" />
    <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
  </svg>
);

const TruckIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="1" y="3" width="15" height="13" rx="1" />
    <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
    <circle cx="5.5" cy="18.5" r="2.5" />
    <circle cx="18.5" cy="18.5" r="2.5" />
  </svg>
);

const BagIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
    <line x1="3" y1="6" x2="21" y2="6" />
    <path d="M16 10a4 4 0 0 1-8 0" />
  </svg>
);

const HomePage = () => {
  const { language } = useLanguage();
  const [products, setProducts] = useState<any[]>([]);
  const [offers, setOffers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const t = (ar: string, fr: string) => (language === "ar" ? ar : fr);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [productsRes, offersRes] = await Promise.all([
          axios.get(`/api/products?language=${language}`),
          axios.get("/api/offers"),
        ]);
        if (cancelled) return;
        setProducts(Array.isArray(productsRes.data?.data) ? productsRes.data.data : []);
        const rawOffers = Array.isArray(offersRes.data?.data) ? offersRes.data.data : [];
        // Only real, currently-enabled offers that still reference a public item.
        setOffers(rawOffers.filter((offer: any) => offer && offer.relatedEntity));
      } catch (err) {
        if (cancelled) return;
        console.error("Error loading home data:", err);
        setError("Failed to load home data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [language]);

  const featured = useMemo(() => {
    if (products.length === 0) return [];
    const flagged = products.filter((p) => p.isFeatured);
    // Real "featured" data when the admin has flagged products; otherwise the
    // section is still genuine catalog data, just labeled as "our products".
    const base = (flagged.length > 0 ? flagged : products).slice(0, MAX_FEATURED);
    return base;
  }, [products]);

  // Hero visuals come from the real, publicly-listed product images (max 3,
  // de-duplicated). No stock photos, no invented products.
  const heroShots = useMemo(() => {
    const seen = new Set<string>();
    const out: any[] = [];
    for (const product of products) {
      const img = pickProductImage(product);
      if (!img || seen.has(img)) continue;
      seen.add(img);
      out.push(product);
      if (out.length >= MAX_HERO_SHOTS) break;
    }
    return out.length >= MIN_HERO_SHOTS ? out : [];
  }, [products]);

  const realOffer = offers[0] || null;

  const singleProduct = featured.length === 1 ? featured[0] : null;
  const singleTitle = singleProduct ? pickProductTitle(singleProduct, language) : "";
  const singleDesc = singleProduct ? pickProductDescription(singleProduct, language) : "";
  const singlePrice = singleProduct ? Number(singleProduct.price) || 0 : 0;
  const singleCompare = singleProduct ? Number(singleProduct.compareAtPrice) || 0 : 0;
  const singleSlug = singleProduct?.slug ?? "";

  if (loading) {
    return (
      <div className="dxn-loading" role="status" aria-live="polite">
        <div className="dxn-loading-ring"></div>
        <div>{t("جارٍ تحميل الصفحة الرئيسية...", "Chargement de la page d'accueil...")}</div>
      </div>
    );
  }

  return (
    <>
      {/* C — Hero (A announcement bar and B header live in Header.tsx) */}
      <section className="dxn-hero dxn-hero-home dxn-anim-fade-up">
        <div className="dxn-hero-grid">
          <div className="dxn-hero-inner">
            <span className="dxn-hero-kicker">
              {t("مكملات غذائية طبيعية من DXN", "Compléments alimentaires naturels DXN")}
            </span>
            <h1 className="dxn-hero-title">
              {language === "ar" ? (
                <>
                  منتجات DXN الطبيعية
                  <span className="dxn-hero-gold"> توصلكم إلى كل الولايات</span>
                </>
              ) : (
                <>
                  Des produits naturellement DXN,{" "}
                  <span className="dxn-hero-gold">livrés dans les 69 wilayas</span>
                </>
              )}
            </h1>
            <p className="dxn-hero-text">
              {t(
                "اكتشف تشكيلة DXN من المكملات الغذائية والقَهوة. توصيل إلى جميع ولايات الجزائر، الدفع عند الاستلام وتأكيد الطلب عبر الهاتف.",
                "Découvrez la gamme DXN de compléments alimentaires et de cafés. Livraison vers toutes les wilayas d'Algérie, paiement à la livraison et confirmation par téléphone."
              )}
            </p>
            <div className="dxn-hero-cta">
              <Link to="/products" className="dxn-btn dxn-btn-gold">
                {t("تصفح المنتجات", "Parcourir les produits")}
              </Link>
              <a href="#how-to-order" className="dxn-btn dxn-btn-outline-light">
                {t("كيفية الطلب", "Comment commander")}
              </a>
            </div>
          </div>

          <div className="dxn-hero-visuals" aria-hidden="true">
            {heroShots.length > 0 ? (
              <div className="dxn-hero-collage">
                {heroShots.map((product, i) =>
                  product.slug ? (
                    <Link
                      key={product._id}
                      to={`/product/${encodeURIComponent(product.slug)}`}
                      className="dxn-hero-shot"
                      tabIndex={-1}
                    >
                      <img
                        src={pickProductImage(product)}
                        alt=""
                        loading={i === 0 ? "eager" : "lazy"}
                      />
                    </Link>
                  ) : (
                    <div key={product._id} className="dxn-hero-shot">
                      <img src={pickProductImage(product)} alt="" loading="lazy" />
                    </div>
                  )
                )}
              </div>
            ) : (
              <div className="dxn-hero-pattern">
                <span className="dxn-hero-pattern-brand">DXN</span>
              </div>
            )}
            <span className="dxn-hero-pill">
              <PinIcon />
              {t("توصيل إلى 69 ولاية", "Livraison en 69 wilayas")}
            </span>
          </div>
        </div>
      </section>

      <Container>
        {/* D — Trust strip (3 real store commitments) */}
        <section className="dxn-trust" aria-label={t("مزايا المتجر", "Nos garanties")}>
          <div className="dxn-trust-item">
            <div className="dxn-trust-icon">
              <PinIcon />
            </div>
            <div>
              <div className="dxn-trust-title">{t("التوصيل إلى 69 ولاية", "Livraison en 69 wilayas")}</div>
              <div className="dxn-trust-sub">{t("إلى جميع ولايات الجزائر", "Partout en Algérie")}</div>
            </div>
          </div>
          <div className="dxn-trust-item">
            <div className="dxn-trust-icon gold">
              <CardIcon />
            </div>
            <div>
              <div className="dxn-trust-title">{t("الدفع عند الاستلام", "Paiement à la livraison")}</div>
              <div className="dxn-trust-sub">{t("ادفع عند وصول طلبك", "Payez à la réception")}</div>
            </div>
          </div>
          <div className="dxn-trust-item">
            <div className="dxn-trust-icon">
              <ShieldIcon />
            </div>
            <div>
              <div className="dxn-trust-title">{t("متجر متخصص في منتجات DXN", "Boutique spécialisée DXN")}</div>
              <div className="dxn-trust-sub">{t("كتالوج حقيقي مُدار من المتجر", "Catalogue réel géré par la boutique")}</div>
            </div>
          </div>
        </section>

        {error ? (
          <div className="dxn-feedback-error p-3 mt-4" role="alert">
            {t(
              "تعذر تحميل الكتالوج حالياً. يرجى المحاولة لاحقاً.",
              "Impossible de charger le catalogue pour le moment. Veuillez réessayer."
            )}
          </div>
        ) : (
          <>
            {/* F — Featured products (real catalog, honor stock status) */}
            <section className="mt-5" aria-labelledby="home-featured-title">
              <div className="d-flex align-items-center gap-3 flex-wrap mb-3">
                <div>
                  <span className="dxn-chip">{language === "ar" ? "التشكيلة" : "La gamme"}</span>
                  <h2 className="dxn-section-title h3" id="home-featured-title">
                    {products.some((p) => p.isFeatured)
                      ? t("منتجات مميزة", "Produits en vedette")
                      : t("منتجاتنا", "Nos produits")}
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
                    <SparkIcon />
                  </div>
                  <p className="mb-1">
                    {t(
                      "نعمل حالياً على تحضير الكتالوج.",
                      "Nous préparons actuellement le catalogue."
                    )}
                  </p>
                  <p className="mb-3">
                    {t(
                      "يمكنك التواصل معنا مباشرة عبر البريد الإلكتروني لأي استفسار.",
                      "Vous pouvez nous contacter directement par e-mail pour toute question."
                    )}
                  </p>
                  <a href={STORE_EMAIL_MAILTO} className="dxn-btn dxn-btn-outline">
                    {t("راسلنا الآن", "Contactez-nous")}
                  </a>
                </div>
              ) : singleProduct ? (
                /* One product: intentional split composition (product + info
                   panel). It never stretches into a lone floating card. */
                <div className="dxn-featured-single dxn-anim-fade-up">
                  <div className="dxn-single-card">
                    <ProductCard product={singleProduct} language={language} />
                  </div>
                  <aside className="dxn-single-info">
                    <span className="dxn-chip dxn-chip-gold">
                      {t("منتج مميز", "Produit vedette")}
                    </span>
                    <h3 className="dxn-single-title">{singleTitle}</h3>
                    {singleDesc && <p className="dxn-single-desc">{singleDesc}</p>}
                    {singlePrice > 0 && (
                      <div className="dxn-single-price">
                        <span className="dxn-single-price-now">
                          {singlePrice.toLocaleString("fr-DZ")} DA
                        </span>
                        {singleCompare > singlePrice && (
                          <span className="dxn-single-price-old">
                            {singleCompare.toLocaleString("fr-DZ")} DA
                          </span>
                        )}
                      </div>
                    )}
                    <ul className="dxn-single-points">
                      <li>
                        {t("السعر معروض بوضوح بالدينار الجزائري.", "Prix clair en dinars algériens.")}
                      </li>
                      <li>
                        {t("توصيل إلى ولايات الجزائر الـ 69.", "Livraison dans les 69 wilayas d'Algérie.")}
                      </li>
                      <li>
                        {t("الدفع عند الاستلام.", "Paiement à la livraison.")}
                      </li>
                    </ul>
                    <Link
                      to={singleSlug ? `/product/${encodeURIComponent(singleSlug)}` : "/products"}
                      className="dxn-btn dxn-btn-outline-light dxn-single-cta"
                    >
                      {t("عرض المنتج", "Voir le produit")}
                    </Link>
                  </aside>
                </div>
              ) : (
                <Row>
                  {featured.map((product, index) => (
                    <Col key={product._id} xs={12} sm={6} lg={4} xl={3} className="mb-4 d-flex">
                      <div className={`w-100 dxn-anim-fade-up dxn-stagger-${(index % 6) + 1}`}>
                        <ProductCard product={product} language={language} />
                      </div>
                    </Col>
                  ))}
                </Row>
              )}
            </section>

            {/* G1 — Real-offer band (only real offers linked to a public item) */}
            {realOffer && (
              <section className="dxn-promo dxn-anim-fade-up" aria-labelledby="home-promo-title">
                <div className="dxn-promo-content">
                  <span className="dxn-promo-chip">
                    {realOffer.type === "percentage"
                      ? `-${realOffer.value}%`
                      : realOffer.type === "fixed"
                        ? `-${realOffer.value} DA`
                        : t("عرض", "Offre")}
                  </span>
                  <h3 className="dxn-promo-title" id="home-promo-title">
                    {realOffer.title || t("عرض حقيقي من متجر DXN", "Offre réelle de la boutique DXN")}
                  </h3>
                  <p className="dxn-promo-text">
                    {t(
                      "عرض فعلي على أحد منتجات التشكيلة. الأسعار تُحدَّث من لوحة التحكم.",
                      "Une offre réelle sur un produit de la gamme. Prix mis à jour depuis le tableau de bord."
                    )}
                  </p>
                  <Link to="/products" className="dxn-btn dxn-btn-gold">
                    {t("تصفح المنتجات", "Voir les produits")}
                  </Link>
                </div>
              </section>
            )}

            {/* G — DXN brand / discovery (no fake categories) */}
            <section className="dxn-brand-discovery dxn-anim-fade-up" aria-labelledby="home-discovery-title">
              <div className="dxn-discovery-head">
                <span className="dxn-chip">
                  {t("اكتشف عالم DXN", "Découvrez l'univers DXN")}
                </span>
                <h2 className="dxn-section-title h3 mb-0" id="home-discovery-title">
                  {t("متجر متخصص في منتجات DXN", "Une boutique spécialisée dans les produits DXN")}
                </h2>
                <p className="dxn-discovery-lead">
                  {t(
                    "نقدّم لكم منتجات DXN الحقيقية: تشكيلة متاحة فعلياً، توصيل إلى جميع ولايات الجزائر، وطلب سهل مع الدفع عند الاستلام.",
                    "Nous vous proposons les véritables produits DXN : une gamme réellement disponible, une livraison vers toutes les wilayas d'Algérie et une commande simple avec paiement à la livraison."
                  )}
                </p>
              </div>
              <div className="dxn-discovery-grid">
                <div className="dxn-discovery-item">
                  <span className="dxn-discovery-icon">
                    <LeafIcon />
                  </span>
                  <h3 className="dxn-discovery-title">
                    {t("معلومات واضحة عن المنتجات", "Informations claires sur les produits")}
                  </h3>
                  <p className="dxn-discovery-text">
                    {t(
                      "اسم المنتج ووصفه ومواصفاته تظهر في بطاقته قبل الشراء.",
                      "Le nom, la description et les caractéristiques sont affichés avant l'achat."
                    )}
                  </p>
                </div>
                <div className="dxn-discovery-item">
                  <span className="dxn-discovery-icon gold">
                    <TruckIcon />
                  </span>
                  <h3 className="dxn-discovery-title">
                    {t("التوصيل عبر الجزائر", "Livraison à travers l'Algérie")}
                  </h3>
                  <p className="dxn-discovery-text">
                    {t(
                      "التوصيل متاح إلى ولايات الجزائر الـ 69.",
                      "La livraison est disponible vers les 69 wilayas."
                    )}
                  </p>
                </div>
                <div className="dxn-discovery-item">
                  <span className="dxn-discovery-icon">
                    <BagIcon />
                  </span>
                  <h3 className="dxn-discovery-title">
                    {t("الطلب بسهولة", "Commander en toute simplicité")}
                  </h3>
                  <p className="dxn-discovery-text">
                    {t(
                      "اختر المنتج، أضفه إلى السلة، وأدخل معلومات التوصيل.",
                      "Choisissez le produit, ajoutez-le au panier et renseignez la livraison."
                    )}
                  </p>
                </div>
                <div className="dxn-discovery-item">
                  <span className="dxn-discovery-icon gold">
                    <CardIcon />
                  </span>
                  <h3 className="dxn-discovery-title">
                    {t("الدفع عند الاستلام", "Paiement à la livraison")}
                  </h3>
                  <p className="dxn-discovery-text">
                    {t(
                      "لا دفع مسبق؛ تدفع عندما يصلك طلبك.",
                      "Aucun prépaiement ; payez à la réception."
                    )}
                  </p>
                </div>
              </div>
            </section>

            {/* H — Trust / transparency (only factual claims) */}
            <section className="mt-5" aria-labelledby="home-trust-title">
              <div className="text-center mb-4">
                <span className="dxn-chip">
                  {t("ثقة وشفافية", "Confiance et transparence")}
                </span>
                <h2 className="dxn-section-title h3 mb-0" id="home-trust-title">
                  {t("كيف تسير طلباتك بثقة", "Commander en toute confiance")}
                </h2>
              </div>
              <div className="dxn-why-grid">
                <div className="dxn-why-card">
                  <span className="dxn-why-icon"><CheckIcon /></span>
                  <h3 className="dxn-why-title">
                    {t("معلومات المنتج واضحة", "Informations produit claires")}
                  </h3>
                  <p className="dxn-why-text">
                    {t(
                      "الوصف والمواصفات معروضان قبل إضافة أي منتج إلى السلة.",
                      "Description et caractéristiques sont visibles avant l'ajout au panier."
                    )}
                  </p>
                </div>
                <div className="dxn-why-card">
                  <span className="dxn-why-icon"><CheckIcon /></span>
                  <h3 className="dxn-why-title">
                    {t("السعر واضح", "Prix clair")}
                  </h3>
                  <p className="dxn-why-text">
                    {t(
                      "كل سعر يُعرض بالدينار الجزائري منذ بطاقة المنتج حتى تأكيد الطلب.",
                      "Chaque prix est affiché en dinars algériens, de la fiche produit à la confirmation."
                    )}
                  </p>
                </div>
                <div className="dxn-why-card">
                  <span className="dxn-why-icon"><CheckIcon /></span>
                  <h3 className="dxn-why-title">
                    {t("تأكيد الطلب", "Confirmation de commande")}
                  </h3>
                  <p className="dxn-why-text">
                    {t(
                      "نعاود الاتصال بك لتأكيد الطلب قبل الشحن.",
                      "Nous vous rappelons pour confirmer la commande avant l'expédition."
                    )}
                  </p>
                </div>
                <div className="dxn-why-card">
                  <span className="dxn-why-icon"><CheckIcon /></span>
                  <h3 className="dxn-why-title">
                    {t("متابعة حالة الطلب", "Suivi de la commande")}
                  </h3>
                  <p className="dxn-why-text">
                    {t(
                      "بعد التأكيد يمكنك مراسلتنا مباشرة للاستفسار عن طلبك في أي وقت.",
                      "Après confirmation, vous pouvez nous écrire pour toute question sur votre commande."
                    )}
                  </p>
                </div>
                <div className="dxn-why-card">
                  <span className="dxn-why-icon"><CheckIcon /></span>
                  <h3 className="dxn-why-title">
                    {t("الدفع عند الاستلام", "Paiement à la livraison")}
                  </h3>
                  <p className="dxn-why-text">
                    {t(
                      "تدفع فقط عند استلام طلبك.",
                      "Vous payez uniquement à la réception de votre commande."
                    )}
                  </p>
                </div>
              </div>
            </section>
          </>
        )}

        {/* How to order (real checkout flow, no invented routes) */}
        <section className="mt-5" id="how-to-order" aria-labelledby="home-howto-title">
          <div className="text-center mb-4">
            <span className="dxn-chip">
              {t("الطلب خطوة بخطوة", "Commander pas à pas")}
            </span>
            <h2 className="dxn-section-title h3 mb-0" id="home-howto-title">
              {t("كيفية الطلب", "Comment commander")}
            </h2>
          </div>
          <div className="dxn-howto-grid">
            <div className="dxn-howto-step">
              <span className="dxn-howto-num">1</span>
              <h3 className="dxn-howto-title">{t("اختر المنتج", "Choisissez le produit")}</h3>
              <p className="dxn-howto-text">
                {t(
                  "تصفح التشكيلة من صفحة المنتجات واختر ما يناسبك.",
                  "Parcourez la gamme et choisissez le produit qui vous convient."
                )}
              </p>
            </div>
            <div className="dxn-howto-step">
              <span className="dxn-howto-num">2</span>
              <h3 className="dxn-howto-title">{t("أضفه إلى السلة", "Ajoutez-le au panier")}</h3>
              <p className="dxn-howto-text">
                {t(
                  "اضغط «أضف إلى السلة» على بطاقة المنتج ليُضاف إلى طلبك.",
                  "Appuyez sur « Ajouter au panier » sur la fiche du produit."
                )}
              </p>
            </div>
            <div className="dxn-howto-step">
              <span className="dxn-howto-num">3</span>
              <h3 className="dxn-howto-title">{t("أدخل معلومات التوصيل", "Renseignez la livraison")}</h3>
              <p className="dxn-howto-text">
                {t(
                  "الاسم، الهاتف، الولاية، البلدية وعنوان التوصيل.",
                  "Nom, téléphone, wilaya, commune et adresse de livraison."
                )}
              </p>
            </div>
            <div className="dxn-howto-step">
              <span className="dxn-howto-num">4</span>
              <h3 className="dxn-howto-title">{t("أكد الطلب", "Confirmez la commande")}</h3>
              <p className="dxn-howto-text">
                {t(
                  "راجع طلبك وأكّده؛ سيتصل بك فريقنا لتأكيد الشحن.",
                  "Vérifiez votre commande et confirmez-la ; notre équipe vous rappelle pour valider l'expédition."
                )}
              </p>
            </div>
          </div>
        </section>

        {/* I — Final CTA */}
        <section className="dxn-cta-final dxn-anim-fade-up" aria-labelledby="home-final-title">
          <div className="dxn-cta-final-inner">
            <h2 className="dxn-cta-final-title" id="home-final-title">
              {t("جاهز لاكتشاف منتجات DXN؟", "Prêt à découvrir les produits DXN ?")}
            </h2>
            <p className="dxn-cta-final-text">
              {t(
                "تصفح التشكيلة الكاملة وأضف ما يعجبك إلى السلة.",
                "Parcourez la gamme complète et ajoutez vos favoris au panier."
              )}
            </p>
            <div className="dxn-cta-final-actions">
              <Link to="/products" className="dxn-btn dxn-btn-gold">
                {t("تصفح المنتجات", "Parcourir les produits")}
              </Link>
              <a href={STORE_EMAIL_MAILTO} className="dxn-btn dxn-btn-outline-light">
                {t("تواصل معنا", "Contactez-nous")}
              </a>
            </div>
          </div>
        </section>
      </Container>
    </>
  );
};

export default HomePage;