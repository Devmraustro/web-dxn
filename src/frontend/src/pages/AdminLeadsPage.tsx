import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import {
  Container,
  Row,
  Col,
  Table,
  Button,
  Form,
  Alert,
  Modal,
  Spinner,
  Badge,
} from "react-bootstrap";
import { useLanguage } from "../context/LanguageContext";

const LEAD_STATUSES = [
  "new",
  "contacted",
  "interested",
  "customer",
  "registered_member",
  "not_interested",
] as const;

type LeadStatus = (typeof LEAD_STATUSES)[number];

interface LeadRecord {
  _id: string;
  leadReference: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  country: string;
  cityWilaya?: string;
  age?: number;
  joinGoal?: string;
  preferredContactMethod: string;
  message?: string;
  sponsorMembershipNumber?: string | null;
  sponsorMemberIdUsed?: string;
  existingMembershipNumber?: string | null;
  officialMembershipNumber?: string | null;
  status: LeadStatus;
  followUpDate?: string | null;
  trafficSource?: {
    source?: string;
    utmCampaign?: string;
    landingPath?: string;
  };
  notes?: Array<{ _id?: string; content: string; authorName?: string; createdAt?: string }>;
  communicationHistory?: Array<{
    _id?: string;
    channel: string;
    summary: string;
    outcome?: string;
    authorName?: string;
    createdAt?: string;
  }>;
  createdAt?: string;
}

const STATUS_LABELS: Record<LeadStatus, [string, string]> = {
  new: ["جديد", "Nouveau"],
  contacted: ["تم التواصل", "Contacté"],
  interested: ["مهتم بالانضمام", "Intéressé"],
  customer: ["عميل مشتريات", "Client achats"],
  registered_member: ["تم تسجيل العضوية", "Membre inscrit"],
  not_interested: ["غير مهتم", "Non intéressé"],
};

const GOAL_LABELS: Record<string, [string, string]> = {
  personal_consumption: ["استهلاك شخصي بخصم عضو", "Consommation personnelle"],
  extra_income: ["دخل إضافي وتسويق منتجات", "Revenu complémentaire"],
  additional_income: ["دخل إضافي وتسويق منتجات", "Revenu complémentaire"],
  build_team: ["بناء فريق عمل وتوسع", "Développer une équipe"],
  learn_more: ["التعرف أكثر أولاً", "Découvrir d'abord"],
};

