import React from "react";
import { useParams, Link } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";
import { Container, Card, Alert } from "react-bootstrap";

const OrderConfirmationPage = () => {
  const { language } = useLanguage();
  const { orderNumber } = useParams<{ orderNumber: string }>();

  const t = (ar: string, fr: string) => (language === "ar" ? ar : fr);

  return (
    <>
      <Container className="mt-5" style={{ maxWidth: 560 }}>
        <Card className="text-center">
          <Card.Body>
            <div className="display-6">🎉</div>
            <h1 className="h4 mt-2">{t("تم تأكيد الطلب", "Commande confirmée")}</h1>
            <p className="mt-3">
              {t("رقم الطلب", "Numéro de commande")}:{" "}
              <strong>{orderNumber || "—"}</strong>
            </p>
            <Alert variant="success" className="mt-3">
              {t(
                "شكراً لطلبك! سيتواصل معك فريقنا قريباً لتأكيد التفاصيل.",
                "Merci pour votre commande ! Notre équipe vous contactera bientôt pour confirmer les détails."
              )}
            </Alert>
            <Link to="/" className="btn btn-primary mt-2">
              {t("متابعة التسوق", "Continuer les achats")}
            </Link>
          </Card.Body>
        </Card>
      </Container>
    </>
  );
};

export default OrderConfirmationPage;