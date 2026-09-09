import React, { useState } from "react";
import { useLanguage } from "../context/LanguageContext";
import { useCart } from "../context/CartContext";
import axios from "axios";
import { Container, Row, Col, Form, Button, Alert, Card } from "react-bootstrap";
import * as yup from "yup";
import { useFormik } from "formik";
import { useNavigate } from "react-router-dom";

// Algerian wilayas list
const wilayas = [
  "Algiers", "Oran", "Constantine", "Annaba", "Setif", "Medea", "Blida",
  "Biskra", "Tlemcen", "Skikda", "Sidi Bel Abbès", "Mila", "Adrar",
  "In Salah", "Tamanrasset", "Ghardaïa", "Relizane", "El Oued", "Cela",
  "Ouargla", "Timra", "Touggourt", "Djanet", "Naama", "Guelma", "MSila",
];

// Validate Algerian phone: accept all 3 mobile prefixes (05/06/07) for both
// Djezzy, Mobilis and Ooredoo. Previously this rejected 06/07 numbers, which
// broke checkout for the majority of real Algerian customers.
const validatePhone = (phone: string): boolean => {
  const cleaned = phone.replace(/\s+/g, "").replace(/^\+/, "");
  return /^0[5-7]\d{8}$/.test(cleaned);
};