const AdminLeadsPage: React.FC = () => {
  const { language, dir } = useLanguage();
  const isAr = language === "ar";
  const t = useCallback((ar: string, fr: string) => (isAr ? ar : fr), [isAr]);

  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [segments, setSegments] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [country, setCountry] = useState("");
  const [source, setSource] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [selectedLead, setSelectedLead] = useState<LeadRecord | null>(null);
  const [savingLead, setSavingLead] = useState(false);
  const [editStatus, setEditStatus] = useState<LeadStatus>("new");
  const [editMemberNo, setEditMemberNo] = useState("");
  const [editFollowUp, setEditFollowUp] = useState("");
  const [newNote, setNewNote] = useState("");
  const [commChannel, setCommChannel] = useState("whatsapp");
  const [commSummary, setCommSummary] = useState("");
  const [exporting, setExporting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = { limit: "100" };
      if (statusFilter) params.status = statusFilter;
      if (search.trim()) params.search = search.trim();
      if (country.trim()) params.country = country.trim();
      if (source.trim()) params.source = source.trim();
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;

      const leadsRes = await axios.get("/api/admin/leads", { params });
      setLeads(Array.isArray(leadsRes.data?.data) ? leadsRes.data.data : []);
      setSegments(leadsRes.data?.summary?.segments || null);
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          t("تعذر تحميل قائمة طلبات الانضمام", "Impossible de charger les demandes d'adhésion")
      );
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search, country, source, dateFrom, dateTo, t]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const fullNameOf = (lead: LeadRecord) =>
    `${lead.firstName || ""} ${lead.lastName || ""}`.trim() || lead.leadReference;

  const openLeadModal = async (lead: LeadRecord) => {
    try {
      const res = await axios.get(`/api/admin/leads/${lead._id}`);
      const full: LeadRecord = res.data?.data || lead;
      setSelectedLead(full);
      setEditStatus(full.status);
      setEditMemberNo(full.officialMembershipNumber || "");
      setEditFollowUp(full.followUpDate ? String(full.followUpDate).slice(0, 10) : "");
    } catch {
      setSelectedLead(lead);
      setEditStatus(lead.status);
      setEditMemberNo(lead.officialMembershipNumber || "");
      setEditFollowUp(lead.followUpDate ? String(lead.followUpDate).slice(0, 10) : "");
    }
  };

  const handleSaveLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead) return;
    setSavingLead(true);
    try {
      const res = await axios.patch(`/api/admin/leads/${selectedLead._id}`, {
        status: editStatus,
        officialMembershipNumber: editMemberNo,
        followUpDate: editFollowUp || null,
      });
      const updated = res.data?.data;
      if (updated) {
        setSelectedLead(updated);
        setLeads((prev) => prev.map((l) => (l._id === updated._id ? updated : l)));
      }
      setSuccess(t("تم حفظ تحديث ملف المتقدم بنجاح", "Fiche du candidat mise à jour"));
      void loadData();
    } catch (err: any) {
      setError(err?.response?.data?.message || t("فشل التحديث", "Échec de la mise à jour"));
    } finally {
      setSavingLead(false);
    }
  };

  const handleAddNote = async () => {
    if (!selectedLead || !newNote.trim()) return;
    setSavingLead(true);
    try {
      const res = await axios.post(`/api/admin/leads/${selectedLead._id}/notes`, {
        content: newNote.trim(),
      });
      if (res.data?.data) {
        setSelectedLead(res.data.data);
        setNewNote("");
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || t("فشل إضافة الملاحظة", "Échec de l'ajout de note"));
    } finally {
      setSavingLead(false);
    }
  };

  const handleAddCommunication = async () => {
    if (!selectedLead || !commSummary.trim()) return;
    setSavingLead(true);
    try {
      const res = await axios.post(`/api/admin/leads/${selectedLead._id}/communications`, {
        channel: commChannel,
        summary: commSummary.trim(),
      });
      if (res.data?.data) {
        setSelectedLead(res.data.data);
        setCommSummary("");
        void loadData();
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || t("فشل تسجيل التواصل", "Échec de l'enregistrement"));
    } finally {
      setSavingLead(false);
    }
  };

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      if (country.trim()) params.country = country.trim();
      if (source.trim()) params.source = source.trim();
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;

      const res = await axios.get("/api/admin/leads/export.csv", {
        params,
        responseType: "blob",
      });
      const blob = new Blob([res.data], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `dxn-nadz-leads-${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      setError(t("تعذر تصدير ملف CSV", "Échec de l'exportation CSV"));
    } finally {
      setExporting(false);
    }
  };

  const statusLabel = (s: LeadStatus) => {
    const pair = STATUS_LABELS[s] || STATUS_LABELS.new;
    return isAr ? pair[0] : pair[1];
  };

  const goalLabel = (g?: string) => {
    if (!g) return "—";
    const pair = GOAL_LABELS[g];
    return pair ? (isAr ? pair[0] : pair[1]) : g;
  };

  return (
    <Container fluid dir={dir}>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 dxn-admin-header mb-4">
        <div>
          <h1 className="dxn-admin-title h3 mb-1">
            {t("نظام إدارة طلبات الانضمام للفريق (CRM)", "CRM — Demandes d'adhésion & Recrutement")}
          </h1>
          <p className="dxn-admin-sub mb-0">
            {t(
              "متابعة المتقدمين للعضوية، تسجيل أرقام العضوية الرسمية بعد إصدارها في DXN eWorld، وتوثيق سجل التواصل.",
              "Suivi des candidats, attribution des numéros DXN eWorld officiels et historique des échanges."
            )}
          </p>
        </div>
        <Button
          variant="outline-success"
          onClick={handleExportCsv}
          disabled={exporting}
          className="fw-bold"
        >
          {exporting
            ? t("جاري التصدير...", "Exportation...")
            : t("⬇ تصدير CSV (Excel)", "⬇ Exporter CSV (Excel)")}
        </Button>
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

      {/* Phase 7.4: 4 Distinct CRM Segment Cards */}
      {segments && (
        <Row className="g-3 mb-4">
          <Col xs={6} lg={3}>
            <div className="dxn-stat-card" style={{ "--stat-color": "#0284c7" } as React.CSSProperties}>
              <span className="dxn-stat-label">
                {t("1. عملاء المتجر (Customers)", "1. Clients Boutique")}
              </span>
              <span className="dxn-stat-value">{segments.storeCustomers ?? 0}</span>
            </div>
          </Col>
          <Col xs={6} lg={3}>
            <div className="dxn-stat-card" style={{ "--stat-color": "#b45309" } as React.CSSProperties}>
              <span className="dxn-stat-label">
                {t("2. متقدمون للانضمام (Recruitment Leads)", "2. Candidats Recrutement")}
              </span>
              <span className="dxn-stat-value">{segments.recruitmentLeads ?? 0}</span>
            </div>
          </Col>
          <Col xs={6} lg={3}>
            <div className="dxn-stat-card" style={{ "--stat-color": "#6d28d9" } as React.CSSProperties}>
              <span className="dxn-stat-label">
                {t("3. أعضاء DXN قائمون (Existing Members)", "3. Membres DXN existants")}
              </span>
              <span className="dxn-stat-value">{segments.existingDxnMembers ?? 0}</span>
            </div>
          </Col>
          <Col xs={6} lg={3}>
            <div className="dxn-stat-card" style={{ "--stat-color": "#0f5f2f" } as React.CSSProperties}>
              <span className="dxn-stat-label">
                {t("4. أعضاء فريق مسجلون رسمياً", "4. Membres d'équipe inscrits")}
              </span>
              <span className="dxn-stat-value">{segments.registeredTeamMembers ?? 0}</span>
            </div>
          </Col>
        </Row>
      )}

      {/* Filters */}
      <div className="dxn-admin-card mb-3">
        <div className="p-3">
          <Row className="g-2 align-items-end">
            <Col md={3}>
              <Form.Label className="small text-muted mb-1">
                {t("بحث (الاسم / الهاتف / الرمز)", "Recherche (nom / tél / réf)")}
              </Form.Label>
              <Form.Control
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("ابحث هنا...", "Rechercher...")}
              />
            </Col>
            <Col md={2}>
              <Form.Label className="small text-muted mb-1">{t("الحالة", "Statut")}</Form.Label>
              <Form.Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">{t("كل الحالات", "Tous")}</option>
                {LEAD_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {statusLabel(s)}
                  </option>
                ))}
              </Form.Select>
            </Col>
            <Col md={2}>
              <Form.Label className="small text-muted mb-1">{t("الدولة", "Pays")}</Form.Label>
              <Form.Control
                type="text"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="Algeria..."
              />
            </Col>
            <Col md={2}>
              <Form.Label className="small text-muted mb-1">
                {t("المصدر (?ref=)", "Source (?ref=)")}
              </Form.Label>
              <Form.Control
                type="text"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder="instagram / direct"
              />
            </Col>
            <Col md={3} className="d-flex gap-2">
              <Form.Control
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                aria-label="From date"
              />
              <Form.Control
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                aria-label="To date"
              />
            </Col>
          </Row>
        </div>
      </div>

      {/* Leads Table */}
      <div className="dxn-admin-card">
        <div className="admin-table-wrap p-3">
          {loading ? (
            <div className="text-center py-5">
              <Spinner animation="border" />
            </div>
          ) : leads.length === 0 ? (
            <div className="text-center py-5 text-muted">
              {t("لا توجد طلبات انضمام مطابقة للفلاتر الحالية.", "Aucune demande ne correspond aux filtres.")}
            </div>
          ) : (
            <Table hover responsive className="align-middle mb-0">
              <thead>
                <tr>
                  <th>{t("المرجع", "Réf")}</th>
                  <th>{t("الاسم والهاتف", "Nom & Téléphone")}</th>
                  <th>{t("الموقع", "Localisation")}</th>
                  <th>{t("الهدف", "Objectif")}</th>
                  <th>{t("المصدر", "Source")}</th>
                  <th>{t("الحالة", "Statut")}</th>
                  <th>{t("عضوية DXN", "ID DXN")}</th>
                  <th>{t("التاريخ", "Date")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead._id}>
                    <td className="small fw-semibold" dir="ltr">
                      {lead.leadReference}
                    </td>
                    <td>
                      <div className="fw-bold">{fullNameOf(lead)}</div>
                      <div className="small text-muted" dir="ltr">
                        {lead.phone}
                      </div>
                    </td>
                    <td className="small">
                      {lead.cityWilaya ? `${lead.cityWilaya} — ` : ""}
                      {lead.country}
                    </td>
                    <td className="small">{goalLabel(lead.joinGoal)}</td>
                    <td>
                      <Badge bg="light" text="dark" className="border">
                        {lead.trafficSource?.source || "direct"}
                      </Badge>
                    </td>
                    <td>
                      <span className={`dxn-lead-status dxn-lead-${lead.status}`}>
                        {statusLabel(lead.status)}
                      </span>
                    </td>
                    <td dir="ltr" className="small fw-bold">
                      {lead.officialMembershipNumber || lead.existingMembershipNumber || "—"}
                    </td>
                    <td className="small text-muted">
                      {lead.createdAt ? new Date(lead.createdAt).toLocaleDateString() : "—"}
                    </td>
                    <td>
                      <Button
                        size="sm"
                        variant="outline-primary"
                        onClick={() => openLeadModal(lead)}
                      >
                        {t("إدارة الملف", "Gérer")}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>
      </div>

      {/* Lead CRM Detail & Follow-up Modal */}
      <Modal
        show={selectedLead !== null}
        onHide={() => setSelectedLead(null)}
        size="lg"
        dir={dir}
      >
        <Modal.Header closeButton>
          <Modal.Title>
            {t("ملف متقدم للعضوية:", "Dossier candidat :")}{" "}
            {selectedLead ? fullNameOf(selectedLead) : ""} (
            <span dir="ltr">{selectedLead?.leadReference}</span>)
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedLead && (
            <>
              <Row className="g-3 mb-3">
                <Col md={6}>
                  <div className="p-3 bg-light rounded-3 h-100">
                    <div className="small text-muted">{t("بيانات التواصل", "Coordonnées")}</div>
                    <div className="fw-bold mt-1">{fullNameOf(selectedLead)}</div>
                    <div dir="ltr" className="small">
                      📞 {selectedLead.phone}
                    </div>
                    {selectedLead.email && (
                      <div dir="ltr" className="small">
                        ✉️ {selectedLead.email}
                      </div>
                    )}
                    <div className="small mt-1">
                      📍 {selectedLead.cityWilaya ? `${selectedLead.cityWilaya}, ` : ""}
                      {selectedLead.country}
                    </div>
                    <div className="mt-2">
                      <a
                        href={`https://wa.me/${selectedLead.phone.replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-sm btn-success"
                      >
                        💬 {t("مراسلة عبر واتساب الآن", "Contacter sur WhatsApp")}
                      </a>
                    </div>
                  </div>
                </Col>
                <Col md={6}>
                  <div className="p-3 bg-light rounded-3 h-100">
                    <div className="small text-muted">{t("تفاصيل الرغبة والمصدر", "Objectif & Source")}</div>
                    <div className="small mt-1">
                      <strong>{t("الهدف:", "Objectif :")}</strong> {goalLabel(selectedLead.joinGoal)}
                    </div>
                    <div className="small">
                      <strong>{t("وسيلة التواصل المفضلة:", "Canal préféré :")}</strong>{" "}
                      {selectedLead.preferredContactMethod}
                    </div>
                    <div className="small">
                      <strong>{t("رقم الراعي المعروض:", "ID Parrain affiché :")}</strong>{" "}
                      <span dir="ltr">
                        {selectedLead.sponsorMembershipNumber || selectedLead.sponsorMemberIdUsed || "—"}
                      </span>
                    </div>
                    <div className="small">
                      <strong>{t("المصدر:", "Source :")}</strong>{" "}
                      {selectedLead.trafficSource?.source || "direct"}
                    </div>
                    {selectedLead.message && (
                      <div className="small mt-2 p-2 bg-white rounded border">
                        {selectedLead.message}
                      </div>
                    )}
                  </div>
                </Col>
              </Row>

              {/* Status + Official DXN Member Number + Follow-up */}
              <Form onSubmit={handleSaveLead} className="p-3 border rounded-3 mb-3">
                <h6 className="fw-bold mb-3">
                  {t("تحديث حالة الانضمام ورقم العضوية الرسمي", "Mise à jour du statut & N° DXN officiel")}
                </h6>
                <Row className="g-2 align-items-end">
                  <Col md={4}>
                    <Form.Label className="small fw-semibold">{t("الحالة", "Statut")}</Form.Label>
                    <Form.Select
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value as LeadStatus)}
                    >
                      {LEAD_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {statusLabel(s)}
                        </option>
                      ))}
                    </Form.Select>
                  </Col>
                  <Col md={4}>
                    <Form.Label className="small fw-semibold">
                      {t("رقم العضوية الرسمي الصادر من DXN", "N° Membre DXN officiel attribué")}
                    </Form.Label>
                    <Form.Control
                      type="text"
                      dir="ltr"
                      value={editMemberNo}
                      onChange={(e) => setEditMemberNo(e.target.value)}
                      placeholder={t("مثال: 820123456", "Ex: 820123456")}
                    />
                  </Col>
                  <Col md={4}>
                    <Form.Label className="small fw-semibold">
                      {t("تاريخ المتابعة القادم", "Date de prochain suivi")}
                    </Form.Label>
                    <Form.Control
                      type="date"
                      value={editFollowUp}
                      onChange={(e) => setEditFollowUp(e.target.value)}
                    />
                  </Col>
                </Row>
                <div className="mt-3 text-end">
                  <Button type="submit" className="dxn-btn dxn-btn-primary btn-sm" disabled={savingLead}>
                    {t("حفظ التحديثات", "Enregistrer")}
                  </Button>
                </div>
              </Form>

              {/* Private Notes & Communication Log */}
              <Row className="g-3">
                <Col md={6}>
                  <div className="p-3 border rounded-3 h-100">
                    <h6 className="fw-bold mb-2">
                      {t("ملاحظات الإدارة الخاصة", "Notes internes privées")}
                    </h6>
                    <div className="d-flex gap-2 mb-2">
                      <Form.Control
                        size="sm"
                        value={newNote}
                        onChange={(e) => setNewNote(e.target.value)}
                        placeholder={t("أضف ملاحظة متابعة...", "Ajouter une note...")}
                      />
                      <Button size="sm" variant="outline-success" onClick={handleAddNote} disabled={savingLead}>
                        +
                      </Button>
                    </div>
                    <div style={{ maxHeight: 170, overflowY: "auto" }}>
                      {(selectedLead.notes || []).length === 0 ? (
                        <p className="small text-muted mb-0">{t("لا توجد ملاحظات بعد.", "Aucune note.")}</p>
                      ) : (
                        [...(selectedLead.notes || [])].reverse().map((n, idx) => (
                          <div key={n._id || idx} className="small border-bottom py-1">
                            <div>{n.content}</div>
                            <div className="text-muted" style={{ fontSize: "0.75rem" }}>
                              {n.authorName || "Admin"} •{" "}
                              {n.createdAt ? new Date(n.createdAt).toLocaleString() : ""}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </Col>

                <Col md={6}>
                  <div className="p-3 border rounded-3 h-100">
                    <h6 className="fw-bold mb-2">
                      {t("سجل التواصل مع المتقدم", "Journal des communications")}
                    </h6>
                    <div className="d-flex gap-1 mb-2">
                      <Form.Select
                        size="sm"
                        style={{ maxWidth: 115 }}
                        value={commChannel}
                        onChange={(e) => setCommChannel(e.target.value)}
                      >
                        <option value="whatsapp">WhatsApp</option>
                        <option value="phone">Phone</option>
                        <option value="telegram">Telegram</option>
                        <option value="email">Email</option>
                      </Form.Select>
                      <Form.Control
                        size="sm"
                        value={commSummary}
                        onChange={(e) => setCommSummary(e.target.value)}
                        placeholder={t("ملخص المكالمة أو الرسالة...", "Résumé de l'échange...")}
                      />
                      <Button
                        size="sm"
                        variant="outline-primary"
                        onClick={handleAddCommunication}
                        disabled={savingLead}
                      >
                        +
                      </Button>
                    </div>
                    <div style={{ maxHeight: 170, overflowY: "auto" }}>
                      {(selectedLead.communicationHistory || []).length === 0 ? (
                        <p className="small text-muted mb-0">
                          {t("لم يُوثق تواصل بعد.", "Aucun échange enregistré.")}
                        </p>
                      ) : (
                        [...(selectedLead.communicationHistory || [])].reverse().map((c, idx) => (
                          <div key={c._id || idx} className="small border-bottom py-1">
                            <div>
                              <Badge bg="secondary" className="me-1">
                                {c.channel}
                              </Badge>
                              {c.summary}
                            </div>
                            <div className="text-muted" style={{ fontSize: "0.75rem" }}>
                              {c.authorName || "Admin"} •{" "}
                              {c.createdAt ? new Date(c.createdAt).toLocaleString() : ""}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </Col>
              </Row>
            </>
          )}
        </Modal.Body>
      </Modal>
    </Container>
  );
};

export default AdminLeadsPage;
