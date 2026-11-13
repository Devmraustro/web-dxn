import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { Container, Table, Badge, Button, Form, Alert, Spinner } from "react-bootstrap";
import { useLanguage } from "../context/LanguageContext";

interface ContactItem {
  _id: string;
  reference: string;
  name: string;
  phone?: string;
  email?: string;
  subject?: string;
  message: string;
  status: "new" | "read" | "replied" | "archived";
  adminNotes?: string;
  createdAt?: string;
}

const AdminMessagesPage: React.FC = () => {
  const { language, dir } = useLanguage();
  const isAr = language === "ar";
  const t = useCallback((ar: string, fr: string) => (isAr ? ar : fr), [isAr]);

  const [messages, setMessages] = useState<ContactItem[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMessages = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      const res = await axios.get("/api/admin/messages", { params });
      setMessages(Array.isArray(res.data?.data) ? res.data.data : []);
      setError(null);
    } catch (err: any) {
      setError(err?.response?.data?.message || t("فشل تحميل الرسائل", "Échec du chargement des messages"));
    } finally {
      setLoading(false);
    }
  }, [statusFilter, t]);

  useEffect(() => {
    void loadMessages();
  }, [loadMessages]);

  const updateStatus = async (id: string, status: ContactItem["status"]) => {
    try {
      const res = await axios.patch(`/api/admin/messages/${id}`, { status });
      const updated = res.data?.data;
      if (updated) {
        setMessages((prev) => prev.map((m) => (m._id === id ? updated : m)));
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || t("تعذر تحديث الحالة", "Échec de la mise à jour"));
    }
  };

  return (
    <Container fluid dir={dir}>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 dxn-admin-header mb-4">
        <div>
          <h1 className="dxn-admin-title h3 mb-1">
            {t("رسائل واستفسارات التواصل", "Messages & Demandes de contact")}
          </h1>
          <p className="dxn-admin-sub mb-0">
            {t("إدارة جميع الاستفسارات الواردة من صفحة تواصل معنا.", "Gérez les messages reçus depuis la page Contact.")}
          </p>
        </div>
        <Form.Select
          style={{ maxWidth: 220 }}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">{t("كل الرسائل", "Tous les messages")}</option>
          <option value="new">{t("جديدة", "Nouveaux")}</option>
          <option value="read">{t("مقروءة", "Lus")}</option>
          <option value="replied">{t("تم الرد", "Répondus")}</option>
          <option value="archived">{t("مؤرشفة", "Archivés")}</option>
        </Form.Select>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      <div className="dxn-admin-card">
        <div className="admin-table-wrap p-3">
          {loading ? (
            <div className="text-center py-5">
              <Spinner animation="border" />
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-5 text-muted">
              {t("لا توجد رسائل تواصل حالياً.", "Aucun message pour le moment.")}
            </div>
          ) : (
            <Table hover responsive className="align-middle mb-0">
              <thead>
                <tr>
                  <th>{t("المرجع", "Réf")}</th>
                  <th>{t("المرسل", "Expéditeur")}</th>
                  <th>{t("الموضوع", "Sujet")}</th>
                  <th>{t("الرسالة", "Message")}</th>
                  <th>{t("الحالة", "Statut")}</th>
                  <th>{t("التاريخ", "Date")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {messages.map((m) => (
                  <tr key={m._id}>
                    <td dir="ltr" className="small fw-semibold">
                      {m.reference}
                    </td>
                    <td>
                      <div className="fw-bold">{m.name}</div>
                      {m.phone && (
                        <div dir="ltr" className="small text-muted">
                          {m.phone}
                        </div>
                      )}
                      {m.email && (
                        <div dir="ltr" className="small text-muted">
                          {m.email}
                        </div>
                      )}
                    </td>
                    <td className="fw-semibold small">{m.subject || "—"}</td>
                    <td className="small" style={{ maxWidth: 360 }}>
                      {m.message}
                    </td>
                    <td>
                      <Badge
                        bg={
                          m.status === "new"
                            ? "primary"
                            : m.status === "replied"
                            ? "success"
                            : "secondary"
                        }
                      >
                        {m.status}
                      </Badge>
                    </td>
                    <td className="small text-muted">
                      {m.createdAt ? new Date(m.createdAt).toLocaleDateString() : "—"}
                    </td>
                    <td>
                      <div className="d-flex flex-wrap gap-1">
                        {m.status === "new" && (
                          <Button
                            size="sm"
                            variant="outline-secondary"
                            onClick={() => updateStatus(m._id, "read")}
                          >
                            {t("مقروء", "Lu")}
                          </Button>
                        )}
                        {m.status !== "replied" && (
                          <Button
                            size="sm"
                            variant="outline-success"
                            onClick={() => updateStatus(m._id, "replied")}
                          >
                            {t("تم الرد", "Répondu")}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>
      </div>
    </Container>
  );
};

export default AdminMessagesPage;
