import React from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";
import { useSiteSettings } from "../context/SiteSettingsContext";
import { STORE_EMAIL } from "../config/site";

/**
 * DXN Natural Life — Professional Footer (Phase 2.2 section 13 & Phase 11 & Phase 12).
 * Displays only verified, configured links and clear health/income disclaimers.
 */
const Footer = () => {
  const { language } = useLanguage();
  const { settings } = useSiteSettings();
  const t = (ar: string, fr: string) => (language === "ar" ? ar : fr);

  const email = settings.contactEmail || STORE_EMAIL;
  const socials = settings.socialLinks;
  const hasAnySocial = Boolean(
    socials.facebook || socials.instagram || socials.tiktok || socials.telegram || socials.whatsapp
  );

  return (
    <footer className="dxn-footer">
      <div className="dxn-footer-inner">
        {/* Brand */}
        <div>
          <div className="dxn-footer-brand">
            <span className="dxn-brand-badge" style={{ width: 42, height: 42, borderRadius: 12 }}>
              DXN
            </span>
            <span>
              <span className="dxn-brand-name" style={{ color: "#fff", fontSize: "1.1rem" }}>
                {settings.brandName || "DXN Natural Life"}
              </span>
              <span className="dxn-brand-sub d-block">
                {t("منتجات متنوعة • معرفة موثوقة • فرصة عمل منظمة", "Produits • Éducation • Opportunité")}
              </span>
            </span>
          </div>
          <p className="mt-2">
            {t(
              "منصة DXN للحياة الطبيعية للتسوق المباشر، التثقيف المسؤول بالمنتجات، ومرافقة الراغبين في الانضمام إلى نشاط البيع المباشر مع DXN بشفافية واحترافية.",
              "Plateforme DXN Natural Life dédiée aux produits DXN, à l'information responsable et à l'accompagnement transparent de notre équipe."
            )}
          </p>
        </div>

        {/* Store & Catalog */}
        <div className="dxn-footer-col">
          <div className="dxn-footer-title">{t("المتجر والمنتجات", "Boutique")}</div>
          <Link to="/products">{t("جميع المنتجات", "Tous les produits")}</Link>
          <Link to="/products?category=supplements">{t("المكملات الغذائية", "Compléments alimentaires")}</Link>
          <Link to="/products?category=cosmetics">{t("الكوسميتيك والعناية", "Cosmétiques & Soins")}</Link>
          <Link to="/cart">{t("سلة التسوق", "Panier")}</Link>
          <Link to="/checkout">{t("إتمام الطلب", "Valider la commande")}</Link>
        </div>

        {/* Company, Education & Team */}
        <div className="dxn-footer-col">
          <div className="dxn-footer-title">{t("المعرفة والفريق", "Entreprise & Équipe")}</div>
          <Link to="/about">{t("من هي شركة DXN؟", "Qui est DXN ?")}</Link>
          <Link to="/founder">{t("تعرّف على مؤسس DXN", "Fondateur de DXN")}</Link>
          <Link to="/why-dxn">{t("لماذا يختار الكثيرون DXN؟", "Pourquoi choisir DXN ?")}</Link>
          <Link to="/education">{t("مركز التثقيف بالمنتجات", "Centre éducatif produits")}</Link>
          <Link to="/join">{t("انضم إلى فريق DXN للحياة الطبيعية", "Rejoindre l'équipe DXN Natural Life")}</Link>
        </div>

        {/* Trust, Support & Socials */}
        <div className="dxn-footer-col">
          <div className="dxn-footer-title">{t("الثقة والتواصل", "Confiance & Contact")}</div>
          <Link to="/faq">{t("الأسئلة الشائعة ومركز الثقة", "FAQ & Centre de confiance")}</Link>
          <Link to="/contact">{t("تواصل معنا", "Contactez-nous")}</Link>
          <Link to="/privacy">{t("سياسة الخصوصية", "Politique de confidentialité")}</Link>
          <p className="mt-2 mb-1">
            {t("البريد الإلكتروني", "Email")} :{" "}
            <a href={`mailto:${email}`} aria-label="Email">
              {email}
            </a>
          </p>

          {hasAnySocial && (
            <div className="d-flex flex-wrap gap-2 mt-2">
              {socials.facebook && (
                <a
                  href={socials.facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Facebook"
                  className="btn btn-sm btn-outline-light"
                  style={{ borderRadius: 8 }}
                >
                  Facebook
                </a>
              )}
              {socials.instagram && (
                <a
                  href={socials.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram"
                  className="btn btn-sm btn-outline-light"
                  style={{ borderRadius: 8 }}
                >
                  Instagram
                </a>
              )}
              {socials.tiktok && (
                <a
                  href={socials.tiktok}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="TikTok"
                  className="btn btn-sm btn-outline-light"
                  style={{ borderRadius: 8 }}
                >
                  TikTok
                </a>
              )}
              {socials.telegram && (
                <a
                  href={socials.telegram}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Telegram"
                  className="btn btn-sm btn-outline-light"
                  style={{ borderRadius: 8 }}
                >
                  Telegram
                </a>
              )}
              {socials.whatsapp && (
                <a
                  href={socials.whatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="WhatsApp"
                  className="btn btn-sm btn-outline-light"
                  style={{ borderRadius: 8 }}
                >
                  WhatsApp
                </a>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="container py-3 border-top border-secondary border-opacity-25">
        <p className="small mb-0" style={{ color: "rgba(255,255,255,0.72)", lineHeight: 1.7 }}>
          {t(
            "تنبيه قانوني وصحي: المكملات الغذائية ومنتجات العناية المعروضة ليست أدوية طبية ولا تهدف إلى تشخيص أي مرض أو علاجه أو الشفاء منه أو الوقاية منه. كما أن فرص البيع المباشر مع DXN تعتمد على المبيعات الفعلية والجهد الشخصي دون أي وعود بأرباح مضمونة أو تلقائية.",
            "Avis légal et sanitaire : Les compléments alimentaires et soins proposés ne sont pas des médicaments et ne visent pas à diagnostiquer, traiter, guérir ou prévenir une maladie. Toute activité de vente directe dépend exclusivement des ventes réelles et de l'effort personnel, sans revenu garanti."
          )}
        </p>
      </div>

      <div className="dxn-footer-bottom">
        © {new Date().getFullYear()} {settings.brandName || "DXN Natural Life"} —{" "}
        {t("جميع الحقوق محفوظة", "Tous droits réservés")}
      </div>
    </footer>
  );
};

export default Footer;
