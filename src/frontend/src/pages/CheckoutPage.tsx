import React, { useMemo, useRef, useState, useEffect } from "react";
import { useLanguage } from "../context/LanguageContext";
import { useCart } from "../context/CartContext";
import axios from "axios";
import { Container, Row, Col, Form, Button, Alert, Card } from "react-bootstrap";
import * as yup from "yup";
import { useFormik } from "formik";
import { useNavigate } from "react-router-dom";
import { ALGERIAN_WILAYAS } from "../../../backend/data/algerianWilayas";

interface WilayaOption {
  value: string; // canonical romanized name — what the server/admin see in orders
  label: string; // localized label shown to the customer
}

// Validate Algerian phone: accept all mobile prefixes (05/06/07) for Djezzy,
// Mobilis and Ooredoo.
const validatePhone = (phone: string): boolean => {
  const cleaned = phone.replace(/\s+/g, "").replace(/^\+/, "");
  return /^0[5-7]\d{8}$/.test(cleaned);
};

const localize = (language: string) => {
  const ar = language === "ar";
  return {
    required: ar ? "هذا الحقل مطلوب" : "Ce champ est requis",
    phone: ar ? "رقم هاتف جزائري غير صحيح" : "Numéro de téléphone invalide",
  };
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

  // Stable idempotency key per checkout session so a double-tap / network retry
  // can never create two orders (the server deduplicates on this key).
  const idempotencyKey = useRef<string>(
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `ck-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );

  const msg = localize(language);
  const t = (ar: string, fr: string) => (language === "ar" ? ar : fr);

  // --- Wilaya options: canonical 58-wilaya dataset, enriched with live DB ids
  // when available. The VALUE is always the canonical romanized name so order
  // records and admin filters stay human-readable and stable.
  const [wilayaOptions, setWilayaOptions] = useState<WilayaOption[]>(() =>
    ALGERIAN_WILAYAS.map((w) => ({
      value: w.name,
      label: language === "ar" ? w.nameAr : w.nameFr || w.name,
    }))
  );

  useEffect(() => {
    // Re-label options when the UI language changes without re-fetching.
    setWilayaOptions((current) =>
      current.map((o) => {
        const wil = ALGERIAN_WILAYAS.find((w) => w.name === o.value);
        return wil
          ? { value: wil.name, label: language === "ar" ? wil.nameAr : wil.nameFr || wil.name }
          : o;
      })
    );
  }, [language]);

  // Shipping calculation based on wilaya and delivery method
  const calculateShipping = async (wilaya: string, method: "home" | "office") => {
    if (!wilaya) {
      setShippingFee(0);
      setShippingError(null);
      return;
    }
    try {
      const response = await axios.get("/api/shipping/calculate", {
        params: { wilayaId: wilaya, deliveryMethod: method },
        timeout: 8000,
      });
      const fee = Number(response.data?.data?.shippingFee);
      setShippingFee(Number.isFinite(fee) ? fee : 0);
      setShippingError(null);
    } catch (err) {
      // Do NOT silently fall back to a hardcoded fee — the customer must know
      // the shipping cost could not be retrieved. The server still computes the
      // authoritative value at order-creation time.
      console.error("Error calculating shipping:", err);
      setShippingFee(0);
      setShippingError(
        t("تعذر حساب رسوم الشحن. سيتم احتسابها عند تأكيد الطلب.", "Impossible de calculer les frais de port. Ils seront calculés à la confirmation.")
      );
    }
  };

  const validationSchema = useMemo(
    () =>
      yup.object({
        firstName: yup.string().min(2, msg.required).required(msg.required),
        lastName: yup.string().min(2, msg.required).required(msg.required),
        phone: yup
          .string()
          .test("algerian-phone", msg.phone, (value?: string) =>
            value ? validatePhone(value) : true
          )
          .required(msg.required),
        secondPhone: yup
          .string()
          .test("algerian-phone-2", msg.phone, (value?: string) =>
            value ? validatePhone(value) : true
          ),
        wilaya: yup.string().required(msg.required),
        commune: yup.string().required(msg.required),
        // A street address is only meaningful for home delivery; the extra
        // delivery-method rule lives in `validate` below because the delivery
        // method is not part of the Formik field set.
        address: yup.string().max(500),
      }),
    // deliveryMethod lives outside Formik; reflect it in the validation below.
    [language, deliveryMethod, msg.required, msg.phone]
  );

  const validateCheckoutForm = (values: {
    firstName: string;
    lastName: string;
    phone: string;
    secondPhone: string;
    wilaya: string;
    commune: string;
    address: string;
  }): Record<string, string> => {
    const errors: Record<string, string> = {};
    try {
      validationSchema.validateSync(values, { abortEarly: false });
    } catch (err: any) {
      if (err?.inner) {
        for (const e of err.inner) {
          if (e.path && !errors[e.path]) errors[e.path] = e.message;
        }
      }
    }
    if (deliveryMethod === "home" && !(values.address && values.address.trim().length >= 4)) {
      errors.address = errors.address || msg.required;
    }
    return errors;
  };

  const formikInitialValues = {
    firstName: "",
    lastName: "",
    phone: "",
    secondPhone: "",
    wilaya: "",
    commune: "",
    address: "",
  };

  const formik = useFormik({
    initialValues: formikInitialValues,
    validate: validateCheckoutForm,
    onSubmit: async (values) => {
      setIsSubmitting(true);
      setSubmitError(null);
      try {
        // GUARD: order confirmation checkbox must be checked.
        if (!confirmed) {
          setSubmitError(
            t("يرجى تأكيد صحة المعلومات قبل المتابعة", "Veuillez confirmer les informations avant de continuer")
          );
          setIsSubmitting(false);
          return;
        }
        if (items.length === 0) {
          setSubmitError(t("السلة فارغة", "Le panier est vide"));
          setIsSubmitting(false);
          return;
        }
        const response = await axios.post(
          "/api/orders",
          {
            customerInfo: {
              firstName: values.firstName,
              lastName: values.lastName,
              phone: values.phone,
              secondPhone: values.secondPhone || "",
            },
            cartItems: items.map((i) => ({
              productId: i.productId,
              packId: i.packId,
              quantity: i.quantity,
            })),
            deliveryMethod,
            wilaya: values.wilaya,
            commune: values.commune,
            // Office delivery: do NOT send a street address at all. The server
            // also blanks the address on office delivery.
            address: deliveryMethod === "home" ? values.address : "",
            paymentMethod,
            confirmed: true,
          },
          { headers: { "Idempotency-Key": idempotencyKey.current } }
        );
        const orderNumber = response.data?.data?.orderNumber;
        setShowSuccess(true);
        clearCart();
        if (orderNumber) {
          setTimeout(() => navigate(`/order-confirmation/${orderNumber}`), 800);
        }
        setIsSubmitting(false);
      } catch (err: any) {
        console.error("Order submission error:", err);
        setSubmitError(
          err?.response?.data?.message ||
            (language === "ar" ? "فشل إرسال الطلب. حاول مرة أخرى." : "Échec de l'envoi de la commande. Réessayez.")
        );
        setIsSubmitting(false);
      }
    },
  });

  const handleWilayaChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const wilaya = e.target.value;
    formik.setFieldValue("wilaya", wilaya);
    void calculateShipping(wilaya, deliveryMethod);
  };

  const switchDeliveryMethod = (method: "home" | "office") => {
    setDeliveryMethod(method);
    if (formik.values.wilaya) {
      void calculateShipping(formik.values.wilaya, method);
    }
  };

  const total = subtotal + shippingFee;

  return (
    <Container>
      <h2 className="mb-4">{t("إتمام الطلب", "Commande")}</h2>

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
        <Card.Header>{t("معلومات العميل", "Informations client")}</Card.Header>
        <Card.Body>
          <Form onSubmit={formik.handleSubmit} noValidate>
            <Row>
              <Col xs={12} sm={6}>
                <Form.Group controlId="formFirstName" className="mb-3">
                  <Form.Label>{t("الاسم الأول", "Prénom")} *</Form.Label>
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
                  <Form.Control.Feedback type="invalid">{formik.errors.firstName}</Form.Control.Feedback>
                </Form.Group>
              </Col>
              <Col xs={12} sm={6}>
                <Form.Group controlId="formLastName" className="mb-3">
                  <Form.Label>{t("اسم العائلة", "Nom")} *</Form.Label>
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
                  <Form.Control.Feedback type="invalid">{formik.errors.lastName}</Form.Control.Feedback>
                </Form.Group>
              </Col>
            </Row>

            <Row>
              <Col xs={12} sm={6}>
                <Form.Group controlId="formPhone" className="mb-3">
                  <Form.Label>{t("رقم الهاتف", "Numéro de téléphone")} *</Form.Label>
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
                  <Form.Control.Feedback type="invalid">{formik.errors.phone}</Form.Control.Feedback>
                </Form.Group>
              </Col>
              <Col xs={12} sm={6}>
                <Form.Group controlId="formSecondPhone" className="mb-3">
                  <Form.Label>{t("رقم هاتف ثاني (اختياري)", "Deuxième téléphone (optionnel)")}</Form.Label>
                  <Form.Control
                    type="tel"
                    name="secondPhone"
                    value={formik.values.secondPhone}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    placeholder="05/06/07XXXXXXXX"
                    isInvalid={!!(formik.touched.secondPhone && formik.errors.secondPhone)}
                  />
                  <Form.Control.Feedback type="invalid">{formik.errors.secondPhone}</Form.Control.Feedback>
                </Form.Group>
              </Col>
            </Row>

            <Row>
              <Col xs={12} sm={6}>
                <Form.Group controlId="formWilaya" className="mb-3">
                  <Form.Label>{t("الولاية", "Wilaya")} *</Form.Label>
                  <Form.Select
                    name="wilaya"
                    value={formik.values.wilaya}
                    onChange={handleWilayaChange}
                    onBlur={formik.handleBlur}
                    required
                    aria-required="true"
                    isInvalid={!!(formik.touched.wilaya && formik.errors.wilaya)}
                  >
                    <option value="">{t("اختر الولاية", "Sélectionnez une wilaya")}</option>
                    {wilayaOptions.map((w) => (
                      <option key={w.value} value={w.value}>
                        {w.label}
                      </option>
                    ))}
                  </Form.Select>
                  <Form.Control.Feedback type="invalid">{formik.errors.wilaya}</Form.Control.Feedback>
                </Form.Group>
              </Col>
              <Col xs={12} sm={6}>
                <Form.Group controlId="formCommune" className="mb-3">
                  <Form.Label>{t("البلدية", "Commune")} *</Form.Label>
                  <Form.Control
                    name="commune"
                    value={formik.values.commune}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    required
                    aria-required="true"
                    isInvalid={!!(formik.touched.commune && formik.errors.commune)}
                    placeholder={t("اسم البلدية", "Nom de la commune")}
                  />
                  <Form.Control.Feedback type="invalid">{formik.errors.commune}</Form.Control.Feedback>
                </Form.Group>
              </Col>
            </Row>

            {deliveryMethod === "home" && (
              <Form.Group controlId="formAddress" className="mb-3">
                <Form.Label>{t("العنوان الكامل", "Adresse complète")} *</Form.Label>
                <Form.Control
                  as="textarea"
                  name="address"
                  rows={2}
                  value={formik.values.address}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  placeholder={t("الشارع ورقم المنزل", "Rue et numéro de maison")}
                  required
                  aria-required="true"
                  isInvalid={!!(formik.touched.address && formik.errors.address)}
                />
                <Form.Control.Feedback type="invalid">{formik.errors.address}</Form.Control.Feedback>
              </Form.Group>
            )}

            <fieldset className="mb-3">
              <legend className="fs-6 fw-semibold">{t("طريقة التوصيل", "Méthode de livraison")}</legend>
              <Row>
                <Col xs={12} sm={6}>
                  <Form.Check
                    type="radio"
                    label={t("التوصيل للمنزل", "Livraison à domicile")}
                    name="deliveryMethod"
                    value="home"
                    id="delivery-home"
                    checked={deliveryMethod === "home"}
                    onChange={() => switchDeliveryMethod("home")}
                  />
                </Col>
                <Col xs={12} sm={6}>
                  <Form.Check
                    type="radio"
                    label={t("التوصيل لمكتب البريد", "Livraison en bureau de poste")}
                    name="deliveryMethod"
                    value="office"
                    id="delivery-office"
                    checked={deliveryMethod === "office"}
                    onChange={() => switchDeliveryMethod("office")}
                  />
                </Col>
              </Row>
            </fieldset>

            <fieldset className="mb-3">
              <legend className="fs-6 fw-semibold">{t("طريقة الدفع", "Méthode de paiement")}</legend>
              <Row>
                <Col xs={12} sm={6}>
                  <Form.Check
                    type="radio"
                    label={t("الدفع عند الاستلام", "Paiement à la livraison")}
                    name="paymentMethod"
                    value="cod"
                    id="payment-cod"
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
                    id="payment-baridimob"
                    checked={paymentMethod === "baridimob"}
                    onChange={() => setPaymentMethod("baridimob")}
                  />
                </Col>
              </Row>
            </fieldset>

            <div className="mt-3 p-3 bg-light rounded" role="status" aria-live="polite">
              <div>
                <strong>{t("المجموع الفرعي", "Sous-total")}:</strong> {subtotal} DA
              </div>
              <div>
                <strong>{t("رسوم الشحن", "Frais de port")}:</strong> {shippingFee} DA
              </div>
              <div className="fs-5">
                <strong>{t("المجموع", "Total")}:</strong> {total} DA
              </div>
            </div>

            <Form.Group className="mt-3" controlId="formConfirm">
              <Form.Check
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                required
                aria-required="true"
                label={t(
                  "أؤكد أن معلومات الاتصال والعنوان صحيحة",
                  "Je confirme que les informations de contact et l'adresse saisies sont correctes"
                )}
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
                ? t("جارٍ الإرسال...", "Envoi en cours...")
                : t("تأكيد الطلب", "Confirmer la commande")}
            </Button>
          </Form>
        </Card.Body>
      </Card>

      {showSuccess && (
        <div className="mt-4 text-center" role="status" aria-live="polite">
          <h3>{t("تم تأكيد الطلب", "Commande confirmée")}</h3>
          <Button onClick={() => (window.location.href = "/")}>
            {t("متابعة التسوق", "Continuer les achats")}
          </Button>
        </div>
      )}
    </Container>
  );
};

export default CheckoutPage;
