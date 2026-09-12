import React from "react";
import { useParams, Link } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";
import { orderSuccessCopy } from "../utils/orderFlow";
import { Container } from "react-bootstrap";

const CheckIcon = () => (
  <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="#d4a017" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

/**
 * Success screen shown ONLY after the backend confirmed order creation
 * (CheckoutPage navigates here exclusively on a successful POST /api/orders).
 * The copy never claims payment completion, shipping, or staff confirmation —
 * it only promises contact to confirm the order.
 */
const OrderConfirmationPage = () => {
  const { language } = useLanguage();
  const { orderNumber } = useParams<{ orderNumber: string }>();

  const lang = language === "ar" ? "ar" : "fr";
  const copy = orderSuccessCopy(lang);
  const t = (ar: string, fr: string) => (lang === "ar" ? ar : fr);

  return (
    <div className="dxn-success-wrap">
      <div className="dxn-success-card dxn-anim-scale-in">
        <div className="dxn-success-hero">
          <div className="dxn-success-check dxn-float">
            <CheckIcon />
          </div>
          <h1 className="h3 text-white dxn-success-title">{copy.title}</h1>
          <p className="mb-0" style={{ color: "rgba(255,255,255,0.8)", fontSize: "1.05rem" }}>
            {copy.body}
          </p>
        </div>

        <div className="dxn-success-body">
          {orderNumber && (
            <div className="dxn-success-order">
              <div className="dxn-success-label">
                {t("رقم الطلب", "Numéro de commande")}
              </div>
              <div className="dxn-success-value" dir="ltr">
                {orderNumber}
              </div>
            </div>
          )}

          <div className="dxn-success-order">
            <p className="mb-2 fw-semibold" style={{ color: "#0b3d1f" }}>
              {t("ماذا يحدث بعد ذلك؟", "Et ensuite ?")}
            </p>
            <p className="mb-2 small" style={{ color: "#4a5a50" }}>
              {t(
                "سيتواصل معك فريقنا عبر الهاتف خلال أقرب وقت لتأكيد طلبك.",
                "Notre équipe vous contactera par téléphone dans les plus brefs délais pour confirmer votre commande."
              )}
            </p>
            <p className="mb-0 small" style={{ color: "#4a5a50" }}>
              {t(
                "يمكن أن تتغير حالة الطلب لاحقاً حسب تأكيدنا معك.",
                "Le statut de la commande pourra évoluer après notre confirmation."
              )}
            </p>
          </div>

          <Link to="/" className="dxn-btn dxn-btn-primary w-100">
            {t("متابعة التسوق", "Continuer vos achats")}
          </Link>
        </div>
      </div>
    </div>
  );
};

export default OrderConfirmationPage;