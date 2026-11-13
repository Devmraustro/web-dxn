import React from "react";
import { Link } from "react-router-dom";
import SeoHead from "../components/SeoHead";
import { useLanguage } from "../context/LanguageContext";
import { usePublicContent } from "../hooks/usePublicContent";

const AboutDxnPage: React.FC = () => {
  const { language } = useLanguage();
  const { blocks } = usePublicContent();
  const tx = (ar: string, fr: string) => (language === "ar" ? ar : fr);

  const customBlock = blocks?.about?.[language] || {};

  const coreActivities = [
    {
      title: tx("الزراعة والاستزراع المنضبط", "Culture et recherche agronomique"),
      body: tx(
        "تشرف مزارع ومختبرات DXN في ماليزيا على استزراع فطر الجانوديرما والطحالب الغذائية مثل السبيرولينا ضمن ظروف بيئية خاضعة للمتابعة.",
        "Les fermes et laboratoires DXN en Malaisie supervisent la culture contrôlée du Ganoderma et de micro-algues alimentaires comme la spiruline."
      ),
    },
    {
      title: tx("التصنيع والتعبئة المتكاملة", "Fabrication et conditionnement"),
      body: tx(
        "تتم معالجة المواد الخام وتجفيفها وتعبئتها في مصانع تابعة للمجموعة للحفاظ على ثبات المواصفات من المصدر إلى المستهلك.",
        "La transformation, le séchage et le conditionnement sont réalisés dans les unités du groupe pour assurer la régularité des lots."
      ),
    },
    {
      title: tx("تشكيلة استهلاكية متنوعة", "Gamme de consommation quotidienne"),
      body: tx(
        "تشمل منتجات الشركة المكملات الغذائية، المشروبات اليومية (القهوة، الشاي، الكاكاو)، ومنتجات الكوسميتيك والعناية الشخصية.",
        "Le catalogue réunit compléments alimentaires, boissons chaudes et froides, cosmétiques et produits d'hygiène quotidienne."
      ),
    },
    {
      title: tx("التوزيع الدولي والبيع المباشر", "Distribution directe internationale"),
      body: tx(
        "تعمل DXN عبر فروع ومراكز خدمة رسمية وشبكة موزعين مستقلين في العديد من الدول حول العالم وفق لوائح البيع المباشر المنظم.",
        "DXN opère via des centres de service et un réseau international de distributeurs indépendants selon les règles de la vente directe."
      ),
    },
  ];

  return (
    <div className="dxn-page">
      <SeoHead
        title={tx("من هي شركة DXN؟", "Qui est l'entreprise DXN ?")}
        description={tx(
          "تعرّف على شركة DXN التي تأسست في ماليزيا عام 1993 على يد داتوك الدكتور ليم سيو جين ونموذجها المتكامل في الزراعة والتصنيع والتوزيع.",
          "Découvrez l'histoire vérifiée de DXN, fondée en Malaisie en 1993 par Datuk Dr. Lim Siow Jin, et son modèle industriel intégré."
        )}
        canonicalPath="/about"
      />

      <section className="dxn-hero" style={{ padding: "3.5rem 0" }}>
        <div className="container">
          <span className="dxn-hero-eyebrow">{tx("الملف التعريفي الرسمي", "Présentation de l'entreprise")}</span>
          <h1 className="mb-3">{customBlock.headline || tx("من هي شركة DXN؟", "Qui est l'entreprise DXN ?")}</h1>
          <p className="dxn-hero-lead mb-0">
            {customBlock.subtitle ||
              tx(
                "شركة ماليزية تأسست عام 1993 وتخصصت في زراعة وتصنيع وتوزيع المنتجات الغذائية والمشروبات ومنتجات العناية اليومية.",
                "Entreprise malaisienne fondée en 1993, spécialisée dans la culture, la fabrication et la distribution de produits nutritionnels, boissons et soins."
              )}
          </p>
        </div>
      </section>

      <section className="dxn-section">
        <div className="container">
          <div className="row g-4 align-items-stretch">
            <div className="col-lg-7">
              <div className="dxn-info-card">
                <h2 className="h4 fw-bold mb-3">{tx("النشأة والتأسيس في ماليزيا", "Fondation et origines en Malaisie")}</h2>
                <p className="text-muted" style={{ lineHeight: 1.85 }}>
                  {tx(
                    "تأسست شركة DXN عام 1993 في ولاية قدح (Kedah) بماليزيا على يد داتوك الدكتور ليم سيو جين (Datuk Dr. Lim Siow Jin). اشتُق اسم DXN من كلمة «Daxen» ذات الجذر الصيني الذي يرمز إلى الأمانة، النزاهة، وبناء الثقة المستدامة.",
                    "Fondée en 1993 dans l'État de Kedah en Malaisie par Datuk Dr. Lim Siow Jin, DXN tire son nom du terme « Daxen », évoquant l'intégrité, la fiabilité et la confiance durable."
                  )}
                </p>
                <p className="text-muted mb-0" style={{ lineHeight: 1.85 }}>
                  {tx(
                    "بدأت الشركة بالتركيز على استزراع فطر الجانوديرما (Ganoderma lucidum) وتقديمه في صور استهلاكية يومية ميسّرة، ثم وسّعت محفظتها تدريجياً لتشمل الطحالب الغذائية كالسبيرولينا، المشروبات الساخنة والباردة، ومنتجات العناية بالبشرة والعناية الشخصية.",
                    "Initialement centrée sur la culture du Ganoderma lucidum, l'entreprise a progressivement élargi son portefeuille vers la spiruline, les boissons instantanées et les soins cosmétiques."
                  )}
                </p>
              </div>
            </div>

            <div className="col-lg-5">
              <div className="dxn-info-card" style={{ background: "var(--dxn-green-50)" }}>
                <h2 className="h5 fw-bold mb-3">{tx("بطاقة معلومات موثقة", "Repères factuels")}</h2>
                <dl className="row mb-0 g-2 small">
                  <dt className="col-5 text-muted">{tx("سنة التأسيس:", "Année de création :")}</dt>
                  <dd className="col-7 fw-bold">1993</dd>
                  <dt className="col-5 text-muted">{tx("بلد المنشأ والمقر:", "Pays d'origine :")}</dt>
                  <dd className="col-7 fw-bold">{tx("قدح، ماليزيا (Kedah, Malaysia)", "Kedah, Malaisie")}</dd>
                  <dt className="col-5 text-muted">{tx("المؤسس:", "Fondateur :")}</dt>
                  <dd className="col-7 fw-bold">Datuk Dr. Lim Siow Jin</dd>
                  <dt className="col-5 text-muted">{tx("نموذج التشغيل:", "Modèle opérationnel :")}</dt>
                  <dd className="col-7 fw-bold">{tx("زراعة وتصنيع متكامل + بيع مباشر", "Production intégrée & vente directe")}</dd>
                  <dt className="col-5 text-muted">{tx("دور منصة DXN NADZ:", "Rôle de DXN NADZ :")}</dt>
                  <dd className="col-7 fw-bold">
                    {tx("متجر إلكتروني وتثقيف ومرافقة للانضمام إلى الفريق", "Boutique, centre éducatif et accompagnement d'équipe")}
                  </dd>
                </dl>
              </div>
            </div>
          </div>

          <div className="dxn-info-card mt-4">
            <h2 className="h4 fw-bold mb-2">
              {customBlock.philosophyTitle || tx("فلسفة «التنين الواحد» (One Dragon) والجودة الصناعية", "La philosophie intégrée « One Dragon »")}
            </h2>
            <p className="text-muted mb-0" style={{ lineHeight: 1.85 }}>
              {customBlock.philosophyBody ||
                tx(
                  "تتبنى شركة DXN فلسفة تشغيل متكاملة تُعرف بمفهوم «One Dragon»، أي أن الشركة تدير المراحل الأساسية للإنتاج داخلياً: الزراعة، التصنيع والمعالجة، التعبئة، والتسويق والتوزيع، بدلاً من الاعتماد الكامل على أطراف خارجية منفصلة، وهو ما يهدف إلى ضبط معايير الجودة واستمرارية التوريد.",
                  "DXN applique le concept « One Dragon » : l'ensemble des étapes clés — culture agricole, transformation industrielle, conditionnement et distribution — est géré de manière intégrée afin de maintenir la cohérence qualitative."
                )}
            </p>
          </div>

          <div className="mt-5">
            <h2 className="dxn-section-title mb-4">{tx("الأنشطة الأساسية للشركة", "Domaines d'activité principaux")}</h2>
            <div className="row g-3 g-md-4">
              {coreActivities.map((item, i) => (
                <div key={i} className="col-md-6">
                  <div className="dxn-info-card">
                    <h3 className="h5 fw-bold mb-2">{item.title}</h3>
                    <p className="text-muted mb-0" style={{ lineHeight: 1.75 }}>{item.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="d-flex flex-wrap gap-3 mt-5 pt-2">
            <Link to="/founder" className="dxn-btn dxn-btn-primary">
              {tx("تعرّف على مؤسس DXN", "Découvrir le fondateur")}
            </Link>
            <Link to="/why-dxn" className="dxn-btn dxn-btn-outline">
              {tx("لماذا يختار الكثيرون DXN؟", "Pourquoi choisir DXN ?")}
            </Link>
            <Link to="/products" className="dxn-btn dxn-btn-outline">
              {tx("تصفّح المنتجات", "Voir les produits")}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default AboutDxnPage;
