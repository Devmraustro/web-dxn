import React from "react";
import { useParams, Link } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";
import { orderSuccessCopy } from "../utils/orderFlow";
import { Container, Card } from "react-bootstrap";

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
    <Container className="mt-5" style={{ maxWidth: 620 }}>
      <Card
        className="text-center border-0 shadow-sm"
        style={{ borderRadius: 12, overflow: "hidden" }}
      >
        <div style={{ background: "linear-gradient(135deg, #0b3d1f 0%, #14532d 100%)", padding: "2.5rem 1.5rem 2rem" }}>
          <div
            aria-hidden="true"
            className="d-inline-flex align-items-center justify-content-center rounded-circle bg-white"
            style={{ width: 84, height: 84, fontSize: "2.6rem" }}
          >
            🎉
          </div>
          <h1 className="h3 text-white mt-3 mb-1">{copy.title}</h1>
          <p className="text-white-50 mb-0" style={{ fontSize: "1.05rem" }}>
            {copy.body}
          </p>
        </div>
        <Card.Body className="p-4" style={{ background: "#f9faf8" }}>
          {orderNumber && (
            <p className="mb-3">
              {t("رقم الطلب", "Numéro de commande")}:{" "}
              <strong className="text-muted">{orderNumber}</strong>
            </p>
          )}
          <div
            className="p-3 text-start mx-auto mb-3"
            style={{ maxWidth: 460, background: "#fff", borderRadius: 8, border: "1px solid #e5e9e3" }}
          >
            <p className="mb-2 fw-semibold" style={{ color: "#0b3d1f" }}>
              {t("ماذا يحدث بعد ذلك؟", "Et ensuite ?")}
            </p>
            <p className="mb-2 small" style={{ color: "#4a5a50" }}>
              {t(
                "سيتواصل معك فريقنا عبر الهاتف خلال أقرب وقت لتأكيد طلبك." ,
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
          <Link
            to="/"
            className="btn btn-lg w-100 text-white"
            style={{ background: "#14532d", border: "none", fontWeight: 700 }}
          >
            {t("متابعة التسوق", "Continuer vos achats")}
          </Link>
        </Card.Body>
      </Card>
    </Container>
  );
};

export default OrderConfirmationPage;