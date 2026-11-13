import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Form, Row, Col, Alert, Button } from "react-bootstrap";
import { useFormik } from "formik";
import * as yup from "yup";
import api from "../services/api";
import SeoHead from "../components/SeoHead";
import { useLanguage } from "../context/LanguageContext";
import { useSiteSettings } from "../context/SiteSettingsContext";
import { usePublicContent } from "../hooks/usePublicContent";
import { getStoredTrafficSource } from "../utils/referralAttribution";

const COUNTRIES = [
  { value: "Algeria", ar: "الجزائر", fr: "Algérie" },
  { value: "Morocco", ar: "المغرب", fr: "Maroc" },
  { value: "Tunisia", ar: "تونس", fr: "Tunisie" },
  { value: "Mauritania", ar: "موريتانيا", fr: "Mauritanie" },
  { value: "Libya", ar: "ليبيا", fr: "Libye" },
  { value: "Egypt", ar: "مصر", fr: "Égypte" },
  { value: "Saudi Arabia", ar: "المملكة العربية السعودية", fr: "Arabie saoudite" },
  { value: "UAE", ar: "الإمارات العربية المتحدة", fr: "Émirats arabes unis" },
  { value: "Qatar", ar: "قطر", fr: "Qatar" },
  { value: "Kuwait", ar: "الكويت", fr: "Koweït" },
  { value: "Jordan", ar: "الأردن", fr: "Jordanie" },
  { value: "Iraq", ar: "العراق", fr: "Iراق / Irak" },
  { value: "France", ar: "فرنسا", fr: "France" },
  { value: "Belgium", ar: "بلجيكا", fr: "Belgique" },
  { value: "Canada", ar: "كندا", fr: "Canada" },
  { value: "Spain", ar: "إسبانيا", fr: "Espagne" },
  { value: "Turkey", ar: "تركيا", fr: "Turquie" },
  { value: "Malaysia", ar: "ماليزيا", fr: "Malaisie" },
  { value: "Other", ar: "دولة أخرى", fr: "Autre pays" },
];

