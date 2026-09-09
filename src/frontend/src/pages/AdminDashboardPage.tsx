import React, { useEffect, useState } from "react";
import { useLanguage } from "../context/LanguageContext";
import axios from "axios";
import { Container, Row, Col, Card, Table, Badge, Alert } from "react-bootstrap";

const AdminDashboardPage = () => {
  const { language } = useLanguage();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const response = await axios.get("/api/admin/dashboard/stats");
        setStats(response.data.data);
        setLoading(false);
      } catch (err) {
        console.error("Error loading dashboard stats:", err);
        setError("Failed to load dashboard statistics");
        setLoading(false);
      }
    };

    loadStats();
  }, [language]);

  if (loading) return <div>Loading dashboard...</div>;
  if (error) return <Alert variant="danger">{error}</Alert>;

  return (
    <>
      <Container>
        <h1 className="mb-4">{language === "ar" ? "لوحة التحكم" : "Tableau de bord"}</h1>

        {stats && (
          <Container>
            {/* Key Stats Row */}
            <Row className="mb-4">
              <Col xs={12} sm={6} md={4} xl={3}>
                <Card style={{ borderLeftColor: "#28a745", borderLeftWidth: "4px" }}>
                  <Card.Body>
                    <Card.Title>{language === "ar" ? "إجمالي الطلبات" : "Total Orders"}</Card.Title>
                    <Card.Text>
                      <Badge pill bg="secondary">{stats.totalOrders > 0 ? stats.totalOrders : 0}</Badge>
                    </Card.Text>
                  </Card.Body>
                </Card>
              </Col>
              <Col xs={12} sm={6} md={4} xl={3}>
                <Card style={{ borderLeftColor: "#dc3545", borderLeftWidth: "4px" }}>
                  <Card.Body>
                    <Card.Title>{language === "ar" ? "في انتظار الدفع" : "Pending Orders"}</Card.Title>
                    <Card.Text>
                      <Badge pill bg="warning">{stats.pendingPayment > 0 ? stats.pendingPayment : 0}</Badge>
                    </Card.Text>
                  </Card.Body>
                </Card>
              </Col>
              <Col xs={12} sm={6} md={4} xl={3}>
                <Card style={{ borderLeftColor: "#ffc107", borderLeftWidth: "4px" }}>
                  <Card.Body>
                    <Card.Title>{language === "ar" ? "الطلبات المؤكدة" : "Confirmed Orders"}</Card.Title>
                    <Card.Text>
                      <Badge pill bg="info">{stats.confirmed > 0 ? stats.confirmed : 0}</Badge>
                    </Card.Text>
                  </Card.Body>
                </Card>
              </Col>
              <Col xs={12} sm={6} md={4} xl={3}>
                <Card style={{ borderLeftColor: "#28a745", borderLeftWidth: "4px" }}>
                  <Card.Body>
                    <Card.Title>{language === "ar" ? "الطلبات المسلمة" : "Delivered Orders"}</Card.Title>
                    <Card.Text>
                      <Badge pill bg="success">{stats.delivered > 0 ? stats.delivered : 0}</Badge>
                    </Card.Text>
                  </Card.Body>
                </Card>
              </Col>
            </Row>

            {/* Revenue Card */}
            <Card className="mt-3">
              <Card.Header>
                <Row>
                  <Col xs={12} sm={6}>
                    {language === "ar" ? "إجمالي الإيرادات" : "Total Revenue"}
                  </Col>
                </Row>
              </Card.Header>
              <Card.Body>
                <Card.Text>
                  <h3>{stats.totalRevenue > 0 ? stats.totalRevenue.toLocaleString() : "0"} DA</h3>
                </Card.Text>
              </Card.Body>
            </Card>

            {/* Recent Orders Table */}
            <Card className="mt-3">
              <Card.Header>
                <Row>
                  <Col xs={12}>{language === "ar" ? "الطلبات الأخيرة" : "Recent Orders"}</Col>
                </Row>
              </Card.Header>
              <Card.Body>
                {stats.recentOrders && stats.recentOrders.length > 0 ? (
                  <Table striped bordered hover>
                    <thead>
                      <tr>
                        <th>{language === "ar" ? "رقم الطلب" : "Order #"}</th>
                        <th>{language === "ar" ? "العميل" : "Customer"}</th>
                        <th>{language === "ar" ? "المجموع" : "Total"}</th>
                        <th>{language === "ar" ? "الحالة" : "Status"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.recentOrders.slice(0, 5).map((order: any, index: number) => (
                        <tr key={index}>
                          <td>{order.orderNumber}</td>
                          <td>{order.customerInfo?.firstName || "-"}</td>
                          <td>{order.total} DA</td>
                          <td>
                            <Badge pill bg={getStatusVariant(order.status)}>
                              {getStatusText(order.status, language)}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                ) : (
                  <p>{language === "ar" ? "لا توجد طلبات" : "No orders"}</p>
                )}
              </Card.Body>
            </Card>

            {/* Top Products */}
            <Card className="mt-3">
              <Card.Header>
                <Row>
                  <Col xs={12}>{language === "ar" ? "المنتجات الأكثر مبيعاً" : "Top Selling Products"}</Col>
                </Row>
              </Card.Header>
              <Card.Body>
                {stats.topProducts && stats.topProducts.length > 0 ? (
                  <Table striped bordered hover>
                    <thead>
                      <tr>
                        <th>{language === "ar" ? "اسم المنتج" : "Product Name"}</th>
                        <th>{language === "ar" ? "الكمية المباعة" : "Quantity Sold"}</th>
                        <th>{language === "ar" ? "الإيرادات" : "Revenue"}</th>
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
                                  {language === "ar" ? "حزمة" : "Pack"}
                                </Badge>
                              )}
                            </td>
                            <td>{product.totalSold}</td>
                            <td>{product.revenue?.toLocaleString() || "0"} DA</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </Table>
                ) : (
                  <p>{language === "ar" ? "لا توجد بيانات" : "No data"}</p>
                )}
              </Card.Body>
            </Card>

            {/* Top Wilayas */}
            <Card className="mt-3">
              <Card.Header>
                <Row>
                  <Col xs={12}>{language === "ar" ? "أعلى الولايات" : "Top Wilayas"}</Col>
                </Row>
              </Card.Header>
              <Card.Body>
                {stats.topWilayas && stats.topWilayas.length > 0 ? (
                  <Table striped bordered hover>
                    <thead>
                      <tr>
                        <th>{language === "ar" ? "الولاية" : "Wilaya"}</th>
                        <th>{language === "ar" ? "عدد الطلبات" : "Order Count"}</th>
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
                ) : (
                  <p>{language === "ar" ? "لا توجد بيانات" : "No data"}</p>
                )}
              </Card.Body>
            </Card>
          </Container>
        )}
      </Container>
    </>
  );
};

// Helper functions
const getStatusVariant = (status: string): "primary" | "secondary" | "success" | "danger" | "warning" | "info" => {
  const map: any = {
    new: "secondary",
    pending_payment: "warning",
    confirmed: "info",
    processing: "primary",
    shipped: "primary",
    delivered: "success",
    cancelled: "danger",
    rejected: "danger",
  };
  return map[status] || "secondary";
};

const getStatusText = (status: string, language: string) => {
  const arMap: any = {
    new: "جديد",
    pending_payment: "في انتظار الدفع",
    confirmed: "مؤكد",
    processing: "قيد المعالجة",
    shipped: "تم الشحن",
    delivered: "تم التسليم",
    cancelled: "ملغي",
    rejected: "مرفوض",
  };
  const frMap: any = {
    new: "Nouvelle",
    pending_payment: "En attente de paiement",
    confirmed: "Confirmée",
    processing: "En cours",
    shipped: "Expédiée",
    delivered: "Livrée",
    cancelled: "Annulée",
    rejected: "Rejetée",
  };

  return language === "ar" ? (arMap[status] || status) : (frMap[status] || status);
};

export default AdminDashboardPage;