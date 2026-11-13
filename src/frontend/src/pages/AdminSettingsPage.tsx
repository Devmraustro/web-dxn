import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { Container, Row, Col, Form, Button, Alert, Badge, Table, Spinner } from "react-bootstrap";
import { useLanguage } from "../context/LanguageContext";
import { useSiteSettings } from "../context/SiteSettingsContext";
import { ALGERIAN_WILAYAS, WilayaCoverageStatus } from "../../../backend/data/algerianWilayas";

const AdminSettingsPage: React.FC = () => {
  const { language, dir } = useLanguage();
  const { refreshSettings } = useSiteSettings();
  const isAr = language === "ar";
  const t = useCallback((ar: string, fr: string) => (isAr ? ar : fr), [isAr]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [form, setForm] = useState({
    brandName: "DXN NADZ",
    sponsorMembershipNumber: "",
    sponsorNameAr: "",
    sponsorNameFr: "",
    whatsappNumber: "",
    contactEmail: "dxntraveldz@gmail.com",
    businessHoursAr: "",
    businessHoursFr: "",
    socialLinks: {
      facebook: "",
      instagram: "",
      tiktok: "",
      telegram: "",
      whatsapp: "",
    },
    telegramNotificationsEnabled: true,
    notifyOnNewOrder: true,
    notifyOnNewLead: true,
    notifyOnNewContact: true,
  });

  const [telegramConfigured, setTelegramConfigured] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [selectedWilayaCode, setSelectedWilayaCode] = useState<number>(59);
  const [wilayaCoverage, setWilayaCoverage] = useState<{
    coverageStatus: WilayaCoverageStatus;
    homeDeliverySupported: boolean;
    officeDeliverySupported: boolean;
    homeFee: string;
    officeFee: string;
  }>({
    coverageStatus: "via_parent_wilaya",
    homeDeliverySupported: true,
    officeDeliverySupported: true,
    homeFee: "",
    officeFee: "",
  });
  const [savingWilaya, setSavingWilaya] = useState(false);

  const handleSelectWilayaForConfig = useCallback(async (code: number) => {
    setSelectedWilayaCode(code);
    const canonical = ALGERIAN_WILAYAS.find((w) => w.code === code);
    try {
      const res = await axios.get("/api/shipping/zones");
      const zones = Array.isArray(res.data?.data) ? res.data.data : [];
      const zone = zones.find((z: any) => Number(z.code) === code);
      if (zone) {
        setWilayaCoverage({
          coverageStatus: (zone.coverageStatus as WilayaCoverageStatus) || canonical?.defaultCoverageStatus || "served",
          homeDeliverySupported: zone.homeDeliverySupported ?? canonical?.defaultHomeDelivery ?? true,
          officeDeliverySupported: zone.officeDeliverySupported ?? canonical?.defaultOfficeDelivery ?? true,
          homeFee: zone.home !== undefined ? String(zone.home) : "",
          officeFee: zone.office !== undefined ? String(zone.office) : "",
        });
        return;
      }
    } catch {
      // Fall back to canonical default
    }
    if (canonical) {
      setWilayaCoverage({
        coverageStatus: canonical.defaultCoverageStatus,
        homeDeliverySupported: canonical.defaultHomeDelivery,
        officeDeliverySupported: canonical.defaultOfficeDelivery,
        homeFee: "",
        officeFee: "",
      });
    }
  }, []);

  const handleSaveWilayaCoverage = async () => {
    setSavingWilaya(true);
    setError(null);
    setSuccess(null);
    try {
      const token = localStorage.getItem("token");
      await axios.put(
        `/api/shipping/coverage/${selectedWilayaCode}`,
        {
          coverageStatus: wilayaCoverage.coverageStatus,
          homeDeliverySupported: wilayaCoverage.homeDeliverySupported,
          officeDeliverySupported: wilayaCoverage.officeDeliverySupported,
          ...(wilayaCoverage.homeFee !== "" ? { homeFee: Number(wilayaCoverage.homeFee) } : {}),
          ...(wilayaCoverage.officeFee !== "" ? { officeFee: Number(wilayaCoverage.officeFee) } : {}),
        },
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      setSuccess(
        t(
          "تم حفظ إعدادات التغطية وأسعار الشحن للولاية بنجاح.",
          "La couverture et les tarifs de livraison de la wilaya ont été enregistrés."
        )
      );
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          t("فشل حفظ إعدادات التغطية للولاية.", "Impossible d'enregistrer la couverture de la wilaya.")
      );
    } finally {
      setSavingWilaya(false);
    }
  };

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get("/api/admin/settings");
      const payload = res.data?.data || {};
      const data = payload.settings || payload;

      if (data) {
        setForm({
          brandName: data.brandName || "DXN NADZ",
          sponsorMembershipNumber: data.sponsorMembershipNumber || "",
          sponsorNameAr: data.sponsorNameAr || "",
          sponsorNameFr: data.sponsorNameFr || "",
          whatsappNumber: data.whatsappNumber || "",
          contactEmail: data.contactEmail || "dxntraveldz@gmail.com",
          businessHoursAr: data.businessHoursAr || "",
          businessHoursFr: data.businessHoursFr || "",
          socialLinks: {
            facebook: data.socialLinks?.facebook || "",
            instagram: data.socialLinks?.instagram || "",
            tiktok: data.socialLinks?.tiktok || "",
            telegram: data.socialLinks?.telegram || "",
            whatsapp: data.socialLinks?.whatsapp || "",
          },
          telegramNotificationsEnabled: data.telegramNotificationsEnabled !== false,
          notifyOnNewOrder: data.notifyOnNewOrder !== false,
          notifyOnNewLead: data.notifyOnNewLead !== false,
          notifyOnNewContact: data.notifyOnNewContact !== false,
        });
        setTelegramConfigured(Boolean(data.telegramBotConfigured));
      }
      setNotifications(Array.isArray(payload.recentNotifications) ? payload.recentNotifications : []);
      setAuditLogs(Array.isArray(payload.recentAudits) ? payload.recentAudits : []);
      setError(null);
    } catch (err: any) {
      setError(err?.response?.data?.message || t("تعذر تحميل الإعدادات", "Impossible de charger les paramètres"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await axios.put("/api/admin/settings", form);
      await refreshSettings();
      setSuccess(
        t(
          "تم حفظ إعدادات المنصة ورقم عضوية الراعي وروابط التواصل بنجاح!",
          "Paramètres, ID Parrain DXN et réseaux sociaux enregistrés avec succès !"
        )
      );
      void loadSettings();
    } catch (err: any) {
      setError(err?.response?.data?.message || t("فشل حفظ الإعدادات", "Échec de l'enregistrement"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" />
      </div>
    );
  }

  return (
    <Container fluid dir={dir}>
      <div className="dxn-admin-header mb-4">
        <h1 className="dxn-admin-title h3 mb-1">
          {t("إعدادات المنصة، رقم الراعي، والتنبيهات الفورية", "Paramètres, ID Parrain DXN & Intégrations")}
        </h1>
        <p className="dxn-admin-sub mb-0">
          {t(
            "تحكم في رقم عضوية الراعي المعروض في صفحة الانضمام، رقم الواتساب، الحسابات الرسمية، وتنبيهات Telegram دون تعديل الكود.",
            "Configurez votre numéro de parrain DXN, WhatsApp, réseaux sociaux et notifications Telegram sans toucher au code."
          )}
        </p>
      </div>

      {success && (
        <Alert variant="success" dismissible onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}
      {error && (
        <Alert variant="danger" dismissible onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Form onSubmit={handleSave}>
        <Row className="g-4 mb-4">
          {/* Sponsor & Contact Settings */}
          <Col lg={6}>
            <div className="dxn-admin-card h-100">
              <div className="dxn-admin-card-head">
                {t("بيانات الراعي والتواصل الرسمي (DXN Sponsor)", "Identité Parrain DXN & Contact")}
              </div>
              <div className="dxn-admin-card-body">
                <Form.Group className="mb-3">
                  <Form.Label className="fw-semibold">
                    {t("رقم عضوية الراعي في DXN (Sponsor Membership ID)", "N° Membre Parrain DXN")}
                  </Form.Label>
                  <Form.Control
                    dir="ltr"
                    value={form.sponsorMembershipNumber}
                    onChange={(e) => setForm({ ...form, sponsorMembershipNumber: e.target.value })}
                    placeholder={t("مثال: 820123456", "Ex: 820123456")}
                  />
                  <Form.Text className="text-muted">
                    {t(
                      "يُعرض هذا الرقم في صفحة (/join) مع زر نسخ فوري، ولا يمكن لأي زائر تعديله.",
                      "Affiché en lecture seule sur la page /join avec bouton Copier."
                    )}
                  </Form.Text>
                </Form.Group>

                <Row className="g-2 mb-3">
                  <Col md={6}>
                    <Form.Label className="small fw-semibold">
                      {t("اسم الراعي / القائد (عربي)", "Nom du parrain (AR)")}
                    </Form.Label>
                    <Form.Control
                      value={form.sponsorNameAr}
                      onChange={(e) => setForm({ ...form, sponsorNameAr: e.target.value })}
                      placeholder="فريق DXN NADZ"
                    />
                  </Col>
                  <Col md={6}>
                    <Form.Label className="small fw-semibold">
                      {t("اسم الراعي / القائد (فرنسي)", "Nom du parrain (FR)")}
                    </Form.Label>
                    <Form.Control
                      value={form.sponsorNameFr}
                      onChange={(e) => setForm({ ...form, sponsorNameFr: e.target.value })}
                      placeholder="Équipe DXN NADZ"
                    />
                  </Col>
                </Row>

                <Row className="g-2 mb-3">
                  <Col md={6}>
                    <Form.Label className="small fw-semibold">
                      {t("رقم واتساب المتجر والاستقطاب", "Numéro WhatsApp")}
                    </Form.Label>
                    <Form.Control
                      dir="ltr"
                      value={form.whatsappNumber}
                      onChange={(e) => setForm({ ...form, whatsappNumber: e.target.value })}
                      placeholder="213600000000"
                    />
                  </Col>
                  <Col md={6}>
                    <Form.Label className="small fw-semibold">
                      {t("البريد الرسمي", "E-mail officiel")}
                    </Form.Label>
                    <Form.Control
                      dir="ltr"
                      type="email"
                      value={form.contactEmail}
                      onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
                    />
                  </Col>
                </Row>

                <Row className="g-2">
                  <Col md={6}>
                    <Form.Label className="small fw-semibold">
                      {t("أوقات العمل (عربي)", "Horaires (AR)")}
                    </Form.Label>
                    <Form.Control
                      value={form.businessHoursAr}
                      onChange={(e) => setForm({ ...form, businessHoursAr: e.target.value })}
                      placeholder="السبت - الخميس: 09:00 - 20:00"
                    />
                  </Col>
                  <Col md={6}>
                    <Form.Label className="small fw-semibold">
                      {t("أوقات العمل (فرنسي)", "Horaires (FR)")}
                    </Form.Label>
                    <Form.Control
                      value={form.businessHoursFr}
                      onChange={(e) => setForm({ ...form, businessHoursFr: e.target.value })}
                      placeholder="Sam - Jeu : 09h00 - 20h00"
                    />
                  </Col>
                </Row>
              </div>
            </div>
          </Col>

          {/* Social Links & Telegram Notifications */}
          <Col lg={6}>
            <div className="dxn-admin-card h-100">
              <div className="dxn-admin-card-head">
                {t("حسابات التواصل الاجتماعي وتنبيهات Telegram", "Réseaux sociaux & Alertes Telegram")}
              </div>
              <div className="dxn-admin-card-body">
                <p className="small text-muted mb-3">
                  {t(
                    "الروابط الفارغة لن تظهر في الواجهة العامة ولن تنتج روابط مكسورة.",
                    "Les champs laissés vides sont automatiquement masqués sur le site public."
                  )}
                </p>

                <Row className="g-2 mb-3">
                  <Col md={6}>
                    <Form.Label className="small">Facebook URL</Form.Label>
                    <Form.Control
                      dir="ltr"
                      type="url"
                      value={form.socialLinks.facebook}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          socialLinks: { ...form.socialLinks, facebook: e.target.value },
                        })
                      }
                      placeholder="https://facebook.com/..."
                    />
                  </Col>
                  <Col md={6}>
                    <Form.Label className="small">Instagram URL</Form.Label>
                    <Form.Control
                      dir="ltr"
                      type="url"
                      value={form.socialLinks.instagram}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          socialLinks: { ...form.socialLinks, instagram: e.target.value },
                        })
                      }
                      placeholder="https://instagram.com/..."
                    />
                  </Col>
                  <Col md={6}>
                    <Form.Label className="small">TikTok URL</Form.Label>
                    <Form.Control
                      dir="ltr"
                      type="url"
                      value={form.socialLinks.tiktok}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          socialLinks: { ...form.socialLinks, tiktok: e.target.value },
                        })
                      }
                      placeholder="https://tiktok.com/@..."
                    />
                  </Col>
                  <Col md={6}>
                    <Form.Label className="small">Telegram Public Channel URL</Form.Label>
                    <Form.Control
                      dir="ltr"
                      type="url"
                      value={form.socialLinks.telegram}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          socialLinks: { ...form.socialLinks, telegram: e.target.value },
                        })
                      }
                      placeholder="https://t.me/..."
                    />
                  </Col>
                </Row>

                <hr />
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <span className="fw-bold small">
                    {t("تنبيهات البوت الخاصة بالإدارة (Telegram Bot)", "Notifications privées Telegram Bot")}
                  </span>
                  <Badge bg={telegramConfigured ? "success" : "warning"}>
                    {telegramConfigured
                      ? t("مربوط في متغيرات الخادم", "Configuré sur le serveur")
                      : t("بانتظار ضبط TELEGRAM_BOT_TOKEN", "TELEGRAM_BOT_TOKEN manquant")}
                  </Badge>
                </div>

                <Form.Check
                  type="switch"
                  id="tg-master"
                  label={t("تفعيل إشعارات البوت الإدارية", "Activer les alertes Telegram")}
                  checked={form.telegramNotificationsEnabled}
                  onChange={(e) =>
                    setForm({ ...form, telegramNotificationsEnabled: e.target.checked })
                  }
                />
                <Form.Check
                  type="switch"
                  id="tg-orders"
                  label={t("إشعار فوري عند كل طلب منتج جديد", "Notifier à chaque nouvelle commande")}
                  checked={form.notifyOnNewOrder}
                  onChange={(e) => setForm({ ...form, notifyOnNewOrder: e.target.checked })}
                />
                <Form.Check
                  type="switch"
                  id="tg-leads"
                  label={t("إشعار فوري عند كل طلب انضمام للفريق", "Notifier à chaque demande d'adhésion")}
                  checked={form.notifyOnNewLead}
                  onChange={(e) => setForm({ ...form, notifyOnNewLead: e.target.checked })}
                />
                <Form.Check
                  type="switch"
                  id="tg-contacts"
                  label={t("إشعار فوري عند رسائل التواصل", "Notifier à chaque message de contact")}
                  checked={form.notifyOnNewContact}
                  onChange={(e) => setForm({ ...form, notifyOnNewContact: e.target.checked })}
                />
              </div>
            </div>
          </Col>
        </Row>

        <div className="mb-4 text-end">
          <Button type="submit" className="dxn-btn dxn-btn-primary px-4" disabled={saving}>
            {saving
              ? t("جاري حفظ الإعدادات...", "Enregistrement...")
              : t("حفظ جميع الإعدادات", "Enregistrer tous les paramètres")}
          </Button>
        </div>
      </Form>

      {/* Notification Delivery Log & Audit Log */}
      <Row className="g-4">
        <Col lg={6}>
          <div className="dxn-admin-card">
            <div className="dxn-admin-card-head">
              {t("سجل إرسال إشعارات Telegram الأخيرة", "Journal d'envoi des notifications Telegram")}
            </div>
            <div className="dxn-admin-card-body">
              {notifications.length === 0 ? (
                <p className="small text-muted mb-0">
                  {t("لا توجد سجلات إشعارات بعد.", "Aucune notification enregistrée.")}
                </p>
              ) : (
                <Table size="sm" responsive className="mb-0">
                  <thead>
                    <tr>
                      <th>{t("الحدث", "Événement")}</th>
                      <th>{t("المرجع", "Réf")}</th>
                      <th>{t("الحالة", "Statut")}</th>
                      <th>{t("التاريخ", "Date")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {notifications.slice(0, 8).map((n) => (
                      <tr key={n._id}>
                        <td className="small">{n.eventType}</td>
                        <td dir="ltr" className="small">{n.referenceId || "—"}</td>
                        <td>
                          <Badge
                            bg={
                              n.status === "sent"
                                ? "success"
                                : n.status === "failed"
                                ? "danger"
                                : "secondary"
                            }
                          >
                            {n.status}
                          </Badge>
                        </td>
                        <td className="small text-muted">
                          {n.createdAt ? new Date(n.createdAt).toLocaleString() : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </div>
          </div>
        </Col>

        <Col lg={6}>
          <div className="dxn-admin-card">
            <div className="dxn-admin-card-head">
              {t("سجل الأمان والعمليات الإدارية (Audit Log)", "Journal d'audit administrateur")}
            </div>
            <div className="dxn-admin-card-body">
              {auditLogs.length === 0 ? (
                <p className="small text-muted mb-0">
                  {t("لا توجد عمليات مسجلة بعد.", "Aucune action enregistrée.")}
                </p>
              ) : (
                <Table size="sm" responsive className="mb-0">
                  <thead>
                    <tr>
                      <th>{t("العملية", "Action")}</th>
                      <th>{t("المسؤول", "Admin")}</th>
                      <th>{t("التاريخ", "Date")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.slice(0, 8).map((a) => (
                      <tr key={a._id}>
                        <td className="small fw-semibold">{a.action}</td>
                        <td dir="ltr" className="small">{a.actorEmail || "admin"}</td>
                        <td className="small text-muted">
                          {a.createdAt ? new Date(a.createdAt).toLocaleString() : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </div>
          </div>
        </Col>
      </Row>

      {/* Configurable 69-Wilaya Courier Coverage & Shipping Fees (Law 26-06) */}
      <Row className="g-4 mt-1">
        <Col xs={12}>
          <div className="dxn-admin-card">
            <div className="dxn-admin-card-head">
              {t(
                "إدارة تغطية التوصيل وأسعار الشحن للولايات الـ 69 (القانون 26-06)",
                "Couverture transporteur & tarifs des 69 wilayas (Loi 26-06)"
              )}
            </div>
            <div className="dxn-admin-card-body">
              <p className="small text-muted mb-3">
                {t(
                  "إنشاء الولاية قانونياً لا يعني تلقائياً تغطيتها المباشرة من شركة التوصيل. يمكنك هنا ضبط حالة التغطية الفعلية وأسعار الشحن لكل ولاية (01–69) دون تعديل الكود.",
                  "La création légale d'une wilaya n'implique pas automatiquement sa desserte directe par le transporteur. Configurez ici la disponibilité réelle et les tarifs par wilaya (01–69)."
                )}
              </p>
              <Row className="g-3 align-items-end">
                <Col md={4}>
                  <Form.Label className="small fw-semibold">
                    {t("الولاية (01–69)", "Wilaya (01–69)")}
                  </Form.Label>
                  <Form.Select
                    value={selectedWilayaCode}
                    onChange={(e) => void handleSelectWilayaForConfig(Number(e.target.value))}
                  >
                    {ALGERIAN_WILAYAS.map((w) => (
                      <option key={w.code} value={w.code}>
                        {String(w.code).padStart(2, "0")} - {isAr ? w.nameAr : w.nameFr}
                        {w.reformYear === 2026 ? (isAr ? " (جديدة 2026)" : " (Nouvelle 2026)") : ""}
                      </option>
                    ))}
                  </Form.Select>
                </Col>
                <Col md={4}>
                  <Form.Label className="small fw-semibold">
                    {t("حالة تغطية شركة التوصيل", "Statut de couverture transporteur")}
                  </Form.Label>
                  <Form.Select
                    value={wilayaCoverage.coverageStatus}
                    onChange={(e) =>
                      setWilayaCoverage({
                        ...wilayaCoverage,
                        coverageStatus: e.target.value as WilayaCoverageStatus,
                      })
                    }
                  >
                    <option value="served">
                      {t("مغطاة مباشرة (Served)", "Desservie directement")}
                    </option>
                    <option value="via_parent_wilaya">
                      {t("توجيه عبر الولاية الأم + البلدية (59–69)", "Via wilaya mère + commune (59–69)")}
                    </option>
                    <option value="confirm_by_phone">
                      {t("تأكيد هاتفي حسب البلدية", "Confirmation téléphonique par commune")}
                    </option>
                    <option value="unserved">
                      {t("غير مغطاة حالياً (إيقاف الطلبات)", "Non desservie (bloquer la livraison)")}
                    </option>
                  </Form.Select>
                </Col>
                <Col md={2}>
                  <Form.Label className="small fw-semibold">
                    {t("منزل (دج)", "Domicile (DA)")}
                  </Form.Label>
                  <Form.Control
                    type="number"
                    min={0}
                    max={100000}
                    dir="ltr"
                    value={wilayaCoverage.homeFee}
                    onChange={(e) => setWilayaCoverage({ ...wilayaCoverage, homeFee: e.target.value })}
                    placeholder="600"
                  />
                </Col>
                <Col md={2}>
                  <Form.Label className="small fw-semibold">
                    {t("مكتب (دج)", "Bureau (DA)")}
                  </Form.Label>
                  <Form.Control
                    type="number"
                    min={0}
                    max={100000}
                    dir="ltr"
                    value={wilayaCoverage.officeFee}
                    onChange={(e) => setWilayaCoverage({ ...wilayaCoverage, officeFee: e.target.value })}
                    placeholder="400"
                  />
                </Col>
                <Col md={8} className="d-flex gap-4 flex-wrap pt-2">
                  <Form.Check
                    type="switch"
                    id="wilaya-home-supported"
                    checked={wilayaCoverage.homeDeliverySupported}
                    onChange={(e) =>
                      setWilayaCoverage({ ...wilayaCoverage, homeDeliverySupported: e.target.checked })
                    }
                    label={t("التوصيل للمنزل متاح", "Livraison à domicile disponible")}
                  />
                  <Form.Check
                    type="switch"
                    id="wilaya-office-supported"
                    checked={wilayaCoverage.officeDeliverySupported}
                    onChange={(e) =>
                      setWilayaCoverage({ ...wilayaCoverage, officeDeliverySupported: e.target.checked })
                    }
                    label={t("التوصيل للمكتب (Stop-Desk) متاح", "Livraison au bureau disponible")}
                  />
                </Col>
                <Col md={4} className="text-md-end pt-2">
                  <Button
                    type="button"
                    variant="success"
                    disabled={savingWilaya}
                    onClick={() => void handleSaveWilayaCoverage()}
                  >
                    {savingWilaya
                      ? t("جارٍ الحفظ...", "Enregistrement...")
                      : t("حفظ تغطية الولاية", "Enregistrer la wilaya")}
                  </Button>
                </Col>
              </Row>
            </div>
          </div>
        </Col>
      </Row>
    </Container>
  );
};

export default AdminSettingsPage;