const CheckoutPage = () => {
  const { language } = useLanguage();
  const { items, subtotal, clearCart } = useCart();
  const navigate = useNavigate();
  const [deliveryMethod, setDeliveryMethod] = useState<"home" | "office">("home");
  const [shippingFee, setShippingFee] = useState(0);
  const [shippingError, setShippingError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"cod" | "baridimob">("cod");

  // Shipping calculation based on wilaya and delivery method
  const calculateShipping = async (wilaya: string, method: "home" | "office") => {
    if (!wilaya) {
      setShippingFee(0);
      return;
    }
    try {
      const response = await axios.get("/api/shipping/calculate", {
        params: { wilayaId: wilaya, deliveryMethod: method },
        timeout: 8000,
      });
      setShippingFee(response.data.data?.shippingFee || 0);
      setShippingError(null);
    } catch (err) {
      // Do NOT silently fall back to a hardcoded fee — the customer must
      // know the shipping cost could not be retrieved. Let the server's
      // authoritative value be used at order-creation time.
      console.error("Error calculating shipping:", err);
      setShippingFee(0);
      setShippingError(
        language === "ar"
          ? "تعذر حساب رسوم الشحن. سيتم احتسابها عند تأكيد الطلب."
          : "Impossible de calculer les frais de port. Ils seront calculés à la confirmation."
      );
    }
  };

  const formik = useFormik({
    initialValues: {
      firstName: "",
      lastName: "",
      phone: "",
      secondPhone: "",
      wilaya: "",
      commune: "",
      address: "",
    },
    validationSchema: yup.object({
      firstName: yup.string().min(2, "Required").required("Required"),
      lastName: yup.string().min(2, "Required").required("Required"),
      phone: yup
        .string()
        .test("algerian-phone", "Invalid Algerian phone", (value?: string) =>
          value ? validatePhone(value) : true
        )
        .required("Required"),
      wilaya: yup.string().required("Required"),
      commune: yup.string().required("Required"),
      // Address is ONLY required for home delivery; office delivery does not
      // need an address — preventing the customer from being forced to
      // invent a meaningless street for post office pickup.
      address: yup.string().when("__deliveryMethod", {
        is: () => false,
        otherwise: (schema) => schema.notRequired(),
      }),
    }),
    onSubmit: async (values) => {
      setIsSubmitting(true);
      setSubmitError(null);
      try {
        // GUARD: order confirmation checkbox must be checked.
        if (!confirmed) {
          setSubmitError(
            language === "ar"
              ? "يرجى تأكيد صحة المعلومات قبل المتابعة"
              : "Veuillez confirmer les informations avant de continuer"
          );
          setIsSubmitting(false);
          return;
        }
        if (items.length === 0) {
          setSubmitError(
            language === "ar"
              ? "السلة فارغة"
              : "Le panier est vide"
          );
          setIsSubmitting(false);
          return;
        }
        const response = await axios.post("/api/orders", {
          ...values,
          // Map cart into the server's expected cartItems shape.
          cartItems: items.map((i) => ({
            productId: i.productId,
            packId: i.packId,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
          })),
          deliveryMethod,
          // Office delivery: do NOT send a street address at all. The server
          // also blanks the address on office delivery so the customer is
          // never forced to invent a useless one.
          address: deliveryMethod === "home" ? values.address : "",
          paymentMethod,
        });
        const orderNumber = response.data?.data?.orderNumber;
        setShowSuccess(true);
        clearCart();
        if (orderNumber) {
          // Redirect to a confirmation page using the real order number.
          setTimeout(() => navigate(`/order-confirmation/${orderNumber}`), 800);
        }
        setIsSubmitting(false);
      } catch (err: any) {
        console.error("Order submission error:", err);
        setSubmitError(
          err?.response?.data?.message ||
            (language === "ar"
              ? "فشل إرسال الطلب. حاول مرة أخرى."
              : "Échec de l'envoi de la commande. Réessayez.")
        );
        setIsSubmitting(false);
      }
    },
  });

  const handleWilayaChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const wilaya = e.target.value;
    formik.setFieldValue("wilaya", wilaya);
    await calculateShipping(wilaya, deliveryMethod);
  };

  const handleWilayaChangeGeneric = async (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const target = e.target as HTMLSelectElement;
    const wilaya = target.value;
    formik.setFieldValue("wilaya", wilaya);
    await calculateShipping(wilaya, deliveryMethod);
  };

  const total = subtotal + shippingFee;

  return (
    <>
      <Container>
        <h2 className="mb-4">{language === "ar" ? "إتمام الطلب" : "Commande"}</h2>

        {submitError && (
          <Alert variant="danger" role="alert" aria-live="assertive" onClose={() => setSubmitError(null)} dismissible>
            {submitError}
          </Alert>
        )}
        {shippingError && (
          <Alert variant="warning" role="status" aria-live="polite">
            {shippingError}
          </Alert>
        )}

        <Card>
          <Card.Header>
            <Row>
              <Col xs={12} sm={6}>
                {language === "ar" ? "معلومات العميل" : "Informations client"}
              </Col>
            </Row>
          </Card.Header>

          <Card.Body>
            <Form onSubmit={formik.handleSubmit} noValidate>
              <Row>
                <Col xs={12} sm={6}>
                  <Form.Group controlId="formFirstName">
                    <Form.Label>{language === "ar" ? "الاسم الأول" : "Prénom"}</Form.Label>
                    <Form.Control
                      type="text"
                      name="firstName"
                      value={formik.values.firstName}
                      onChange={formik.handleChange}
                      onBlur={formik.handleBlur}
                      required
                      aria-required="true"
                      isInvalid={!!(formik.touched.firstName && formik.errors.firstName)}
                    />
                    <Form.Control.Feedback type="invalid">
                      {formik.errors.firstName}
                    </Form.Control.Feedback>
                  </Form.Group>
                </Col>
                <Col xs={12} sm={6}>
                  <Form.Group controlId="formLastName">
                    <Form.Label>{language === "ar" ? "اسم العائلة" : "Nom"}</Form.Label>
                    <Form.Control
                      type="text"
                      name="lastName"
                      value={formik.values.lastName}
                      onChange={formik.handleChange}
                      onBlur={formik.handleBlur}
                      required
                      aria-required="true"
                      isInvalid={!!(formik.touched.lastName && formik.errors.lastName)}
                    />
                    <Form.Control.Feedback type="invalid">
                      {formik.errors.lastName}
                    </Form.Control.Feedback>
                  </Form.Group>
                </Col>
              </Row>

              <Row>
                <Col xs={12} sm={6}>
                  <Form.Group controlId="formPhone">
                    <Form.Label>{language === "ar" ? "رقم الهاتف" : "Numéro de téléphone"}</Form.Label>
                    <Form.Control
                      type="tel"
                      name="phone"
                      value={formik.values.phone}
                      onChange={formik.handleChange}
                      onBlur={formik.handleBlur}
                      placeholder="05/06/07XXXXXXXX"
                      required
                      aria-required="true"
                      isInvalid={!!(formik.touched.phone && formik.errors.phone)}
                    />
                    <Form.Control.Feedback type="invalid">
                      {formik.errors.phone}
                    </Form.Control.Feedback>
                  </Form.Group>
                </Col>
                <Col xs={12} sm={6}>
                  <Form.Group controlId="formSecondPhone">
                    <Form.Label>{language === "ar" ? "رقم هاتف ثاني (اختياري)" : "Deuxième téléphone (optionnel)"}</Form.Label>
                    <Form.Control
                      type="tel"
                      name="secondPhone"
                      value={formik.values.secondPhone}
                      onChange={formik.handleChange}
                      placeholder="05/06/07XXXXXXXX"
                    />
                  </Form.Group>
                </Col>
              </Row>

              <Row>
                <Col xs={12} sm={6}>
                  <Form.Group controlId="formWilaya">
                    <Form.Label>{language === "ar" ? "الولاية" : "Wilaya"}</Form.Label>
                    <Form.Control
                      as="select"
                      name="wilaya"
                      value={formik.values.wilaya}
                      onChange={handleWilayaChangeGeneric as any}
                      onBlur={formik.handleBlur}
                      required
                      aria-required="true"
                      isInvalid={!!(formik.touched.wilaya && formik.errors.wilaya)}
                    >
                      <option value="">{language === "ar" ? "اختر الولاية" : "Sélectionnez une wilaya"}</option>
                      {wilayas.map((w: string) => (
                        <option key={w} value={w}>
                          {w}
                        </option>
                      ))}
                    </Form.Control>
                    <Form.Control.Feedback type="invalid">
                      {formik.errors.wilaya}
                    </Form.Control.Feedback>
                  </Form.Group>
                </Col>
                <Col xs={12} sm={6}>
                  <Form.Group controlId="formCommune">
                    <Form.Label>{language === "ar" ? "البلدية" : "Commune"}</Form.Label>
                    <Form.Control
                      name="commune"
                      value={formik.values.commune}
                      onChange={formik.handleChange}
                      onBlur={formik.handleBlur}
                      required
                      aria-required="true"
                      isInvalid={!!(formik.touched.commune && formik.errors.commune)}
                      placeholder={language === "ar" ? "اسم البلدية" : "Nom de la commune"}
                    />
                    <Form.Control.Feedback type="invalid">
                      {formik.errors.commune}
                    </Form.Control.Feedback>
                  </Form.Group>
                </Col>
              </Row>

              {deliveryMethod === "home" && (
                <Row>
                  <Col xs={12}>
                    <Form.Group controlId="formAddress">
                      <Form.Label>{language === "ar" ? "العنوان الكامل" : "Adresse complète"}</Form.Label>
                      <Form.Control
                        as="textarea"
                        name="address"
                        value={formik.values.address}
                        onChange={formik.handleChange}
                        onBlur={formik.handleBlur}
                        placeholder={language === "ar" ? "الشارع ورقم المنزل" : "Rue et numéro de maison"}
                        required
                        aria-required="true"
                      />
                    </Form.Group>
                  </Col>
                </Row>
              )}

              <fieldset>
                <legend className="visually-hidden">
                  {language === "ar" ? "طريقة التوصيل" : "Méthode de livraison"}
                </legend>
                <Row>
                  <Col xs={12} sm={6}>
                    <Form.Check
                      type="radio"
                      label={language === "ar" ? "التوصيل للمنزل" : "Livraison à domicile"}
                      name="deliveryMethod"
                      value="home"
                      checked={deliveryMethod === "home"}
                      onChange={() => {
                        setDeliveryMethod("home");
                        calculateShipping(formik.values.wilaya, "home");
                      }}
                    />
                  </Col>
                  <Col xs={12} sm={6}>
                    <Form.Check
                      type="radio"
                      label={language === "ar" ? "التوصيل لمكتب البريد" : "Livraison en bureau de poste"}
                      name="deliveryMethod"
                      value="office"
                      checked={deliveryMethod === "office"}
                      onChange={() => {
                        setDeliveryMethod("office");
                        calculateShipping(formik.values.wilaya, "office");
                      }}
                    />
                  </Col>
                </Row>
              </fieldset>

              <fieldset>
                <legend className="visually-hidden">
                  {language === "ar" ? "طريقة الدفع" : "Méthode de paiement"}
                </legend>
                <Row>
                  <Col xs={12} sm={6}>
                    <Form.Check
                      type="radio"
                      label={language === "ar" ? "الدفع عند الاستلام" : "Paiement à la livraison"}
                      name="paymentMethod"
                      value="cod"
                      checked={paymentMethod === "cod"}
                      onChange={() => setPaymentMethod("cod")}
                    />
                  </Col>
                  <Col xs={12} sm={6}>
                    <Form.Check
                      type="radio"
                      label="BaridiMob"
                      name="paymentMethod"
                      value="baridimob"
                      checked={paymentMethod === "baridimob"}
                      onChange={() => setPaymentMethod("baridimob")}
                    />
                  </Col>
                </Row>
              </fieldset>

              <div className="mt-3 p-3 bg-light" role="status" aria-live="polite">
                <strong>{language === "ar" ? "المجموع الفرعي" : "Sous-total"}:</strong> {subtotal} DA
                <div>
                  <strong>{language === "ar" ? "رسوم الشحن" : "Frais de port"}:</strong> {shippingFee} DA
                </div>
                <div>
                  <strong>{language === "ar" ? "المجموع" : "Total"}:</strong> {total} DA
                </div>
              </div>

              <Form.Group className="mt-3" controlId="formConfirm">
                <Form.Check
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  required
                  aria-required="true"
                  label={
                    language === "ar"
                      ? "أؤكد أن معلومات الاتصال والعنوان صحيحة"
                      : "Je confirme que les informations de contact et l'adresse saisies sont correctes"
                  }
                />
              </Form.Group>

              <Button
                type="submit"
                variant="primary"
                disabled={isSubmitting || !confirmed || items.length === 0}
                aria-busy={isSubmitting}
                className="w-100 mt-3"
              >
                {isSubmitting
                  ? language === "ar"
                    ? "جارٍ الإرسال..."
                    : "Envoi en cours..."
                  : language === "ar"
                    ? "تأكيد الطلب"
                    : "Confirmer la commande"}
              </Button>
            </Form>
          </Card.Body>
        </Card>

        {showSuccess && (
          <div className="mt-4 text-center" role="status" aria-live="polite">
            <h3>{language === "ar" ? "تم تأكيد الطلب" : "Commande confirmée"}</h3>
            <Button onClick={() => (window.location.href = "/")}>
              {language === "ar" ? "متابعة التسوق" : "Continuer les achats"}
            </Button>
          </div>
        )}
      </Container>
    </>
  );
};

export default CheckoutPage;