import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { Container, Row, Col, Table, Badge } from "react-bootstrap";
import { useLanguage } from "../context/LanguageContext";
import { statusLabel, statusVariant } from "../utils/orderStatus";

const AdminDashboardPage = () => {
  const { language } = useLanguage();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const [statsRes, wilayasRes] = await Promise.all([
          axios.get("/api/admin/dashboard/stats"),
          axios.get("/api/admin/dashboard/top-wilayas").catch(() => ({ data: { data: [] } })),
        ]);
        setStats({
          ...(statsRes.data?.data || {}),
          topWilayas: wilayasRes.data?.data || [],
        });
        setLoading(false);
      } catch (err) {
        console.error("Error loading dashboard stats:", err);
        setError("Failed to load dashboard statistics");
        setLoading(false);
      }
    };

    void loadStats();
  }, [language]);

  const t = (ar: string, fr: string) => (language === "ar" ? ar : fr);

  if (loading) {
    return (
      <div className="dxn-loading" role="status">
        <div className="dxn-loading-ring" />
        <div>{t("جارٍ تحميل الإحصائيات...", "Chargement des statistiques...")}</div>
      </div>
    );
  }
  if (error) return <div className="dxn-feedback-error p-3">{error}</div>;

  const commerceCards = [
    { label: t("إجمالي الطلبات", "Total Commandes"), value: stats?.totalOrders ?? 0, color: "#0f5f2f" },
    { label: t("طلبات جديدة", "Nouvelles commandes"), value: stats?.newOrders ?? 0, color: "#0284c7" },
    { label: t("إجمالي العملاء", "Total Clients"), value: stats?.totalCustomers ?? 0, color: "#1d7fb8" },
    { label: t("الطلبات المسلمة", "Commandes livrées"), value: stats?.delivered ?? 0, color: "#1e7e46" },
  ];

  const crmCards = [
    { label: t("طلبات انضمام جديدة", "Nouveaux leads"), value: stats?.leads?.new ?? 0, color: "#0369a1" },
    { label: t("تم التواصل معهم", "Leads contactés"), value: stats?.leads?.contacted ?? 0, color: "#b45309" },
    { label: t("مهتمون بالانضمام", "Leads intéressés"), value: stats?.leads?.interested ?? 0, color: "#6d28d9" },
    { label: t("أعضاء مسجلون رسمياً", "Membres inscrits"), value: stats?.leads?.registeredMember ?? 0, color: "#0b3d1f" },
  ];

  const ordersBySource: any[] = stats?.trafficSources?.ordersBySource || [];
  const leadsBySource: any[] = stats?.trafficSources?.leadsBySource || [];

  return (
    <Container fluid>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 dxn-admin-header mb-4">
        <div>
          <h1 className="dxn-admin-title h3 mb-1">
            {t("لوحة تحكم DXN للحياة الطبيعية", "Tableau de bord DXN Natural Life")}
          </h1>
          <p className="dxn-admin-sub mb-0">
            {t(
              "إحصائيات حقيقية مباشرة من قاعدة البيانات للطلبات، العملاء، نظام الـ CRM، ومصادر الزيارات.",
              "Indicateurs temps réel issus de la base de données : commandes, clients, CRM et sources de trafic."
            )}
          </p>
        </div>
        <div className="d-flex flex-wrap gap-2">
          <Link to="/admin/leads" className="dxn-btn dxn-btn-primary btn-sm">
            {t("إدارة طلبات الانضمام (CRM)", "Gérer le CRM")}
          </Link>
          <Link to="/admin/settings" className="dxn-btn dxn-btn-outline btn-sm">
            {t("ضبط رقم الراعي والروابط", "Paramètres & Parrain")}
          </Link>
        </div>
      </div>

      {stats && (
        <>
          {/* E-Commerce KPIs */}
          <h2 className="h6 text-uppercase text-muted fw-bold mb-2">
            {t("مؤشرات المتجر والطلبات", "Activité Boutique & Commandes")}
          </h2>
          <Row className="g-3 mb-4">
            {commerceCards.map((card) => (
              <Col key={card.label} xs={6} md={3}>
                <div className="dxn-stat-card" style={{ "--stat-color": card.color } as React.CSSProperties}>
                  <span className="dxn-stat-label">{card.label}</span>
                  <span className="dxn-stat-value">{card.value}</span>
                </div>
              </Col>
            ))}
          </Row>

          {/* CRM & Recruitment KPIs (Phase 10.2) */}
          <h2 className="h6 text-uppercase text-muted fw-bold mb-2">
            {t("مؤشرات استقطاب الفريق والـ CRM", "Pipeline Recrutement & CRM")}
          </h2>
          <Row className="g-3 mb-4">
            {crmCards.map((card) => (
              <Col key={card.label} xs={6} md={3}>
                <div className="dxn-stat-card" style={{ "--stat-color": card.color } as React.CSSProperties}>
                  <span className="dxn-stat-label">{card.label}</span>
                  <span className="dxn-stat-value">{card.value}</span>
                </div>
              </Col>
            ))}
          </Row>

          {/* Realized Revenue + Lead Conversion Summary */}
          <Row className="g-3 mb-4">
            <Col md={6}>
              <div className="dxn-admin-card h-100">
                <div className="dxn-admin-card-head">
                  {t("الإيرادات المحققة (الطلبات المسلمة)", "Revenus réalisés (commandes livrées)")}
                </div>
                <div className="dxn-admin-card-body">
                  <span className="dxn-stat-value" style={{ fontSize: "1.9rem" }}>
                    {Number(stats.totalRevenue || 0).toLocaleString("fr-DZ")} DA
                  </span>
                  <div className="small text-muted mt-1">
                    {t("الطلبات المؤكدة حالياً:", "Commandes confirmées :")} <strong>{stats.confirmed ?? 0}</strong>
                  </div>
                </div>
              </div>
            </Col>

            <Col md={6}>
              <div className="dxn-admin-card h-100">
                <div className="dxn-admin-card-head">
                  {t("معدل التحول إلى أعضاء مسجلين ورسائل التواصل", "Conversion CRM & Messages")}
                </div>
                <div className="dxn-admin-card-body d-flex flex-wrap justify-content-between align-items-center gap-3">
                  <div>
                    <span className="dxn-stat-value" style={{ fontSize: "1.9rem" }}>
                      {stats.leads?.conversionRate ?? 0}%
                    </span>
                    <div className="small text-muted">
                      {t("نسبة التحول من إجمالي طلبات الانضمام", "Taux de conversion leads → membres")} (
                      {stats.leads?.registeredMember ?? 0} / {stats.leads?.total ?? 0})
                    </div>
                  </div>
                  <div className="text-end">
                    <div className="fw-bold fs-5">{stats.unreadMessages ?? 0}</div>
                    <Link to="/admin/messages" className="small text-decoration-none">
                      {t("رسائل تواصل جديدة ←", "Nouveaux messages →")}
                    </Link>
                  </div>
                </div>
              </div>
            </Col>
          </Row>

          {/* Phase 9.2: Traffic & Referral Source Attribution Analytics */}
          <Row className="g-3 mb-4">
            <Col lg={6}>
              <div className="dxn-admin-card h-100">
                <div className="dxn-admin-card-head">
                  {t("مصادر الطلبات حسب الرابط (?ref=)", "Commandes par source de trafic (?ref=)")}
                </div>
                <div className="dxn-admin-card-body">
                  {ordersBySource.length > 0 ? (
                    <Table size="sm" responsive className="mb-0 align-middle">
                      <thead>
                        <tr>
                          <th>{t("المصدر", "Source")}</th>
                          <th>{t("عدد الطلبات", "Commandes")}</th>
                          <th>{t("إيرادات مسلمة", "Revenus livrés")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ordersBySource.map((row: any) => (
                          <tr key={row.source}>
                            <td>
                              <Badge bg="light" text="dark" className="border">
                                {row.source}
                              </Badge>
                            </td>
                            <td>{row.count}</td>
                            <td>{Number(row.revenue || 0).toLocaleString("fr-DZ")} DA</td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  ) : (
                    <p className="text-muted small mb-0">
                      {t("لا توجد بيانات مصادر طلبات مسجلة بعد.", "Aucune donnée de source de commande pour le moment.")}
                    </p>
                  )}
                </div>
              </div>
            </Col>

            <Col lg={6}>
              <div className="dxn-admin-card h-100">
                <div className="dxn-admin-card-head">
                  {t("مصادر طلبات الانضمام للفريق (?ref=)", "Leads d'adhésion par source (?ref=)")}
                </div>
                <div className="dxn-admin-card-body">
                  {leadsBySource.length > 0 ? (
                    <Table size="sm" responsive className="mb-0 align-middle">
                      <thead>
                        <tr>
                          <th>{t("المصدر", "Source")}</th>
                          <th>{t("عدد المتقدمين", "Total Leads")}</th>
                          <th>{t("مسجلون رسمياً", "Membres inscrits")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {leadsBySource.map((row: any) => (
                          <tr key={row.source}>
                            <td>
                              <Badge bg="light" text="dark" className="border">
                                {row.source}
                              </Badge>
                            </td>
                            <td>{row.count}</td>
                            <td>{row.registeredCount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  ) : (
                    <p className="text-muted small mb-0">
                      {t(
                        "لم تُسجَّل طلبات انضمام بعد. يمكنك مشاركة رابط /join?ref=instagram أو ?ref=tiktok لتتبع الحملات.",
                        "Aucun lead enregistré pour le moment. Partagez /join?ref=instagram ou ?ref=tiktok pour suivre vos campagnes."
                      )}
                    </p>
                  )}
                </div>
              </div>
            </Col>
          </Row>

          {/* Recent Orders */}
          <div className="dxn-admin-card mb-4">
            <div className="dxn-admin-card-head d-flex justify-content-between align-items-center">
              <span>{t("الطلبات الأخيرة", "Commandes récentes")}</span>
              <Link to="/admin/orders" className="small text-decoration-none">
                {t("كل الطلبات ←", "Toutes les commandes →")}
              </Link>
            </div>
            <div className="dxn-admin-card-body">
              {stats.recentOrders && stats.recentOrders.length > 0 ? (
                <div className="admin-table-wrap">
                  <Table striped hover responsive className="mb-0 align-middle">
                    <thead>
                      <tr>
                        <th>{t("رقم الطلب", "N° Commande")}</th>
                        <th>{t("العميل", "Client")}</th>
                        <th>{t("عضوية DXN", "ID DXN")}</th>
                        <th>{t("المجموع", "Total")}</th>
                        <th>{t("الحالة", "Statut")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.recentOrders.slice(0, 6).map((order: any) => (
                        <tr key={order._id || order.orderNumber}>
                          <td dir="ltr">{order.orderNumber}</td>
                          <td>
                            {order.customerInfo?.firstName || ""} {order.customerInfo?.lastName || ""}
                          </td>
                          <td>
                            {order.dxnMemberId ? (
                              <Badge bg="info" text="dark">{order.dxnMemberId}</Badge>
                            ) : (
                              <span className="text-muted small">—</span>
                            )}
                          </td>
                          <td>{Number(order.total || 0).toLocaleString("fr-DZ")} DA</td>
                          <td>
                            <Badge pill bg={statusVariant(order.status)}>
                              {statusLabel(order.status, language)}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              ) : (
                <p className="mb-0 text-muted">{t("لا توجد طلبات مسجلة حالياً.", "Aucune commande enregistrée.")}</p>
              )}
            </div>
          </div>

          {/* Top Products */}
          <div className="dxn-admin-card mb-4">
            <div className="dxn-admin-card-head">
              {t("المنتجات الأكثر مبيعاً", "Produits les plus vendus")}
            </div>
            <div className="dxn-admin-card-body">
              {stats.topProducts && stats.topProducts.length > 0 ? (
                <div className="admin-table-wrap">
                  <Table striped hover responsive className="mb-0 align-middle">
                    <thead>
                      <tr>
                        <th>{t("اسم المنتج", "Produit")}</th>
                        <th>{t("الكمية المباعة", "Quantité vendue")}</th>
                        <th>{t("قيمة المبيعات", "Montant")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.topProducts.slice(0, 5).map((product: any, index: number) => (
                        <tr key={product._id || index}>
                          <td>{product.name || "Product"}</td>
                          <td>{product.totalSold}</td>
                          <td>{Number(product.revenue || 0).toLocaleString("fr-DZ")} DA</td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              ) : (
                <p className="mb-0 text-muted">{t("لا توجد مبيعات مسجلة بعد.", "Aucune vente enregistrée.")}</p>
              )}
            </div>
          </div>
        </>
      )}
    </Container>
  );
};

export default AdminDashboardPage;
