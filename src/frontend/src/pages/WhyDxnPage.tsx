import React from "react";
import { Link } from "react-router-dom";
import SeoHead from "../components/SeoHead";
import { useLanguage } from "../context/LanguageContext";

const WhyDxnPage: React.FC = () => {
  const { language } = useLanguage();
  const tx = (ar: string, fr: string) => (language === "ar" ? ar : fr);

  const reasons = [
    {
      title: tx("خبرة ماليزية وحضور دولي منذ 1993", "Origine malaisienne et présence internationale depuis 1993"),
      body: tx(
        "أكثر من ثلاثة عقود من الاستمرارية في قطاع المنتجات الاستهلاكية والبيع المباشر عبر فروع ومراكز خدمة رسمية في مناطق متعددة حول العالم.",
        "Plus de trois décennies de continuité industrielle et commerciale à travers un réseau international établi."
      ),
    },
    {
      title: tx("تنوع عملي يلبي الاستهلاك اليومي", "Une gamme adaptée aux habitudes quotidiennes"),
      body: tx(
        "لا تقتصر منتجات DXN على المكملات الغذائية فحسب، بل تشمل القهوة والمشروبات اليومية ومنتجات العناية بالبشرة والعناية الشخصية.",
        "Au-delà des compléments alimentaires, DXN propose boissons chaudes, cacao, soins cutanés et produits d'hygiène."
      ),
    },
    {
      title: tx("إشراف صناعي وزراعي داخلي", "Maîtrise interne de la culture et de la fabrication"),
      body: tx(
        "امتلاك مزارع ومرافق تصنيع وتعبئة خاصة يمنح الشركة قدرة أكبر على متابعة جودة المواد الخام وثبات المنتج النهائي.",
        "La gestion interne des fermes et usines favorise la traçabilité des matières premières et la régularité des produits."
      ),
    },
    {
      title: tx("حرية الشراء بدون التزام", "Liberté d'achat sans obligation"),
      body: tx(
        "في متجر DXN NADZ يمكن لأي عميل شراء ما يحتاجه مباشرة دون اشتراط الانضمام أو التسجيل، مع إمكانية الدفع عند الاستلام.",
        "Sur DXN NADZ, tout visiteur peut commander librement sans obligation d'adhésion, avec paiement à la livraison."
      ),
    },
    {
      title: tx("نموذج بيع مباشر واضح ومنظم", "Un modèle de vente directe structuré"),
      body: tx(
        "للراغبين في العمل التسويقي، يتيح نظام DXN تسجيل نقاط المبيعات الحقيقية وتطوير نشاط تجاري مرن مرتبط بحجم المبيعات الفعلية.",
        "Pour ceux qui souhaitent entreprendre, le système repose sur le volume réel de produits vendus (points PV)."
      ),
    },
    {
      title: tx("دعم وتوجيه مستمر مع فريق DXN NADZ", "Accompagnement sérieux par l'équipe DXN NADZ"),
      body: tx(
        "نوفر شرحاً واقعياً وأميناً، وتدريباً على فهم المنتجات وأساسيات التسويق الأخلاقي بعيداً عن المبالغات والوعود الوهمية.",
        "Nous offrons une orientation transparente, éducative et éthique, sans promesses irréalistes."
      ),
    },
  ];

  return (
    <div className="dxn-page">
      <SeoHead
        title={tx("لماذا يختار الكثيرون DXN؟", "Pourquoi tant de personnes choisissent DXN ?")}
        description={tx(
          "تعرّف بموضوعية وشفافية على الأسباب التي تجعل الكثيرين يختارون منتجات DXN أو الانضمام إلى نشاطها التجاري.",
          "Découvrez de manière factuelle et équilibrée pourquoi de nombreux consommateurs et membres choisissent DXN."
        )}
        canonicalPath="/why-dxn"
      />

      <section className="dxn-hero" style={{ padding: "3.5rem 0" }}>
        <div className="container">
          <span className="dxn-hero-eyebrow">{tx("نظرة متوازنة وموضوعية", "Présentation équilibrée")}</span>
          <h1 className="mb-2">{tx("لماذا يختار الكثيرون DXN؟", "Pourquoi tant de personnes choisissent DXN ?")}</h1>
          <p className="dxn-hero-lead mb-0">
            {tx(
              "عوامل عملية تجمع بين تنوع المنتجات الاستهلاكية، التكامل الصناعي، ومرونة الاختيار بين التسوق الشخصي أو بناء نشاط بيع مباشر.",
              "Des atouts concrets réunissant diversité des produits, production intégrée et liberté de choix entre achat client et activité membre."
            )}
          </p>
        </div>
      </section>

      <section className="dxn-section">
        <div className="container">
          <div className="row g-4">
            {reasons.map((r, idx) => (
              <div key={idx} className="col-md-6 col-lg-4">
                <div className="dxn-info-card">
                  <div className="dxn-step-num mb-3">{idx + 1}</div>
                  <h2 className="h5 fw-bold mb-2">{r.title}</h2>
                  <p className="text-muted mb-0" style={{ lineHeight: 1.8 }}>{r.body}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="dxn-compliance-banner mt-5">
            <strong>{tx("مبدأ الشفافية في DXN NADZ:", "Principe de transparence DXN NADZ :")}</strong>{" "}
            {tx(
              "نحرص على تقديم منتجات DXN بوصفها منتجات غذائية واستهلاكية وعناية شخصية وليست علاجات طبية، ونعرض فرصة العمل بوصفها نشاطاً تجارياً يعتمد على الجهد والمبيعات الحقيقية دون أي ضمانات ربح تلقائي.",
              "Nous présentons les produits DXN comme des produits alimentaires et cosmétiques (non médicaux), et l'opportunité commerciale comme une activité fondée sur le travail réel sans revenu garanti."
            )}
          </div>

          <div className="d-flex flex-wrap gap-3 mt-4">
            <Link to="/products" className="dxn-btn dxn-btn-primary">
              {tx("اكتشف المنتجات المتوفرة", "Découvrir les produits")}
            </Link>
            <Link to="/join" className="dxn-btn dxn-btn-gold">
              {tx("انضم إلى فريقنا", "Rejoindre notre équipe")}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default WhyDxnPage;
