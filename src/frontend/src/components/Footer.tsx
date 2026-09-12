import React from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";

/**
 * Site footer. Contains only factual store information — no invented phone
 * numbers or social accounts. Contact channels remain those surfaced by the
 * order flow (phone confirmation) and the backend.
 */
const Footer = () => {
  const { language } = useLanguage();
  const t = (ar: string, fr: string) => (language === "ar" ? ar : fr);

  return (
    <footer className="dxn-footer">
      <div className="dxn-footer-inner">
        {/* Brand */}
        <div>
          <div className="dxn-footer-brand">
            <span className="dxn-brand-badge" style={{ width: 40, height: 40, borderRadius: 12 }}>
              DXN
            </span>
            <span>
              <span className="dxn-brand-name" style={{ color: "#fff", fontSize: "1.05rem" }}>
                DXN Store
              </span>
              <span className="dxn-brand-sub d-block">{t("صحتك أولاً", "Votre santé d'abord")}</span>
            </span>
          </div>
          <p>
            {t(
              "متجر مكملات غذائية ومنتجات DXN الصحية في الجزائر، مع التوصيل إلى جميع الولايات والدفع عند الاستلام.",
              "Boutique de compléments alimentaires et produits de bien-être DXN en Algérie, avec livraison vers toutes les wilayas et paiement à la livraison."
            )}
          </p>
        </div>

        {/* Quick links */}
        <div className="dxn-footer-col">
          <div className="dxn-footer-title">{t("روابط سريعة", "Liens rapides")}</div>
          <Link to="/">{t("الرئيسية", "Accueil")}</Link>
          <Link to="/products">{t("المنتجات", "Produits")}</Link>
          <Link to="/cart">{t("سلة التسوق", "Panier")}</Link>
          <Link to="/checkout">{t("إتمام الطلب", "Commande")}</Link>
        </div>

        {/* Delivery */}
        <div className="dxn-footer-col">
          <div className="dxn-footer-title">{t("التوصيل والدفع", "Livraison & paiement")}</div>
          <p>{t("التوصيل إلى 58 ولاية.", "Livraison vers les 58 wilayas.")}</p>
          <p>{t("الدفع عند الاستلام متاح.", "Paiement à la livraison disponible.")}</p>
          <p>{t("تأكيد الطلبات عبر الهاتف.", "Confirmation des commandes par téléphone.")}</p>
        </div>

        {/* Admin */}
        <div className="dxn-footer-col">
          <div className="dxn-footer-title">{t("الإدارة", "Administration")}</div>
          <Link to="/admin/login">{t("دخول الأدمن", "Espace admin")}</Link>
          <p className="mt-2">
            {t(
              "الأسعار والمخزون تُدار من لوحة التحكم.",
              "Prix et stock sont gérés depuis le tableau de bord."
            )}
          </p>
        </div>
      </div>

      <div className="dxn-footer-bottom">
        © {new Date().getFullYear()} DXN Store — {t("جميع الحقوق محفوظة", "Tous droits réservés")}
      </div>
    </footer>
  );
};

export default Footer;