const JoinTeamPage: React.FC = () => {
  const { language } = useLanguage();
  const { settings } = useSiteSettings();
  const { faqs } = usePublicContent();
  const [submittedRef, setSubmittedRef] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [copiedSponsor, setCopiedSponsor] = useState(false);

  const tx = (ar: string, fr: string) => (language === "ar" ? ar : fr);

  const validationSchema = yup.object({
    firstName: yup
      .string()
      .trim()
      .min(2, tx("يرجى إدخال الاسم الأول", "Veuillez saisir votre prénom"))
      .max(100)
      .required(tx("الاسم الأول مطلوب", "Le prénom est requis")),
    lastName: yup
      .string()
      .trim()
      .min(2, tx("يرجى إدخال اللقب / اسم العائلة", "Veuillez saisir votre nom"))
      .max(100)
      .required(tx("اسم العائلة مطلوب", "Le nom est requis")),
    country: yup
      .string()
      .trim()
      .required(tx("الدولة مطلوبة", "Le pays est requis")),
    phone: yup
      .string()
      .trim()
      .test(
        "intl-phone",
        tx("يرجى إدخال رقم هاتف صحيح (8 إلى 15 رقماً)", "Veuillez saisir un numéro valide (8 à 15 chiffres)"),
        (val) => {
          if (!val) return false;
          if (!/^\+?[\d\s()-]{7,25}$/.test(val.trim())) return false;
          const digits = val.replace(/\D/g, "");
          return digits.length >= 8 && digits.length <= 15;
        }
      )
      .required(tx("رقم الهاتف مطلوب", "Le numéro de téléphone est requis")),
    preferredContactMethod: yup
      .string()
      .oneOf(["whatsapp", "phone", "telegram", "email"])
      .required(tx("اختر وسيلة التواصل المفضلة", "Choisissez un moyen de contact")),
    email: yup
      .string()
      .trim()
      .email(tx("بريد إلكتروني غير صحيح", "Adresse e-mail invalide"))
      .max(160)
      .optional(),
    existingMembershipNumber: yup
      .string()
      .trim()
      .max(32)
      .test(
        "opt-member",
        tx("رقم العضوية يتكون من 5 إلى 24 حرفاً أو رقماً", "5 à 24 caractères alphanumériques"),
        (val) => {
          if (!val || val.trim() === "") return true;
          return /^[A-Za-z0-9]{5,24}$/.test(val.trim().replace(/[\s-]+/g, ""));
        }
      )
      .optional(),
    message: yup.string().max(2000).optional(),
    privacyConsent: yup
      .boolean()
      .oneOf([true], tx("يرجى الموافقة على سياسة الخصوصية للتواصل معك", "Veuillez accepter la politique de confidentialité")),
    website: yup.string().optional(),
  });

  const formik = useFormik({
    initialValues: {
      firstName: "",
      lastName: "",
      country: "Algeria",
      phone: "",
      preferredContactMethod: "whatsapp",
      email: "",
      existingMembershipNumber: "",
      message: "",
      privacyConsent: false,
      website: "",
    },
    validationSchema,
    onSubmit: async (values, helpers) => {
      setSubmitError(null);
      try {
        const res = await api.post("/leads", {
          firstName: values.firstName.trim(),
          lastName: values.lastName.trim(),
          country: values.country,
          phone: values.phone.trim(),
          preferredContactMethod: values.preferredContactMethod,
          email: values.email.trim() || undefined,
          existingMembershipNumber: values.existingMembershipNumber.trim() || null,
          message: values.message.trim(),
          privacyConsent: values.privacyConsent,
          website: values.website,
          trafficSource: getStoredTrafficSource(),
        });
        const ref = res?.data?.data?.leadReference || "LEAD-RECEIVED";
        setSubmittedRef(ref);
        helpers.resetForm();
      } catch (err: any) {
        setSubmitError(
          err?.response?.data?.message ||
            tx("تعذر إرسال الطلب حالياً. يرجى المحاولة بعد قليل.", "Impossible d'envoyer la demande. Veuillez réessayer.")
        );
      } finally {
        helpers.setSubmitting(false);
      }
    },
  });

  const copySponsorId = async () => {
    if (!settings.sponsorMembershipNumber || !navigator?.clipboard) return;
    try {
      await navigator.clipboard.writeText(settings.sponsorMembershipNumber);
      setCopiedSponsor(true);
      setTimeout(() => setCopiedSponsor(false), 2500);
    } catch {
      // Ignore clipboard permission rejection
    }
  };

  const membershipFaqs = faqs.filter((f) => f.category === "membership");

  return (
    <div className="dxn-page">
      <SeoHead
        title={tx("انضم إلى فريق DXN NADZ", "Rejoindre l'équipe DXN NADZ")}
        description={tx(
          "تعرّف بشفافية على نظام العضوية والبيع المباشر في DXN، وقدّم طلب الانضمام إلى فريق DXN NADZ للحصول على المرافقة والتدريب.",
          "Comprenez de manière transparente l'adhésion et la vente directe DXN et rejoignez l'équipe DXN NADZ."
        )}
        canonicalPath="/join"
      />

      {/* Hero */}
      <section className="dxn-hero" style={{ padding: "3.5rem 0" }}>
        <div className="container">
          <span className="dxn-hero-eyebrow">{tx("فرصة العمل الجماعي المنظم", "Accompagnement & Réseau DXN")}</span>
          <h1 className="mb-2">{tx("انضم إلى فريق DXN NADZ", "Rejoindre l'équipe DXN NADZ")}</h1>
          <p className="dxn-hero-lead mb-0">
            {tx(
              "نموذج بيع مباشر واضح ومرافقة تدريبية خطوة بخطوة لفهم المنتجات وإجراءات التسجيل الرسمي بشفافية كاملة.",
              "Un modèle de vente directe transparent et un accompagnement structuré étape par étape."
            )}
          </p>
        </div>
      </section>

      <section className="dxn-section">
        <div className="container">
          {/* Income & Registration Compliance Banner */}
          <div className="dxn-compliance-banner mb-5">
            <strong>{tx("إفصاح الشفافية والأخلاقيات المهنية:", "Déclaration de transparence et d'éthique :")}</strong>{" "}
            {tx(
              "الانضمام عبر هذا النموذج هو طلب تواصل واستشارة للالتحاق بفريق DXN NADZ، ولا يُنشئ عضوية رسمية تلقائياً في شركة DXN دون مراجعتك وموافقتك الكاملة. كما نؤكد بوضوح أنه لا توجد أرباح مضمونة أو دخل ثابت أو ثراء سريع؛ فالعوائد في نظام البيع المباشر ترتبط حصرياً بالمبيعات الفعلية للمنتجات والجهد الشخصي والتعلم المستمر.",
              "L'envoi de ce formulaire constitue une demande d'accompagnement auprès de l'équipe DXN NADZ et ne crée pas automatiquement de compte officiel DXN. Aucun revenu n'est garanti ni automatique : les résultats dépendent exclusivement des ventes réelles de produits, de l'apprentissage et de l'effort personnel."
            )}
          </div>

          {/* Comparison: Customer vs Member */}
          <div className="row g-4 mb-5">
            <div className="col-md-6">
              <div className="dxn-info-card">
                <span className="badge rounded-pill mb-2" style={{ background: "#eef4ff", color: "#1e40af" }}>
                  {tx("الخيار الأول", "Option 1")}
                </span>
                <h2 className="h4 fw-bold mb-2">{tx("التسوق كعميل مباشر", "Acheter en tant que client")}</h2>
                <ul className="text-muted mb-3" style={{ lineHeight: 1.9 }}>
                  <li>{tx("لا يتطلب أي تسجيل أو رقم عضوية.", "Aucune inscription ni numéro de membre requis.")}</li>
                  <li>{tx("طلب المنتجات مباشرة والدفع عند الاستلام.", "Commande directe sur la boutique avec paiement à la livraison.")}</li>
                  <li>{tx("بدون أي التزامات شهرية أو متطلبات تسويقية.", "Aucune obligation mensuelle ni activité commerciale.")}</li>
                </ul>
                <Link to="/products" className="dxn-btn dxn-btn-outline btn-sm">
                  {tx("تسوّق كعميل الآن", "Parcourir la boutique")}
                </Link>
              </div>
            </div>

            <div className="col-md-6">
              <div className="dxn-info-card" style={{ borderColor: "rgba(15, 95, 47, 0.35)" }}>
                <span className="badge rounded-pill mb-2" style={{ background: "#e6f4ec", color: "#0b3d1f" }}>
                  {tx("الخيار الثاني", "Option 2")}
                </span>
                <h2 className="h4 fw-bold mb-2">{tx("الانضمام كعضو في فريق DXN NADZ", "Rejoindre comme membre DXN")}</h2>
                <ul className="text-muted mb-3" style={{ lineHeight: 1.9 }}>
                  <li>{tx("الحصول على رقم عضوية رسمي خاص بك بعد استكمال التسجيل الرسمي.", "Obtention d'un identifiant officiel DXN après inscription validée.")}</li>
                  <li>{tx("الاستفادة من نظام النقاط (PV) ومزايا الأعضاء وفق لوائح DXN.", "Accès au système de points (PV) et aux avantages membres officiels.")}</li>
                  <li>{tx("تدريب ومرافقة مستمرة من فريق DXN NADZ حول المنتجات والتسويق المسؤول.", "Formation et mentorat continus par l'équipe DXN NADZ.")}</li>
                </ul>
                <a href="#join-form" className="dxn-btn dxn-btn-primary btn-sm">
                  {tx("انتقل إلى نموذج الانضمام ↓", "Aller au formulaire d'adhésion ↓")}
                </a>
              </div>
            </div>
          </div>

          <Row className="g-4 align-items-start" id="join-form">
            {/* Left Column: Sponsor ID Box + Onboarding Steps */}
            <Col lg={5}>
              {/* Read-Only Sponsor Membership Number Card (Phase 6.1) */}
              <div className="dxn-sponsor-box mb-4">
                <div className="small text-uppercase fw-bold mb-1" style={{ color: "#fce588" }}>
                  {tx("رقم عضوية الراعي / الدليل الرسمي (للقراءة فقط)", "Numéro de parrain officiel (lecture seule)")}
                </div>
                <p className="small mb-3" style={{ color: "rgba(255,255,255,0.88)", lineHeight: 1.7 }}>
                  {tx(
                    "يُستخدم رقم الراعي لتوثيق ارتباطك بفريق DXN NADZ أثناء التسجيل الرسمي لدى شركة DXN (هذا هو رقم قائد الفريق وليس رقم عضوية جديداً خاصاً بك).",
                    "Cet identifiant de parrainage rattache votre future inscription officielle à l'équipe DXN NADZ (il s'agit du numéro du parrain et non de votre futur identifiant personnel)."
                  )}
                </p>

                {settings.sponsorConfigured && settings.sponsorMembershipNumber ? (
                  <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
                    <output
                      className="dxn-sponsor-code"
                      aria-readonly="true"
                      aria-label={tx("رقم عضوية الراعي", "Numéro de parrain")}
                    >
                      {settings.sponsorMembershipNumber}
                    </output>
                    <button
                      type="button"
                      className="dxn-btn dxn-btn-gold btn-sm"
                      onClick={copySponsorId}
                    >
                      {copiedSponsor ? tx("تم النسخ ✓", "Copié ✓") : tx("نسخ الرقم", "Copier")}
                    </button>
                  </div>
                ) : (
                  <div
                    className="p-3 rounded-3 small"
                    style={{ background: "rgba(255,255,255,0.12)", border: "1px dashed rgba(255,255,255,0.3)" }}
                  >
                    {tx(
                      "رقم الراعي قيد الضبط من إدارة المنصة — سيتم تزويدك برقم الراعي الرسمي مباشرة فور تواصل فريق DXN NADZ معك.",
                      "Le numéro de parrain officiel vous sera communiqué directement par l'équipe DXN NADZ lors de la prise de contact."
                    )}
                  </div>
                )}
              </div>

              {/* Onboarding Mentorship Steps */}
              <div className="dxn-info-card">
                <h3 className="h5 fw-bold mb-3">{tx("ماذا يحدث بعد إرسال طلبك؟", "Que se passe-t-il après votre demande ?")}</h3>
                <ol className="ps-3 mb-0 text-muted d-grid gap-2" style={{ lineHeight: 1.8 }}>
                  <li>
                    {tx(
                      "تستلم فوراً رقماً مرجعياً لطلبك ويصل إشعار فوري لفريق إدارة DXN NADZ.",
                      "Vous recevez immédiatement une référence de suivi et notre équipe est notifiée."
                    )}
                  </li>
                  <li>
                    {tx(
                      "نتواصل معك عبر وسيلتك المفضلة (واتساب، هاتف، تيليجرام، أو إيميل) للإجابة عن أسئلتك.",
                      "Nous vous contactons via votre canal préféré pour répondre à toutes vos questions."
                    )}
                  </li>
                  <li>
                    {tx(
                      "نوضح لك متطلبات التسجيل الرسمي في بلد إقامتك دون طلب بيانات حساسة غير لازمة مسبقاً.",
                      "Nous vous guidons dans la procédure officielle propre à votre pays de résidence."
                    )}
                  </li>
                  <li>
                    {tx(
                      "تبدأ خطة التعريف بالمنتجات والتدريب العملي مع الفريق.",
                      "Vous accédez à la formation produits et à l'accompagnement de l'équipe."
                    )}
                  </li>
                </ol>
              </div>
            </Col>

            {/* Right Column: Recruitment Form (Phase 6.2 & 6.3) */}
            <Col lg={7}>
              <div className="dxn-form-card">
                <div className="dxn-form-card-head">
                  <span className="dxn-step">★</span>
                  {tx("نموذج طلب الانضمام إلى فريق DXN NADZ", "Formulaire de demande d'adhésion à l'équipe")}
                </div>
                <div className="dxn-form-card-body">
                  {submittedRef ? (
                    <div className="py-4 text-center">
                      <div
                        className="d-inline-flex align-items-center justify-content-center rounded-circle mb-3"
                        style={{ width: 64, height: 64, background: "#e6f4ec", color: "#0b3d1f", fontSize: "1.75rem" }}
                      >
                        ✓
                      </div>
                      <h2 className="h4 fw-bold mb-2">
                        {tx("تم استلام طلب الانضمام بنجاح!", "Votre demande a bien été enregistrée !")}
                      </h2>
                      <p className="text-muted mb-3">
                        {tx(
                          "شكراً لاهتمامك بالانضمام إلى فريق DXN NADZ. سيقوم فريقنا بمراجعة بياناتك والتواصل معك عبر الوسيلة التي اخترتها قريباً.",
                          "Merci pour votre intérêt. Notre équipe examinera votre demande et vous recontactera très prochainement."
                        )}
                      </p>
                      <div className="p-3 rounded-3 mb-4 d-inline-block" style={{ background: "#f4f7f5", border: "1px solid #d5e2d9" }}>
                        <div className="small text-muted">{tx("الرقم المرجعي لطلبك:", "Référence de votre demande :")}</div>
                        <div className="fw-bold fs-5" style={{ color: "#0b3d1f", fontFamily: "monospace" }}>
                          {submittedRef}
                        </div>
                      </div>
                      <div className="d-flex justify-content-center gap-3 flex-wrap">
                        <Button variant="outline-success" onClick={() => setSubmittedRef(null)}>
                          {tx("إرسال طلب آخر", "Nouvelle demande")}
                        </Button>
                        <Link to="/education" className="dxn-btn dxn-btn-primary">
                          {tx("تصفّح مركز المعرفة ريثما نتواصل معك", "Découvrir le centre éducatif")}
                        </Link>
                      </div>
                    </div>
                  ) : (
                    <Form onSubmit={formik.handleSubmit} noValidate>
                      {submitError && (
                        <Alert variant="danger" dismissible onClose={() => setSubmitError(null)}>
                          {submitError}
                        </Alert>
                      )}

                      {/* Honeypot anti-spam field */}
                      <div className="dxn-honeypot" aria-hidden="true">
                        <label htmlFor="join-website">Website</label>
                        <input
                          id="join-website"
                          type="text"
                          name="website"
                          tabIndex={-1}
                          autoComplete="off"
                          value={formik.values.website}
                          onChange={formik.handleChange}
                        />
                      </div>

                      <Row className="g-3">
                        <Col sm={6}>
                          <Form.Group controlId="joinFirstName">
                            <Form.Label>{tx("الاسم الأول", "Prénom")} *</Form.Label>
                            <Form.Control
                              type="text"
                              name="firstName"
                              value={formik.values.firstName}
                              onChange={formik.handleChange}
                              onBlur={formik.handleBlur}
                              isInvalid={Boolean(formik.touched.firstName && formik.errors.firstName)}
                              required
                            />
                            <Form.Control.Feedback type="invalid">{formik.errors.firstName}</Form.Control.Feedback>
                          </Form.Group>
                        </Col>

                        <Col sm={6}>
                          <Form.Group controlId="joinLastName">
                            <Form.Label>{tx("اسم العائلة / اللقب", "Nom")} *</Form.Label>
                            <Form.Control
                              type="text"
                              name="lastName"
                              value={formik.values.lastName}
                              onChange={formik.handleChange}
                              onBlur={formik.handleBlur}
                              isInvalid={Boolean(formik.touched.lastName && formik.errors.lastName)}
                              required
                            />
                            <Form.Control.Feedback type="invalid">{formik.errors.lastName}</Form.Control.Feedback>
                          </Form.Group>
                        </Col>

                        <Col sm={6}>
                          <Form.Group controlId="joinCountry">
                            <Form.Label>{tx("بلد الإقامة", "Pays de résidence")} *</Form.Label>
                            <Form.Select
                              name="country"
                              value={formik.values.country}
                              onChange={formik.handleChange}
                              onBlur={formik.handleBlur}
                              isInvalid={Boolean(formik.touched.country && formik.errors.country)}
                              required
                            >
                              {COUNTRIES.map((c) => (
                                <option key={c.value} value={c.value}>
                                  {language === "ar" ? c.ar : c.fr}
                                </option>
                              ))}
                            </Form.Select>
                            <Form.Control.Feedback type="invalid">{formik.errors.country}</Form.Control.Feedback>
                          </Form.Group>
                        </Col>

                        <Col sm={6}>
                          <Form.Group controlId="joinPhone">
                            <Form.Label>{tx("رقم الهاتف (مع رمز الدولة إن لزم)", "Téléphone")} *</Form.Label>
                            <Form.Control
                              type="tel"
                              name="phone"
                              placeholder={tx("مثال: 0550123456 أو +213...", "Ex: 0550123456 ou +213...")}
                              value={formik.values.phone}
                              onChange={formik.handleChange}
                              onBlur={formik.handleBlur}
                              isInvalid={Boolean(formik.touched.phone && formik.errors.phone)}
                              required
                            />
                            <Form.Control.Feedback type="invalid">{formik.errors.phone}</Form.Control.Feedback>
                          </Form.Group>
                        </Col>

                        <Col sm={6}>
                          <Form.Group controlId="joinPreferredContact">
                            <Form.Label>{tx("وسيلة التواصل المفضلة", "Moyen de contact préféré")} *</Form.Label>
                            <Form.Select
                              name="preferredContactMethod"
                              value={formik.values.preferredContactMethod}
                              onChange={formik.handleChange}
                              onBlur={formik.handleBlur}
                            >
                              <option value="whatsapp">{tx("واتساب (WhatsApp)", "WhatsApp")}</option>
                              <option value="phone">{tx("مكالمة هاتفية", "Appel téléphonique")}</option>
                              <option value="telegram">{tx("تيليجرام (Telegram)", "Telegram")}</option>
                              <option value="email">{tx("البريد الإلكتروني", "E-mail")}</option>
                            </Form.Select>
                          </Form.Group>
                        </Col>

                        <Col sm={6}>
                          <Form.Group controlId="joinEmail">
                            <Form.Label>{tx("البريد الإلكتروني (اختياري)", "E-mail (optionnel)")}</Form.Label>
                            <Form.Control
                              type="email"
                              name="email"
                              value={formik.values.email}
                              onChange={formik.handleChange}
                              onBlur={formik.handleBlur}
                              isInvalid={Boolean(formik.touched.email && formik.errors.email)}
                            />
                            <Form.Control.Feedback type="invalid">{formik.errors.email}</Form.Control.Feedback>
                          </Form.Group>
                        </Col>

                        <Col xs={12}>
                          <Form.Group controlId="joinExistingMember">
                            <Form.Label>
                              {tx("رقم عضوية DXN حالي إن وجد (اختياري)", "Numéro de membre DXN existant (optionnel)")}
                            </Form.Label>
                            <Form.Control
                              type="text"
                              name="existingMembershipNumber"
                              placeholder={tx(
                                "اتركه فارغاً إذا لم يسبق لك التسجيل في DXN",
                                "Laissez vide si vous n'êtes pas encore membre DXN"
                              )}
                              value={formik.values.existingMembershipNumber}
                              onChange={formik.handleChange}
                              onBlur={formik.handleBlur}
                              isInvalid={Boolean(
                                formik.touched.existingMembershipNumber && formik.errors.existingMembershipNumber
                              )}
                            />
                            <Form.Control.Feedback type="invalid">
                              {formik.errors.existingMembershipNumber}
                            </Form.Control.Feedback>
                          </Form.Group>
                        </Col>

                        <Col xs={12}>
                          <Form.Group controlId="joinMessage">
                            <Form.Label>{tx("ملاحظات أو استفسارات إضافية (اختياري)", "Message ou questions (optionnel)")}</Form.Label>
                            <Form.Control
                              as="textarea"
                              rows={3}
                              name="message"
                              placeholder={tx(
                                "أخبرنا عن هدفك أو أي سؤال تود الاستفسار عنه...",
                                "Partagez vos objectifs ou vos questions..."
                              )}
                              value={formik.values.message}
                              onChange={formik.handleChange}
                              onBlur={formik.handleBlur}
                              isInvalid={Boolean(formik.touched.message && formik.errors.message)}
                            />
                            <Form.Control.Feedback type="invalid">{formik.errors.message}</Form.Control.Feedback>
                          </Form.Group>
                        </Col>

                        <Col xs={12}>
                          <Form.Group controlId="joinConsent">
                            <Form.Check
                              type="checkbox"
                              name="privacyConsent"
                              checked={formik.values.privacyConsent}
                              onChange={formik.handleChange}
                              isInvalid={Boolean(formik.touched.privacyConsent && formik.errors.privacyConsent)}
                              label={
                                <span className="small">
                                  {tx(
                                    "أوافق على معالجة بياناتي من قِبل فريق DXN NADZ لغرض التواصل معي بخصوص طلب الانضمام وفق ",
                                    "J'accepte le traitement de mes données par l'équipe DXN NADZ afin d'être recontacté conformément à la "
                                  )}
                                  <Link to="/privacy" target="_blank">
                                    {tx("سياسة الخصوصية", "politique de confidentialité")}
                                  </Link>
                                  . *
                                </span>
                              }
                            />
                            {formik.touched.privacyConsent && formik.errors.privacyConsent && (
                              <div className="text-danger small mt-1">{formik.errors.privacyConsent}</div>
                            )}
                          </Form.Group>
                        </Col>

                        <Col xs={12} className="pt-2">
                          <Button
                            type="submit"
                            className="dxn-btn dxn-btn-gold dxn-btn-lg w-100"
                            disabled={formik.isSubmitting}
                          >
                            {formik.isSubmitting
                              ? tx("جارٍ إرسال الطلب...", "Envoi en cours...")
                              : tx("إرسال طلب الانضمام إلى الفريق", "Envoyer ma demande d'adhésion")}
                          </Button>
                        </Col>
                      </Row>
                    </Form>
                  )}
                </div>
              </div>
            </Col>
          </Row>

          {/* Recruitment FAQ Section */}
          {membershipFaqs.length > 0 && (
            <div className="mt-5 pt-4 border-top">
              <h2 className="dxn-section-title mb-4">
                {tx("أسئلة شائعة حول العضوية والانضمام", "Questions fréquentes sur l'adhésion")}
              </h2>
              <div className="row g-3">
                {membershipFaqs.map((f) => {
                  const loc = language === "ar" ? f.ar : f.fr;
                  return (
                    <div key={f.slug} className="col-md-6">
                      <div className="dxn-info-card">
                        <h3 className="h6 fw-bold mb-2">{loc.question}</h3>
                        <p className="text-muted small mb-0" style={{ lineHeight: 1.8 }}>{loc.answer}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default JoinTeamPage;
