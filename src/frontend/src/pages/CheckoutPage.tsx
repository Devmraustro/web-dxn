import React, { useMemo, useRef, useState, useEffect } from "react";
import { useLanguage } from "../context/LanguageContext";
import { useCart } from "../context/CartContext";
import { CatalogEntry } from "../utils/cartReconcile";
import { resolveOrderOutcome } from "../utils/orderFlow";
import { pickProductTitle } from "../components/ProductCard";
import { getStoredTrafficSource } from "../utils/referralAttribution";
import SeoHead from "../components/SeoHead";
import axios from "axios";
import { Container, Row, Col, Form, Button, Alert } from "react-bootstrap";
import * as yup from "yup";
import { useFormik } from "formik";
import { useNavigate } from "react-router-dom";
import { ALGERIAN_WILAYAS, WilayaCoverageStatus } from "../../../backend/data/algerianWilayas";

interface WilayaOption {
  code: number;
  value: string; // canonical romanized name — what the server/admin see in orders
  label: string; // localized label shown to the customer
  coverageStatus: WilayaCoverageStatus;
  homeDeliverySupported: boolean;
  officeDeliverySupported: boolean;
}

function formatWilayaLabel(
  code: number,
  nameAr: string,
  nameFr: string,
  fallbackName: string,
  language: string,
  coverageStatus?: WilayaCoverageStatus
): string {
  const prefix = String(code).padStart(2, "0");
  const base = language === "ar" ? nameAr || fallbackName : nameFr || fallbackName;
  if (coverageStatus === "unserved") {
    const suffix = language === "ar" ? " (غير متوفر حالياً)" : " (Indisponible)";
    return `${prefix} - ${base}${suffix}`;
  }
  return `${prefix} - ${base}`;
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
  const { items, validItems, hasInvalid, subtotal, clearCart, reconcile } = useCart();
  const navigate = useNavigate();

  const [deliveryMethod, setDeliveryMethod] = useState<"home" | "office">("home");
  const [shippingFee, setShippingFee] = useState(0);
  const [shippingDeliverable, setShippingDeliverable] = useState(true);
  const [shippingCoverageNotice, setShippingCoverageNotice] = useState<{
    ar: string;
    fr: string;
  } | null>(null);
  const [shippingError, setShippingError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"cod">("cod");
  const [catalogChecked, setCatalogChecked] = useState(false);

  // Stable idempotency key per checkout session so a double-tap / network retry
  // can never create two orders (the server deduplicates on this key).
  const idempotencyKey = useRef<string>(
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `ck-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );

  const msg = localize(language);
  const t = (ar: string, fr: string) => (language === "ar" ? ar : fr);

  // Reconcile the cart against the authoritative public catalog on load so a
  // stale/inactive/placeholder/out-of-stock item can never silently reach the
  // server — the backend remains the final boundary.
  useEffect(() => {
    if (items.length === 0) {
      setCatalogChecked(true);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [productsRes, packsRes] = await Promise.all([
          axios.get(`/api/products?language=${language}`, { timeout: 8000 }),
          axios.get("/api/packs", { timeout: 8000 }),
        ]);
        if (cancelled) return;
        const products = new Map<string, CatalogEntry>();
        const productList: any[] = Array.isArray(productsRes.data?.data) ? productsRes.data.data : [];
        for (const p of productList) {
          products.set(String(p._id), {
            id: String(p._id),
            price: Number(p.price) || 0,
            stockQuantity: Number(p.stockQuantity) || 0,
            name: pickProductTitle(p, language) || p.sku || "Product",
          });
        }
        const packs = new Map<string, CatalogEntry>();
        const packList: any[] = Array.isArray(packsRes.data?.data) ? packsRes.data.data : [];
        for (const p of packList) {
          packs.set(String(p._id), {
            id: String(p._id),
            price: Number(p.price) || 0,
            stockQuantity: 1,
            name: p.name || "Pack",
          });
        }
        reconcile(products, packs, true);
      } catch (err) {
        if (cancelled) return;
        // Transient failure: keep the cart untouched; the server still guards.
        console.error("Checkout reconcile error:", err);
        reconcile(undefined, undefined, false);
      } finally {
        if (!cancelled) setCatalogChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [language, items.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Wilaya options: canonical 69-wilaya dataset (Law 26-06), enriched with
  // live DB courier coverage configuration when available. The VALUE is always
  // the canonical romanized name so order records and admin filters stay stable.
  const [wilayaOptions, setWilayaOptions] = useState<WilayaOption[]>(() =>
    ALGERIAN_WILAYAS.map((w) => ({
      code: w.code,
      value: w.name,
      label: formatWilayaLabel(w.code, w.nameAr, w.nameFr, w.name, language, w.defaultCoverageStatus),
      coverageStatus: w.defaultCoverageStatus,
      homeDeliverySupported: w.defaultHomeDelivery,
      officeDeliverySupported: w.defaultOfficeDelivery,
    }))
  );

  useEffect(() => {
    let cancelled = false;
    axios
      .get("/api/shipping/wilayas", { timeout: 6000 })
      .then((res) => {
        if (cancelled) return;
        const rows = Array.isArray(res.data?.data) ? res.data.data : [];
        if (rows.length === 0) return;
        const byCode = new Map<number, any>();
        for (const r of rows) {
          if (typeof r.code === "number") byCode.set(r.code, r);
        }
        setWilayaOptions(
          ALGERIAN_WILAYAS.map((w) => {
            const db = byCode.get(w.code);
            const cov: WilayaCoverageStatus =
              (db?.coverageStatus as WilayaCoverageStatus | undefined) || w.defaultCoverageStatus;
            return {
              code: w.code,
              value: w.name,
              label: formatWilayaLabel(
                w.code,
                db?.nameAr || w.nameAr,
                db?.nameFr || w.nameFr,
                w.name,
                language,
                cov
              ),
              coverageStatus: cov,
              homeDeliverySupported:
                typeof db?.homeDeliverySupported === "boolean"
                  ? db.homeDeliverySupported
                  : w.defaultHomeDelivery,
              officeDeliverySupported:
                typeof db?.officeDeliverySupported === "boolean"
                  ? db.officeDeliverySupported
                  : w.defaultOfficeDelivery,
            };
          })
        );
      })
      .catch(() => {
        // Canonical 69-wilaya dataset remains active if endpoint fails
      });
    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // Re-label options when the UI language changes without re-fetching.
    setWilayaOptions((current) =>
      current.map((o) => {
        const wil = ALGERIAN_WILAYAS.find((w) => w.name === o.value);
        return wil
          ? {
              ...o,
              label: formatWilayaLabel(
                wil.code,
                wil.nameAr,
                wil.nameFr,
                wil.name,
                language,
                o.coverageStatus
              ),
            }
          : o;
      })
    );
  }, [language]);

  // Shipping & courier coverage calculation based on wilaya and delivery method
  const calculateShipping = async (wilaya: string, method: "home" | "office") => {
    if (!wilaya) {
      setShippingFee(0);
      setShippingDeliverable(true);
      setShippingCoverageNotice(null);
      setShippingError(null);
      return;
    }
    try {
      const response = await axios.get("/api/shipping/calculate", {
        params: { wilayaId: wilaya, deliveryMethod: method },
        timeout: 8000,
      });
      const data = response.data?.data || {};
      const fee = Number(data.shippingFee);
      setShippingFee(Number.isFinite(fee) ? fee : 0);
      setShippingDeliverable(data.deliverable !== false);
      if (data.coverageNoticeAr || data.coverageNoticeFr) {
        setShippingCoverageNotice({
          ar: String(data.coverageNoticeAr || ""),
          fr: String(data.coverageNoticeFr || ""),
        });
      } else {
        setShippingCoverageNotice(null);
      }
      setShippingError(null);
    } catch (err: any) {
      const errData = err?.response?.data?.data;
      const errCode = err?.response?.data?.code;
      if (errCode === "wilaya_unserved" || errCode === "delivery_method_unavailable") {
        setShippingFee(0);
        setShippingDeliverable(false);
        setShippingCoverageNotice(null);
        setShippingError(
          language === "ar"
            ? errData?.coverageNoticeAr ||
                "التوصيل غير متوفر حالياً لهذه الولاية أو طريقة التوصيل المختارة عبر شركة التوصيل المعتمدة."
            : errData?.coverageNoticeFr ||
                err?.response?.data?.message ||
                "La livraison n'est pas disponible actuellement pour cette wilaya ou ce mode de livraison."
        );
        return;
      }
      // Do NOT silently fall back to a hardcoded fee — the customer must know
      // the shipping cost could not be retrieved. The server still computes the
      // authoritative value at order-creation time.
      console.error("Error calculating shipping:", err);
      setShippingFee(0);
      setShippingDeliverable(true);
      setShippingCoverageNotice(null);
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
        dxnMemberId: yup
          .string()
          .max(32)
          .test(
            "optional-dxn-id",
            language === "ar"
              ? "رقم العضوية يجب أن يتكون من 5 إلى 24 حرفاً أو رقماً (أو اتركه فارغاً)"
              : "Le numéro de membre doit contenir 5 à 24 lettres ou chiffres (ou laissez vide)",
            (val?: string) => {
              if (!val || val.trim() === "") return true;
              const compact = val.trim().replace(/[\s-]+/g, "");
              return /^[A-Za-z0-9]{5,24}$/.test(compact);
            }
          ),
      }),
    // deliveryMethod lives outside Formik; reflect it in the validation below.
    [language, deliveryMethod, msg.required, msg.phone]
  );

  const validateCheckoutForm = (values: {
    firstName: string;
    lastName: string;
    phone: string;
    secondPhone: string;
    dxnMemberId: string;
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
    dxnMemberId: "",
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
        if (hasInvalid) {
          setSubmitError(
            t(
              "سلتك تحتوي على منتجات غير متوفرة. ارجع إلى السلة واحذفها قبل إتمام الطلب.",
              "Votre panier contient des articles indisponibles. Retournez au panier et retirez-les avant de commander."
            )
          );
          setIsSubmitting(false);
          return;
        }
        if (!shippingDeliverable) {
          setSubmitError(
            shippingError ||
              t(
                "التوصيل غير متوفر حالياً للولاية أو طريقة التوصيل المختارة.",
                "La livraison n'est pas disponible actuellement pour la wilaya ou le mode choisi."
              )
          );
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
            cartItems: validItems.map((i) => ({
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
            dxnMemberId: values.dxnMemberId && values.dxnMemberId.trim() ? values.dxnMemberId.trim() : null,
            trafficSource: getStoredTrafficSource(),
          },
          { headers: { "Idempotency-Key": idempotencyKey.current } }
        );
        // Success screen only after a confirmed successful backend creation.
        const outcome = resolveOrderOutcome(
          response.status,
          response.data,
          language as "ar" | "fr",
          t("فشل إرسال الطلب. حاول مرة أخرى.", "Échec de l'envoi de la commande. Réessayez.")
        );
        if (outcome.showSuccess) {
          clearCart();
          const orderNumber = outcome.orderNumber || String(response.data?.data?.orderNumber || "");
          setIsSubmitting(false);
          if (orderNumber) {
            navigate(`/order-confirmation/${encodeURIComponent(orderNumber)}`, { replace: true });
          } else {
            navigate("/order-confirmation", { replace: true });
          }
          return;
        }
        setSubmitError(outcome.errorMessage || "Error");
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
    <Container className="dxn-checkout-shell mt-4 mb-5">
      <SeoHead
        title={t("إتمام الطلب", "Validation de commande")}
        canonicalPath="/checkout"
        noindex
      />
      <h2 className="dxn-section-title h3 mb-4">{t("إتمام الطلب", "Commande")}</h2>

      {submitError && (
        <Alert variant="danger" role="alert" aria-live="assertive" onClose={() => setSubmitError(null)} dismissible className="dxn-feedback-error">
          {submitError}
        </Alert>
      )}
      {shippingError && (
        <Alert variant="warning" role="status" aria-live="polite" className="dxn-feedback-error">
          {shippingError}
        </Alert>
      )}
      {hasInvalid && (
        <Alert variant="warning" role="status" aria-live="polite" className="dxn-feedback-error">
          {t(
            "سلتك تحتوي على منتجات غير متوفرة أو ملغاة من المتجر. ارجع إلى السلة واحذفها قبل إتمام الطلب.",
            "Votre panier contient des articles indisponibles ou retirés de la boutique. Retournez au panier et retirez-les avant de commander."
          )}
        </Alert>
      )}
      {items.length === 0 && (
        <Alert variant="info" role="status" aria-live="polite" className="dxn-feedback-success">
          {t("السلة فارغة — أضف منتجات قبل إتمام الطلب.", "Panier vide — ajoutez des produits avant de commander.")}{" "}
          <span>
            <Button as="a" href="/products" variant="link" className="p-0 fw-bold" style={{ color: "#1a5d3a" }}>
              {t("تصفح المنتجات", "Parcourir les produits")}
            </Button>
          </span>
        </Alert>
      )}

      <Row className="g-4">
        <Col lg={8}>
          <Form onSubmit={formik.handleSubmit} noValidate>
            {/* Customer info */}
            <div className="dxn-form-card dxn-anim-fade-up">
              <div className="dxn-form-card-head">
                <span className="dxn-step">1</span>
                {t("معلومات العميل", "Informations client")}
              </div>
              <div className="dxn-form-card-body">
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

                {/* Phase 5: Optional DXN Membership Number */}
                <Row>
                  <Col xs={12}>
                    <Form.Group controlId="formDxnMemberId" className="mb-3">
                      <Form.Label>
                        {t("رقم عضوية DXN (اختياري)", "Numéro de membre DXN (optionnel)")}
                      </Form.Label>
                      <Form.Control
                        type="text"
                        name="dxnMemberId"
                        value={formik.values.dxnMemberId}
                        onChange={formik.handleChange}
                        onBlur={formik.handleBlur}
                        placeholder={t(
                          "أدخل رقم عضويتك إن وجد",
                          "Saisissez votre numéro de membre si vous en avez un"
                        )}
                        autoComplete="off"
                        isInvalid={!!(formik.touched.dxnMemberId && formik.errors.dxnMemberId)}
                      />
                      <Form.Text className="text-muted">
                        {t(
                          "الشراء متاح للجميع بدون عضوية. إذا كنت عضواً حالياً في DXN يمكنك كتابة رقمك هنا ليُرفق بطلبك.",
                          "L'achat est ouvert à tous sans adhésion. Si vous êtes déjà membre DXN, indiquez votre numéro ici (facultatif)."
                        )}
                      </Form.Text>
                      <Form.Control.Feedback type="invalid">{formik.errors.dxnMemberId}</Form.Control.Feedback>
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

                {shippingError && (
                  <Alert variant={!shippingDeliverable ? "warning" : "secondary"} className="py-2 small mb-3">
                    {shippingError}
                  </Alert>
                )}

                {!shippingError &&
                  shippingCoverageNotice &&
                  (language === "ar" ? shippingCoverageNotice.ar : shippingCoverageNotice.fr) && (
                    <Alert variant="info" className="py-2 small mb-3">
                      {language === "ar" ? shippingCoverageNotice.ar : shippingCoverageNotice.fr}
                    </Alert>
                  )}

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
              </div>
            </div>

            {/* Delivery method */}
            <div className="dxn-form-card dxn-anim-fade-up">
              <div className="dxn-form-card-head">
                <span className="dxn-step">2</span>
                {t("طريقة التوصيل", "Méthode de livraison")}
              </div>
              <div className="dxn-form-card-body">
                <Row>
                  <Col xs={12} md={6}>
                    <div className={"dxn-radio-option" + (deliveryMethod === "home" ? " has-check" : "")}>
                      <Form.Check
                        type="radio"
                        label={t("التوصيل للمنزل", "Livraison à domicile")}
                        name="deliveryMethod"
                        value="home"
                        id="delivery-home"
                        checked={deliveryMethod === "home"}
                        onChange={() => switchDeliveryMethod("home")}
                      />
                    </div>
                  </Col>
                  <Col xs={12} md={6}>
                    <div className={"dxn-radio-option" + (deliveryMethod === "office" ? " has-check" : "")}>
                      <Form.Check
                        type="radio"
                        label={t("التوصيل لمكتب البريد", "Livraison en bureau de poste")}
                        name="deliveryMethod"
                        value="office"
                        id="delivery-office"
                        checked={deliveryMethod === "office"}
                        onChange={() => switchDeliveryMethod("office")}
                      />
                    </div>
                  </Col>
                </Row>
              </div>
            </div>

            {/* Payment method */}
            <div className="dxn-form-card dxn-anim-fade-up">
              <div className="dxn-form-card-head">
                <span className="dxn-step">3</span>
                {t("طريقة الدفع", "Méthode de paiement")}
              </div>
              <div className="dxn-form-card-body">
                <Row>
                  <Col xs={12}>
                    <div className={"dxn-radio-option" + (paymentMethod === "cod" ? " has-check" : "")}>
                      <Form.Check
                        type="radio"
                        label={t("الدفع عند الاستلام", "Paiement à la livraison")}
                        name="paymentMethod"
                        value="cod"
                        id="payment-cod"
                        checked={paymentMethod === "cod"}
                        onChange={() => setPaymentMethod("cod")}
                      />
                    </div>
                  </Col>
                </Row>
              </div>
            </div>

            {/* Confirmation */}
            <div className="dxn-form-card dxn-anim-fade-up">
              <div className="dxn-form-card-head">
                <span className="dxn-step">4</span>
                {t("التأكيد", "Confirmation")}
              </div>
              <div className="dxn-form-card-body">
                <Form.Group className="mb-3" controlId="formConfirm">
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
                  className="w-100 dxn-btn dxn-btn-gold"
                  disabled={
                    isSubmitting ||
                    !confirmed ||
                    items.length === 0 ||
                    hasInvalid ||
                    !catalogChecked ||
                    !shippingDeliverable
                  }
                  aria-busy={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <span className="dxn-btn-spinner" aria-hidden="true"></span>
                      {t("جارٍ الإرسال...", "Envoi en cours...")}
                    </>
                  ) : hasInvalid ? (
                    t("احذف المنتجات غير المتوفرة أولاً", "Retirez d'abord les articles indisponibles")
                  ) : (
                    t("تأكيد الطلب", "Confirmer la commande")
                  )}
                </Button>
              </div>
            </div>
          </Form>
        </Col>

        {/* Summary */}
        <Col lg={4}>
          <div className="dxn-summary dxn-anim-fade-up">
            <div className="dxn-summary-title">{t("ملخص الطلب", "Récapitulatif")}</div>
            <div className="dxn-summary-row">
              <span>{t("عدد المنتجات", "Articles")}</span>
              <strong>{validItems.length}</strong>
            </div>
            <div className="dxn-summary-row">
              <span>{t("المجموع الفرعي", "Sous-total")}</span>
              <strong>{subtotal.toLocaleString("fr-DZ")} DA</strong>
            </div>
            <div className="dxn-summary-row">
              <span>{t("رسوم الشحن", "Frais de port")}</span>
              <strong>{shippingFee > 0 ? `${shippingFee.toLocaleString("fr-DZ")} DA` : t("—", "—")}</strong>
            </div>
            <div className="dxn-summary-total">
              <span>{t("المجموع", "Total")}</span>
              <span>{total.toLocaleString("fr-DZ")} DA</span>
            </div>
            <p className="dxn-subnote mt-3 mb-0">
              {t(
                "يتم تأكيد الطلب عبر الهاتف قبل الشحن.",
                "La commande sera confirmée par téléphone avant l'expédition."
              )}
            </p>
          </div>
        </Col>
      </Row>
    </Container>
  );
};

export default CheckoutPage;
