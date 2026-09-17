import { useCallback, useEffect, useState } from "react";
import { useLanguage } from "../context/LanguageContext";
import {
  Container,
  Row,
  Col,
  Table,
  Button,
  Form,
  Badge,
  Alert,
  Modal,
  Spinner,
} from "react-bootstrap";
import axios from "axios";
import {
  ORDER_STATUSES,
  nextStatuses,
  statusLabel as orderStatusLabel,
  statusVariant as orderStatusVariant,
} from "../utils/orderStatus";
import type { OrderStatus } from "../utils/orderStatus";

const PAYMENT_LABELS: Record<string, [string, string]> = {
  cod: ["الدفع عند الاستلام", "Paiement à la livraison"],
  baridimob: ["بريدي موب", "BaridiMob"],
};

const PAYMENT_STATUS_LABELS: Record<string, [string, string]> = {
  pending: ["قيد التحقق", "En attente"],
  verified: ["مؤكد", "Vérifié"],
  rejected: ["مرفوض", "Rejeté"],
  completed: ["مكتمل", "Complété"],
};

interface OrderItem {
  productId?: string;
  packId?: string;
  productName: string;
  packName?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

interface AdminOrder {
  _id: string;
  orderNumber: string;
  customerId?: { firstName?: string; lastName?: string; phone?: string };
  customerInfo?: {
    firstName: string;
    lastName: string;
    phone: string;
    secondPhone?: string;
    wilaya?: string;
    commune?: string;
    address?: string;
  };
  deliveryMethod: "home" | "office";
  wilaya?: string;
  commune?: string;
  address?: string;
  paymentMethod: "cod" | "baridimob";
  paymentStatus?: string;
  status: OrderStatus;
  subtotal: number;
  shippingFee: number;
  discount: number;
  total: number;
  items: OrderItem[];
  createdAt?: string;
  updatedAt?: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

const PAGE_SIZE = 20;

const AdminOrdersPage = () => {
  const { language } = useLanguage();
  const t = useCallback((ar: string, fr: string) => (language === "ar" ? ar : fr), [language]);

  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: PAGE_SIZE, total: 0, pages: 0 });

