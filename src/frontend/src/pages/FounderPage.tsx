import React from "react";
import { Link } from "react-router-dom";
import SeoHead from "../components/SeoHead";
import { useLanguage } from "../context/LanguageContext";
import { usePublicContent } from "../hooks/usePublicContent";

const FounderPage: React.FC = () => {
  const { language } = useLanguage();
  const { blocks } = usePublicContent();
  const tx = (ar: string, fr: string) => (language === "ar" ? ar : fr);

  const founderBlock = blocks?.founder || {};
  const loc = founderBlock[language] || {};
  const portraitUrl = typeof founderBlock.founderPortraitUrl === "string" ? founderBlock.founderPortraitUrl : "";

  const milestones = [
    {
      period: tx("الخلفية الأكاديمية الهندسية", "Formation académique d'ingénieur"),
      detail: tx(
        "تخرج داتوك الدكتور ليم سيو جين بدرجة البكالوريوس في التكنولوجيا من المعهد الهندي للتكنولوجيا (Indian Institute of Technology - IIT)، وهو ما منحه منهجية تحليلية وتنظيمية في البحث وبناء المنشآت.",
        "Diplômé de l'Indian Institute of Technology (IIT), Datuk Dr. Lim Siow Jin a développé une approche méthodique appliquée ensuite à l'agronomie et à l'industrie."
      ),
    },
    {
      period: tx("الاهتمام البحثي بالفطريات الغذائية", "Travaux sur la culture du Ganoderma"),
      detail: tx(
        "اهتم على مدى سنوات بدراسة الفطريات الغذائية — وخاصة فطر الجانوديرما — وبحث سبل استزراعها في المناخ المداري الماليزي بمعايير نظيفة ومنتظمة.",
        "Il consacre plusieurs années à étudier l'adaptation de la culture contrôlée du Ganoderma lucidum aux conditions tropicales de la Malaisie."
      ),
    },
    {
      period: tx("1993 — تأسيس شركة DXN في ماليزيا", "1993 — Fondation de DXN à Kedah"),
      detail: tx(
        "أسس شركة DXN في ولاية قدح بماليزيا بهدف توفير منتجات استهلاكية يومية تعتمد على تكامل الزراعة والتصنيع والتوزيع المباشر.",
        "Création officielle de DXN dans l'État de Kedah en Malaisie autour d'une chaîne intégrée de culture, fabrication et vente directe."
      ),
    },
    {
      period: tx("التوسع الدولي وتنويع خطوط الإنتاج", "Expansion internationale progressive"),
      detail: tx(
        "قاد توسع الشركة من السوق الماليزية إلى أسواق آسيا والشرق الأوسط وشمال إفريقيا وأوروبا وأمريكا مع توسيع خطوط المشروبات والمكملات والعناية الشخصية.",
        "Développement progressif vers de nombreux marchés internationaux et diversification vers les boissons, la spiruline et les cosmétiques."
      ),
    },
  ];

  return (
    <div className="dxn-page">
      <SeoHead
        title={tx("تعرّف على مؤسس DXN — داتوك الدكتور ليم سيو جين", "Fondateur de DXN — Datuk Dr. Lim Siow Jin")}
        description={tx(
          "السيرة الموثقة لداتوك الدكتور ليم سيو جين، مؤسس شركة DXN عام 1993 في ماليزيا، وخلفيته الأكاديمية وفلسفته الإدارية.",
          "Biographie vérifiée de Datuk Dr. Lim Siow Jin, fondateur de DXN en Malaisie en 1993."
        )}
        canonicalPath="/founder"
      />

      <section className="dxn-hero" style={{ padding: "3.5rem 0" }}>
        <div className="container">
          <span className="dxn-hero-eyebrow">{tx("قصة التأسيس والقيادة", "Biographie du fondateur")}</span>
          <h1 className="mb-2">{loc.headline || tx("تعرّف على مؤسس DXN", "Découvrir le fondateur de DXN")}</h1>
          <p className="dxn-hero-lead mb-0">
            {loc.name || tx("داتوك الدكتور ليم سيو جين (Datuk Dr. Lim Siow Jin)", "Datuk Dr. Lim Siow Jin")}
          </p>
        </div>
      </section>

      <section className="dxn-section">
        <div className="container">
          <div className="row g-4 align-items-center mb-5">
            <div className="col-md-4 text-center">
              <div className="dxn-info-card py-4">
                {portraitUrl ? (
                  <img
                    src={portraitUrl}
                    alt="Datuk Dr. Lim Siow Jin"
                    className="img-fluid rounded-circle mb-3"
                    style={{ width: 150, height: 150, objectFit: "cover", border: "3px solid var(--dxn-gold-500)" }}
                  />
                ) : (
                  <div className="dxn-founder-monogram mb-3" aria-hidden="true">
                    LSJ
                  </div>
                )}
                <h2 className="h5 fw-bold mb-1">Datuk Dr. Lim Siow Jin</h2>
                <p className="text-muted small mb-0">
                  {loc.role || tx("مؤسس شركة DXN — ماليزيا (1993)", "Fondateur de DXN — Malaisie (1993)")}
                </p>
              </div>
            </div>

            <div className="col-md-8">
              <div className="dxn-info-card">
                <h2 className="h4 fw-bold mb-3">{tx("نبذة تعريفية موثقة", "Parcours et vision")}</h2>
                <p className="text-muted" style={{ lineHeight: 1.85 }}>
                  {loc.summary ||
                    tx(
                      "تخرج داتوك الدكتور ليم سيو جين من المعهد الهندي للتكنولوجيا (IIT)، وانصبّ اهتمامه على دراسة الفطريات الغذائية وطرق استزراعها الحديثة وتوظيفها في منتجات غذائية واستهلاكية يومية ذات جودة ثابتة.",
                      "Diplômé de l'Indian Institute of Technology (IIT), Datuk Dr. Lim Siow Jin s'est intéressé à la culture maîtrisée des champignons alimentaires et à leur intégration dans des produits de consommation courante."
                    )}
                </p>
                <p className="text-muted mb-0" style={{ lineHeight: 1.85 }}>
                  {loc.vision ||
                    tx(
                      "في عام 1993 أسس شركة DXN في ولاية قدح بماليزيا، واعتمد مبدأ الاعتماد على الذات صناعياً وزراعياً («عالم واحد، سوق واحد» و«التنين الواحد») لبناء مؤسسة مستقرة تركز على جودة المنتج قبل الحملات الدعائية التقليدية.",
                      "En 1993, il fonde DXN à Kedah en Malaisie autour des principes « One Dragon » et « One World One Market », privilégiant la maîtrise industrielle interne et le bouche-à-oreille structuré."
                    )}
                </p>
              </div>
            </div>
          </div>

          <h2 className="dxn-section-title mb-4">{tx("محطات أساسية في مسيرة التأسيس", "Étapes clés vérifiées")}</h2>
          <div className="row g-3 g-md-4">
            {milestones.map((m, i) => (
              <div key={i} className="col-md-6">
                <div className="dxn-info-card">
                  <span className="badge rounded-pill mb-2" style={{ background: "#e6f4ec", color: "#0b3d1f" }}>
                    {m.period}
                  </span>
                  <p className="text-muted mb-0" style={{ lineHeight: 1.8 }}>{m.detail}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="d-flex flex-wrap gap-3 mt-5">
            <Link to="/about" className="dxn-btn dxn-btn-outline">
              {tx("من هي شركة DXN؟", "Qui est DXN ?")}
            </Link>
            <Link to="/education" className="dxn-btn dxn-btn-primary">
              {tx("استكشف مركز التثقيف بالمنتجات", "Explorer le centre éducatif")}
            </Link>
            <Link to="/join" className="dxn-btn dxn-btn-gold">
              {tx("انضم إلى فريق DXN NADZ", "Rejoindre l'équipe DXN NADZ")}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default FounderPage;
