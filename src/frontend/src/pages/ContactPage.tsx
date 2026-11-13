import React, { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Form, Row, Col, Alert, Button } from "react-bootstrap";
import { useFormik } from "formik";
import * as yup from "yup";
import api from "../services/api";
import SeoHead from "../components/SeoHead";
import { useLanguage } from "../context/LanguageContext";
import { useSiteSettings } from "../context/SiteSettingsContext";
import { getStoredTrafficSource } from "../utils/referralAttribution";
import { STORE_EMAIL } from "../config/site";

const ContactPage: React.FC = () => {
  const { language } = useLanguage();
  const { settings } = useSiteSettings();
  const [searchParams] = useSearchParams();
  const initialSubject = searchParams.get("subject") || "";

  const [submittedRef, setSubmittedRef] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const tx = (ar: string, fr: string) => (language === "ar" ? ar : fr);

  const validationSchema = yup
    .object({
      name: yup
        .string()
        .trim()
        .min(2, tx("يرجى إدخال الاسم الكامل", "Veuillez saisir votre nom"))
        .max(150)
        .required(tx("الاسم مطلوب", "Le nom est requis")),
      phone: yup.string().trim().max(30).optional(),
      email: yup
        .string()
        .trim()
        .email(tx("بريد إلكتروني غير صحيح", "Adresse e-mail invalide"))
        .max(160)
        .optional(),
      subject: yup.string().trim().max(200).optional(),
      message: yup
        .string()
        .trim()
        .min(5, tx("يرجى كتابة رسالتك بوضوح", "Votre message est trop court"))
        .max(3000)
        .required(tx("الرسالة مطلوبة", "Le message est requis")),
      privacyConsent: yup
        .boolean()
        .oneOf([true], tx("يرجى الموافقة على سياسة الخصوصية", "Veuillez accepter la politique de confidentialité")),
      website: yup.string().optional(),
    })
    .test(
      "phone-or-email",
      tx("يرجى إدخال رقم الهاتف أو البريد الإلكتروني لنتمكن من الرد عليك", "Indiquez au moins un téléphone ou un e-mail"),
      (val) => Boolean((val?.phone && val.phone.trim()) || (val?.email && val.email.trim()))
    );

  const formik = useFormik({
    initialValues: {
      name: "",
      phone: "",
      email: "",
      subject: initialSubject,
      message: "",
      privacyConsent: false,
      website: "",
    },
    validationSchema,
    onSubmit: async (values, helpers) => {
      setSubmitError(null);
      try {
        const res = await api.post("/contact", {
          name: values.name.trim(),
          phone: values.phone.trim() || undefined,
          email: values.email.trim() || undefined,
          subject: values.subject.trim() || undefined,
          message: values.message.trim(),
          privacyConsent: values.privacyConsent,
          website: values.website,
          trafficSource: getStoredTrafficSource(),
        });
        setSubmittedRef(res?.data?.data?.reference || "MSG-RECEIVED");
        helpers.resetForm();
      } catch (err: any) {
        setSubmitError(
          err?.response?.data?.message ||
            tx("تعذر إرسال الرسالة حالياً. يرجى المحاولة مرة أخرى.", "Impossible d'envoyer le message pour le moment.")
        );
      } finally {
        helpers.setSubmitting(false);
      }
    },
  });

  const email = settings.contactEmail || STORE_EMAIL;
  const socials = settings.socialLinks;

  return (
    <div className="dxn-page">
      <SeoHead
        title={tx("تواصل معنا — DXN NADZ", "Contactez-nous — DXN NADZ")}
        description={tx(
          "تواصل مع فريق DXN NADZ للاستفسار عن المنتجات، الطلبات، أو الانضمام إلى الفريق.",
          "Contactez l'équipe DXN NADZ pour toute question sur les produits, commandes ou l'équipe."
        )}
        canonicalPath="/contact"
      />

      <section className="dxn-hero" style={{ padding: "3.5rem 0" }}>
        <div className="container">
          <span className="dxn-hero-eyebrow">{tx("خدمة العملاء والاستفسارات", "Contact & Assistance")}</span>
          <h1 className="mb-2">{tx("تواصل مع فريق DXN NADZ", "Contacter l'équipe DXN NADZ")}</h1>
          <p className="dxn-hero-lead mb-0">
            {tx(
              "يسعدنا الرد على استفساراتكم بخصوص المنتجات المتوفرة، متابعة الطلبات، أو خطوات الانضمام إلى الفريق.",
              "Nous répondons avec plaisir à vos questions concernant nos produits, vos commandes ou l'accompagnement d'équipe."
            )}
          </p>
        </div>
      </section>

      <section className="dxn-section">
        <div className="container">
          <Row className="g-4">
            <Col lg={5}>
              <div className="dxn-info-card">
                <h2 className="h5 fw-bold mb-3">{tx("قنوات التواصل الرسمية", "Canaux de contact officiels")}</h2>
                <div className="mb-3">
                  <div className="small text-muted">{tx("البريد الإلكتروني الرسمي:", "E-mail officiel :")}</div>
                  <a href={`mailto:${email}`} className="fw-bold text-decoration-none" style={{ color: "var(--dxn-green-700)" }}>
                    {email}
                  </a>
                </div>

                {(settings.businessHoursAr || settings.businessHoursFr) && (
                  <div className="mb-3">
                    <div className="small text-muted">{tx("أوقات المتابعة:", "Horaires de suivi :")}</div>
                    <div className="fw-semibold">
                      {language === "ar"
                        ? settings.businessHoursAr || settings.businessHoursFr
                        : settings.businessHoursFr || settings.businessHoursAr}
                    </div>
                  </div>
                )}

                {settings.whatsappUrl && (
                  <div className="mb-3">
                    <a
                      href={settings.whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="dxn-btn dxn-btn-primary w-100"
                    >
                      {tx("مراسلة مباشرة عبر واتساب", "Discuter sur WhatsApp")}
                    </a>
                  </div>
                )}

                {(socials.facebook || socials.instagram || socials.tiktok || socials.telegram) && (
                  <div className="mt-4 pt-3 border-top">
                    <div className="small text-muted mb-2">{tx("حساباتنا الرسمية:", "Réseaux officiels :")}</div>
                    <div className="d-flex flex-wrap gap-2">
                      {socials.facebook && (
                        <a href={socials.facebook} target="_blank" rel="noopener noreferrer" className="dxn-cat-pill">
                          Facebook
                        </a>
                      )}
                      {socials.instagram && (
                        <a href={socials.instagram} target="_blank" rel="noopener noreferrer" className="dxn-cat-pill">
                          Instagram
                        </a>
                      )}
                      {socials.tiktok && (
                        <a href={socials.tiktok} target="_blank" rel="noopener noreferrer" className="dxn-cat-pill">
                          TikTok
                        </a>
                      )}
                      {socials.telegram && (
                        <a href={socials.telegram} target="_blank" rel="noopener noreferrer" className="dxn-cat-pill">
                          Telegram
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </Col>

            <Col lg={7}>
              <div className="dxn-form-card">
                <div className="dxn-form-card-head">
                  <span className="dxn-step">✉</span>
                  {tx("أرسل رسالة مباشرة", "Envoyer un message direct")}
                </div>
                <div className="dxn-form-card-body">
                  {submittedRef ? (
                    <div className="text-center py-4">
                      <h2 className="h4 fw-bold mb-2">
                        {tx("تم إرسال رسالتك بنجاح!", "Votre message a bien été envoyé !")}
                      </h2>
                      <p className="text-muted mb-3">
                        {tx(
                          "شكراً لتواصلك مع DXN NADZ. سيقوم فريقنا بالرد عليك في أقرب وقت ممكن.",
                          "Merci de nous avoir écrit. Notre équipe vous répondra dans les meilleurs délais."
                        )}
                      </p>
                      <div className="small text-muted mb-4">
                        {tx("رقم الرسالة المرجعي:", "Référence :")} <strong>{submittedRef}</strong>
                      </div>
                      <Button variant="outline-success" onClick={() => setSubmittedRef(null)}>
                        {tx("إرسال رسالة أخرى", "Envoyer un autre message")}
                      </Button>
                    </div>
                  ) : (
                    <Form onSubmit={formik.handleSubmit} noValidate>
                      {submitError && (
                        <Alert variant="danger" dismissible onClose={() => setSubmitError(null)}>
                          {submitError}
                        </Alert>
                      )}
                      {(formik.errors as any)[""] && formik.submitCount > 0 && (
                        <Alert variant="warning">{(formik.errors as any)[""]}</Alert>
                      )}

                      <div className="dxn-honeypot" aria-hidden="true">
                        <input
                          type="text"
                          name="website"
                          tabIndex={-1}
                          autoComplete="off"
                          value={formik.values.website}
                          onChange={formik.handleChange}
                        />
                      </div>

                      <Row className="g-3">
                        <Col xs={12}>
                          <Form.Group controlId="contactName">
                            <Form.Label>{tx("الاسم الكامل", "Nom complet")} *</Form.Label>
                            <Form.Control
                              type="text"
                              name="name"
                              value={formik.values.name}
                              onChange={formik.handleChange}
                              onBlur={formik.handleBlur}
                              isInvalid={Boolean(formik.touched.name && formik.errors.name)}
                              required
                            />
                            <Form.Control.Feedback type="invalid">{formik.errors.name}</Form.Control.Feedback>
                          </Form.Group>
                        </Col>

                        <Col sm={6}>
                          <Form.Group controlId="contactPhone">
                            <Form.Label>{tx("رقم الهاتف", "Téléphone")}</Form.Label>
                            <Form.Control
                              type="tel"
                              name="phone"
                              placeholder="05/06/07XXXXXXXX"
                              value={formik.values.phone}
                              onChange={formik.handleChange}
                              onBlur={formik.handleBlur}
                            />
                          </Form.Group>
                        </Col>

                        <Col sm={6}>
                          <Form.Group controlId="contactEmail">
                            <Form.Label>{tx("البريد الإلكتروني", "E-mail")}</Form.Label>
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
                          <Form.Group controlId="contactSubject">
                            <Form.Label>{tx("الموضوع (اختياري)", "Objet (optionnel)")}</Form.Label>
                            <Form.Control
                              type="text"
                              name="subject"
                              value={formik.values.subject}
                              onChange={formik.handleChange}
                              onBlur={formik.handleBlur}
                            />
                          </Form.Group>
                        </Col>

                        <Col xs={12}>
                          <Form.Group controlId="contactMessage">
                            <Form.Label>{tx("نص الرسالة", "Message")} *</Form.Label>
                            <Form.Control
                              as="textarea"
                              rows={4}
                              name="message"
                              value={formik.values.message}
                              onChange={formik.handleChange}
                              onBlur={formik.handleBlur}
                              isInvalid={Boolean(formik.touched.message && formik.errors.message)}
                              required
                            />
                            <Form.Control.Feedback type="invalid">{formik.errors.message}</Form.Control.Feedback>
                          </Form.Group>
                        </Col>

                        <Col xs={12}>
                          <Form.Check
                            type="checkbox"
                            id="contactConsent"
                            name="privacyConsent"
                            checked={formik.values.privacyConsent}
                            onChange={formik.handleChange}
                            label={
                              <span className="small">
                                {tx("أوافق على معالجة رسالتي للرد عليّ وفق ", "J'accepte le traitement de ce message selon la ")}
                                <Link to="/privacy">{tx("سياسة الخصوصية", "politique de confidentialité")}</Link>. *
                              </span>
                            }
                          />
                          {formik.touched.privacyConsent && formik.errors.privacyConsent && (
                            <div className="text-danger small mt-1">{formik.errors.privacyConsent}</div>
                          )}
                        </Col>

                        <Col xs={12}>
                          <Button
                            type="submit"
                            className="dxn-btn dxn-btn-primary dxn-btn-lg w-100"
                            disabled={formik.isSubmitting}
                          >
                            {formik.isSubmitting ? tx("جارٍ الإرسال...", "Envoi...") : tx("إرسال الرسالة", "Envoyer le message")}
                          </Button>
                        </Col>
                      </Row>
                    </Form>
                  )}
                </div>
              </div>
            </Col>
          </Row>
        </div>
      </section>
    </div>
  );
};

export default ContactPage;
