import React, { useEffect, useState } from "react";
import { useLanguage } from "../context/LanguageContext";
import axios from "axios";
import { Container, Row, Col, Table, Badge } from "react-bootstrap";
import { statusLabel, statusVariant } from "../utils/orderStatus";

const AdminDashboardPage = () => {
  const { language } = useLanguage();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const response = await axios.get("/api/admin/dashboard/stats");
        const data = response.data.data;
        setStats(data);
        try {
          const tw = await axios.get("/api/admin/dashboard/top-wilayas");
          setStats((s: any) => ({ ...s, topWilayas: tw.data?.data || [] }));
        } catch (twErr) {
          console.error("Error loading top wilayas:", twErr);
        }
        setLoading(false);
      } catch (err) {
        console.error("Error loading dashboard stats:", err);
        setError("Failed to load dashboard statistics");
        setLoading(false);
      }
    };

    loadStats();
  }, [language]);

  const t = (ar: string, fr: string) => (language === "ar" ? ar : fr);

  if (loading) {
    return (
      <div className="dxn-loading" role="status">
        <div className="dxn-loading-ring"></div>
        <div>{t("جارٍ تحميل الإحصائيات...", "Chargement des statistiques...")}</div>
      </div>
    );
  }
  if (error) return <div className="dxn-feedback-error p-3">{error}</div>;

  const statsCards = [
    { label: t("إجمالي الطلبات", "Total Orders"), value: stats?.totalOrders || 0, color: "#1a5d3a" },
    { label: t("في انتظار الدفع", "Pending Orders"), value: stats?.pendingPayment || 0, color: "#d4a017" },
    { label: t("الطلبات المؤكدة", "Confirmed Orders"), value: stats?.confirmed || 0, color: "#1d7fb8" },
    { label: t("الطلبات المسلمة", "Delivered Orders"), value: stats?.delivered || 0, color: "#1e7e46" },
  ];

  return (
    <Container fluid>
      <div className="dxn-admin-header mb-4">
        <h1 className="dxn-admin-title h3">{t("لوحة التحكم", "Tableau de bord")}</h1>
        <p className="dxn-admin-sub">
          {t("نظرة عامة على الطلبات والإيرادات في المتجر.", "Aperçu des commandes et revenus de la boutique.")}
        </p>
      </div>

      {stats && (
        <>
          {/* Key stats */}
          <Row className="g-3 mb-4">
            {statsCards.map((card) => (
              <Col key={card.label} xs={6} md={4} xl={3}>
                <div className="dxn-stat-card" style={{ "--stat-color": card.color } as React.CSSProperties}>
                  <span className="dxn-stat-label">{card.label}</span>
                  <span className="dxn-stat-value">{card.value}</span>
                  <div className="dxn-stat-hint">{t("إجمالي", "Total")}</div>
                </div>
              </Col>
            ))}
          </Row>

          {/* Revenue */}
          <div className="dxn-admin-card mb-4">
            <div className="dxn-admin-card-head">
              {t("إجمالي الإيرادات", "Total Revenue")}
            </div>
            <div className="dxn-admin-card-body">
              <span className="dxn-stat-value" style={{ fontSize: "2rem" }}>
                {(stats.totalRevenue > 0 ? stats.totalRevenue.toLocaleString("fr-DZ") : "0")} DA
              </span>
            </div>
          </div>

          {/* Recent orders */}
          <div className="dxn-admin-card mb-4">
            <div className="dxn-admin-card-head">
              {t("الطلبات الأخيرة", "Recent Orders")}
            </div>
            <div className="dxn-admin-card-body">
              {stats.recentOrders && stats.recentOrders.length > 0 ? (
                <div className="admin-table-wrap">
                  <Table striped hover responsive className="mb-0 align-middle">
                    <thead>
                      <tr>
                        <th>{t("رقم الطلب", "Order #")}</th>
                        <th>{t("العميل", "Customer")}</th>
                        <th>{t("المجموع", "Total")}</th>
                        <th>{t("الحالة", "Status")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.recentOrders.slice(0, 5).map((order: any, index: number) => (
                        <tr key={index}>
                          <td dir="ltr">{order.orderNumber}</td>
                          <td>{order.customerInfo?.firstName || "-"}</td>
                          <td>{order.total} DA</td>
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
                <p className="mb-0 text-muted">{t("لا توجد طلبات", "No orders")}</p>
              )}
            </div>
          </div>

          {/* Top products */}
          <div className="dxn-admin-card mb-4">
            <div className="dxn-admin-card-head">
              {t("المنتجات الأكثر مبيعاً", "Top Selling Products")}
            </div>
            <div className="dxn-admin-card-body">
              {stats.topProducts && stats.topProducts.length > 0 ? (
                <div className="admin-table-wrap">
                  <Table striped hover responsive className="mb-0 align-middle">
                    <thead>
                      <tr>
                        <th>{t("اسم المنتج", "Product Name")}</th>
                        <th>{t("الكمية المباعة", "Quantity Sold")}</th>
                        <th>{t("الإيرادات", "Revenue")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.topProducts.slice(0, 5).map((product: any, index: number) => {
                        const productName =
                          product.name ||
                          product.product?.title ||
                          String(product._id || "").substring(0, 8) ||
                          "—";
                        return (
                          <tr key={index}>
                            <td>
                              {productName}
                              {product.kind === "pack" && (
                                <Badge pill bg="dark" className="ms-2">
                                  {t("حزمة", "Pack")}
                                </Badge>
                              )}
                            </td>
                            <td>{product.totalSold}</td>
                            <td>{product.revenue?.toLocaleString("fr-DZ") || "0"} DA</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </Table>
                </div>
              ) : (
                <p className="mb-0 text-muted">{t("لا توجد بيانات", "No data")}</p>
              )}
            </div>
          </div>

          {/* Top wilayas */}
          <div className="dxn-admin-card mb-4">
            <div className="dxn-admin-card-head">
              {t("أعلى الولايات", "Top Wilayas")}
            </div>
            <div className="dxn-admin-card-body">
              {stats.topWilayas && stats.topWilayas.length > 0 ? (
                <div className="admin-table-wrap">
                  <Table striped hover responsive className="mb-0 align-middle">
                    <thead>
                      <tr>
                        <th>{t("الولاية", "Wilaya")}</th>
                        <th>{t("عدد الطلبات", "Order Count")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.topWilayas.slice(0, 5).map((wilaya: any, index: number) => (
                        <tr key={index}>
                          <td>{wilaya.wilayaInfo?.[0]?.name || wilaya._id}</td>
                          <td>{wilaya.orderCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              ) : (
                <p className="mb-0 text-muted">{t("لا توجد بيانات", "No data")}</p>
              )}
            </div>
          </div>
        </>
      )}
    </Container>
  );
};

export default AdminDashboardPage;