  const [detail, setDetail] = useState<AdminOrder | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const showSuccessTmp = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 3500);
  };

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit: PAGE_SIZE };
      if (statusFilter) params.status = statusFilter;
      if (paymentFilter) params.paymentMethod = paymentFilter;
      const response = await axios.get("/api/orders", { params });
      setOrders(Array.isArray(response.data?.data) ? response.data.data : []);
      setPagination(
        response.data?.pagination || { page: 1, limit: PAGE_SIZE, total: 0, pages: 0 }
      );
      setError(null);
    } catch (err: any) {
      console.error("Error loading orders:", err);
      if (err?.response?.status === 401 || err?.response?.status === 403) {
        setError(t("غير مصرح — أعد تسجيل الدخول", "Non autorisé — reconnectez-vous"));
      } else {
        setError(err?.response?.data?.message || t("فشل تحميل الطلبات", "Échec du chargement des commandes"));
      }
    } finally {
      setLoading(false);
    }
  }, [t, page, statusFilter, paymentFilter]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  const statusLabel = (s: string) => orderStatusLabel(s, language);
  const statusVariant = (s: string) => orderStatusVariant(s);

  const paymentLabel = (m: string) => {
    const pair = PAYMENT_LABELS[m] || [m, m];
    return language === "ar" ? pair[0] : pair[1];
  };

  const paymentStatusLabel = (s?: string, m?: string) => {
    if (m === "cod") return "—";
    const pair = PAYMENT_STATUS_LABELS[s || "pending"] || ["", ""];
    return language === "ar" ? pair[0] : pair[1];
  };

  const formatMoney = (n: number) =>
    `${Number(n || 0).toLocaleString(language === "ar" ? "ar-DZ" : "fr-FR")} DA`;

  const formatDate = (iso?: string) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleString(language === "ar" ? "ar-DZ" : "fr-FR", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const customerFullName = (o: AdminOrder) => {
    const ci = o.customerInfo;
    const fromCustomer = o.customerId as { firstName?: string; lastName?: string } | undefined;
    const first = (ci?.firstName || fromCustomer?.firstName || "").trim();
    const last = (ci?.lastName || fromCustomer?.lastName || "").trim();
    const name = `${first} ${last}`.trim();
    return name || "—";
  };

  const customerPhone = (o: AdminOrder) =>
    o.customerInfo?.phone ||
    (o.customerId as { phone?: string } | undefined)?.phone ||
    "—";

  const itemCount = (o: AdminOrder) =>
    Array.isArray(o.items) ? o.items.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0) : 0;

  const filtered = (() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter((o) => {
      const number = (o.orderNumber || "").toLowerCase();
      const name = (customerFullName(o) || "").toLowerCase();
      const phone = (customerPhone(o) || "").toLowerCase();
      const wilaya = String(o.customerInfo?.wilaya || o.wilaya || "").toLowerCase();
      return number.includes(q) || name.includes(q) || phone.includes(q) || wilaya.includes(q);
    });
  })();

  const handleStatusFilter = (value: string) => {
    setStatusFilter(value);
    setPage(1);
  };

  const handlePaymentFilter = (value: string) => {
    setPaymentFilter(value);
    setPage(1);
  };

  const updateStatus = async (order: AdminOrder, next: string) => {
    if (!next || next === order.status) return;
    setUpdatingId(order._id);
    setError(null);
    try {
      const response = await axios.put(`/api/orders/${order._id}/status`, { status: next });
      const updated = response.data?.data;
      if (updated) {
        setOrders((prev) => prev.map((o) => (o._id === order._id ? { ...o, ...updated } : o)));
      }
      showSuccessTmp(t("تم تحديث حالة الطلب", "Statut de la commande mis à jour"));
    } catch (err: any) {
      setError(
        err?.response?.data?.message || t("فشل تحديث حالة الطلب", "Échec de la mise à jour du statut")
      );
      void loadOrders();
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <>
      <Container fluid>
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-4 dxn-admin-header">
          <div>
            <h1 className="dxn-admin-title h3 mb-1">{t("إدارة الطلبات", "Gestion des commandes")}</h1>
            <p className="dxn-admin-sub mb-0">
              {t(
                "حالة الطلب تُحدّث من هنا ويُبلغ العميل تلقائياً.",
                "Le statut des commandes est géré ici et notifie automatiquement le client."
              )}
            </p>
          </div>
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

        <div className="dxn-admin-card mb-3">
          <div className="admin-table-wrap p-3">
            <RowFilters
              statusFilter={statusFilter}
              paymentFilter={paymentFilter}
              searchQuery={searchQuery}
              onStatus={handleStatusFilter}
              onPayment={handlePaymentFilter}
              onSearch={setSearchQuery}
              t={t}
              language={language}
            />
          </div>
        </div>

        <div className="dxn-admin-card">
          <div className="admin-table-wrap p-3">
            {loading ? (
              <div className="text-center py-5">
                <Spinner animation="border" />
                <p className="mt-2">{t("جاري التحميل...", "Chargement...")}</p>
              </div>
            ) : filtered.length === 0 ? (
              <Alert variant="info" className="mb-0">
                {t("لا توجد طلبات مطابقة.", "Aucune commande ne correspond.")}
              </Alert>
            ) : (
              <>
                <Table striped hover responsive className="mb-0 align-middle">
                  <thead>
                    <tr>
                      <th>{t("رقم الطلب", "N° commande")}</th>
                      <th>{t("التاريخ", "Date")}</th>
                      <th>{t("العميل", "Client")}</th>
                      <th>{t("الولاية", "Wilaya")}</th>
                      <th className="text-center">{t("الكمية", "Qté")}</th>
                      <th className="text-end">{t("المجموع", "Total")}</th>
                      <th>{t("الدفع", "Paiement")}</th>
                      <th>{t("الحالة", "Statut")}</th>
                      <th style={{ minWidth: 170 }}>{t("إجراءات", "Actions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((o) => (
                      <tr key={o._id}>
                        <td>
                          <div className="fw-semibold">{o.orderNumber || o._id.slice(-6)}</div>
                          <small className="text-muted">{o._id}</small>
                        </td>
                        <td>{formatDate(o.createdAt)}</td>
                        <td>
                          <div>{customerFullName(o)}</div>
                          <small className="text-muted" dir="ltr">
                            {customerPhone(o)}
                          </small>
                        </td>
                        <td>{String(o.customerInfo?.wilaya || o.wilaya || "—")}</td>
                        <td className="text-center">{itemCount(o)}</td>
                        <td className="text-end fw-semibold">{formatMoney(o.total)}</td>
                        <td>
                          <div>{paymentLabel(o.paymentMethod)}</div>
                          <small className="text-muted">{paymentStatusLabel(o.paymentStatus, o.paymentMethod)}</small>
                        </td>
                        <td>
                          <Badge pill bg={statusVariant(o.status)}>
                            {statusLabel(o.status)}
                          </Badge>
                        </td>
                        <td>
                          <div className="d-flex align-items-center gap-2 flex-wrap">
                            <Button
                              variant="outline-primary"
                              size="sm"
                              onClick={() => setDetail(o)}
                            >
                              {t("تفاصيل", "Détails")}
                            </Button>
                            <StatusSelect
                              order={o}
                              disabled={updatingId === o._id}
                              onUpdate={updateStatus}
                              t={t}
                              language={language}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
                {pagination.pages > 1 && (
                  <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mt-3">
                    <span className="text-muted small">
                      {t("صفحة", "Page")} {pagination.page} / {pagination.pages} —{" "}
                      {pagination.total} {t("طلباً", "commandes")}
                    </span>
                    <div className="d-flex gap-2">
                      <Button
                        variant="outline-secondary"
                        size="sm"
                        disabled={pagination.page <= 1}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                      >
                        {t("السابق", "Précédent")}
                      </Button>
                      <Button
                        variant="outline-secondary"
                        size="sm"
                        disabled={pagination.page >= pagination.pages}
                        onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
                      >
                        {t("التالي", "Suivant")}
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </Container>

      <Modal
        show={detail !== null}
        onHide={() => setDetail(null)}
        size="lg"
        dir={language === "ar" ? "rtl" : "ltr"}
        aria-labelledby="admin-order-modal-title"
      >
        <Modal.Header closeButton>
          <Modal.Title id="admin-order-modal-title" className="d-flex align-items-center gap-2">
            {t("تفاصيل الطلب", "Détails de la commande")} {detail?.orderNumber || ""}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {detail && (
            <>
              <div className="d-flex flex-wrap gap-2 mb-3">
                <Badge pill bg={statusVariant(detail.status)}>
                  {statusLabel(detail.status)}
                </Badge>
                <Badge pill bg="secondary">
                  {paymentLabel(detail.paymentMethod)}
                </Badge>
              </div>

              <Row className="g-2">
                <Col md={6} xl={3}>
                  <ColInfo
                    label={t("العميل", "Client")}
                    value={customerFullName(detail)}
                    phone={customerPhone(detail)}
                  />
                </Col>
                <Col md={6} xl={3}>
                  <ColInfo
                    label={t("التوصيل", "Livraison")}
                    value={
                      detail.deliveryMethod === "home"
                        ? t("توصيل للمنزل", "À domicile")
                        : t("توصيل للمكتب", "Au bureau")
                    }
                    sub={`${String(detail.customerInfo?.wilaya || detail.wilaya || "")} ${detail.customerInfo?.commune || detail.commune || ""}`.trim()}
                    second={detail.customerInfo?.address || detail.address || ""}
                  />
                </Col>
                <Col md={6} xl={3}>
                  <ColInfo
                    label={t("الدفع", "Paiement")}
                    value={paymentLabel(detail.paymentMethod)}
                    sub={paymentStatusLabel(detail.paymentStatus, detail.paymentMethod)}
                  />
                </Col>
                <Col md={6} xl={3}>
                  <ColInfo
                    label={t("رقم الطلب الداخلي", "ID")}
                    value={detail._id}
                    sub={formatDate(detail.createdAt)}
                  />
                </Col>
              </Row>

              <h6 className="mt-4 mb-2 fw-semibold">{t("المنتجات", "Produits")}</h6>
              <Table responsive size="sm" className="mb-0">
                <thead>
                  <tr>
                    <th>{t("المنتج", "Produit")}</th>
                    <th>{t("النوع", "Type")}</th>
                    <th className="text-center">{t("الكمية", "Qté")}</th>
                    <th className="text-end">{t("سعر الوحدة", "Prix unitaire")}</th>
                    <th className="text-end">{t("المجموع", "Total")}</th>
                  </tr>
                </thead>
                <tbody>
                  {(detail.items || []).map((it, idx) => (
                    <tr key={`${it.productId || it.packId || ""}-${idx}`}>
                      <td>{it.productName}</td>
                      <td>
                        {it.packId
                          ? t("حزمة", "Pack")
                          : t("منتج", "Produit")}
                      </td>
                      <td className="text-center">{it.quantity}</td>
                      <td className="text-end">{formatMoney(it.unitPrice)}</td>
                      <td className="text-end fw-semibold">{formatMoney(it.totalPrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>

              <div className="mt-3" style={{ width: "100%", maxWidth: 320, marginInlineStart: "auto" }}>
                <div className="d-flex justify-content-between py-1">
                  <span>{t("المجموع الفرعي", "Sous-total")}</span>
                  <span>{formatMoney(detail.subtotal)}</span>
                </div>
                <div className="d-flex justify-content-between py-1">
                  <span>{t("التوصيل", "Livraison")}</span>
                  <span>{formatMoney(detail.shippingFee)}</span>
                </div>
                {Number(detail.discount) > 0 && (
                  <div className="d-flex justify-content-between py-1 text-success">
                    <span>{t("الخصم", "Remise")}</span>
                    <span>- {formatMoney(detail.discount)}</span>
                  </div>
                )}
                <div className="d-flex justify-content-between py-2 border-top fw-bold">
                  <span>{t("الإجمالي", "Total")}</span>
                  <span>{formatMoney(detail.total)}</span>
                </div>
              </div>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setDetail(null)}>
            {t("إغلاق", "Fermer")}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

const RowFilters = ({
  statusFilter,
  paymentFilter,
  searchQuery,
  onStatus,
  onPayment,
  onSearch,
  t,
  language,
}: {
  statusFilter: string;
  paymentFilter: string;
  searchQuery: string;
  onStatus: (v: string) => void;
  onPayment: (v: string) => void;
  onSearch: (v: string) => void;
  t: (ar: string, fr: string) => string;
  language: string;
}) => (
  <Row className="g-2 align-items-end">
    <Col md={3}>
      <Form.Group>
        <Form.Label className="small text-muted mb-1">{t("البحث", "Recherche")}</Form.Label>
        <Form.Control
          type="search"
          placeholder={t("رقم الطلب / الاسم / الهاتف / الولاية", "N° / nom / téléphone / wilaya")}
          value={searchQuery}
          onChange={(e) => onSearch(e.target.value)}
        />
      </Form.Group>
    </Col>
    <Col md={3}>
      <Form.Group>
        <Form.Label className="small text-muted mb-1">{t("الحالة", "Statut")}</Form.Label>
        <Form.Select value={statusFilter} onChange={(e) => onStatus(e.target.value)}>
          <option value="">{t("الكل", "Tous")}</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {orderStatusLabel(s, language)}
            </option>
          ))}
        </Form.Select>
      </Form.Group>
    </Col>
    <Col md={3}>
      <Form.Group>
        <Form.Label className="small text-muted mb-1">{t("طريقة الدفع", "Paiement")}</Form.Label>
        <Form.Select value={paymentFilter} onChange={(e) => onPayment(e.target.value)}>
          <option value="">{t("الكل", "Tous")}</option>
          <option value="cod">{t("الدفع عند الاستلام", "À la livraison")}</option>
          <option value="baridimob">BaridiMob</option>
        </Form.Select>
      </Form.Group>
    </Col>
    <Col md={3} className="text-md-end">
      <Button
        variant="outline-secondary"
        size="sm"
        onClick={() => {
          onSearch("");
          onStatus("");
          onPayment("");
        }}
      >
        {t("مسح الفلاتر", "Réinitialiser")}
      </Button>
    </Col>
  </Row>
);

const ColInfo = ({
  label,
  value,
  sub,
  second,
  phone,
}: {
  label: string;
  value: string;
  sub?: string;
  second?: string;
  phone?: string;
}) => (
  <div className="p-2" style={{ background: "#f5f7f5", borderRadius: 8 }}>
    <div className="small text-muted">{label}</div>
    <div className="fw-semibold">{value}</div>
    {phone ? (
      <div className="small text-muted" dir="ltr" style={{ textAlign: "start" }}>
        {phone}
      </div>
    ) : null}
    {sub ? <div className="small text-muted">{sub}</div> : null}
    {second ? <div className="small text-muted">{second}</div> : null}
  </div>
);

const StatusSelect = ({
  order,
  disabled,
  onUpdate,
  t,
  language,
}: {
  order: AdminOrder;
  disabled: boolean;
  onUpdate: (order: AdminOrder, next: string) => void;
  t: (ar: string, fr: string) => string;
  language: string;
}) => {
  const allowed = nextStatuses(order.status);
  if (allowed.length === 0) {
    return (
      <span className="text-muted small">
        {t("لا انتقال ممكن", "Aucune transition")}
      </span>
    );
  }
  const label = (s: OrderStatus) => orderStatusLabel(s, language);
  return (
    <Form.Select
      size="sm"
      value=""
      disabled={disabled}
      className="dxn-status-select"
      onChange={(e) => onUpdate(order, e.target.value)}
      aria-label={t("تغيير الحالة", "Changer le statut")}
    >
      <option value="" disabled>
        {disabled ? t("...", "...") : t("تغيير إلى…", "Changer →")}
      </option>
      {allowed.map((s) => (
        <option key={s} value={s}>
          {label(s)}
        </option>
      ))}
    </Form.Select>
  );
};

export default AdminOrdersPage;