import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";
import { useAuth } from "../context/AuthContext";
import { Container, Row, Col, Card, Form, Button, Alert, Spinner } from "react-bootstrap";

const AdminLoginPage = () => {
  const { language } = useLanguage();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const t = (ar: string, fr: string) => (language === "ar" ? ar : fr);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { role } = await login(email, password);
      // Only users with admin/owner elevation may access the admin area.
      if (role === "owner" || role === "admin") {
        navigate("/admin");
      } else {
        setError(t("ليس لديك صلاحيات أدمن", "Vous n'avez pas les droits d'administrateur"));
      }
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          t("بيانات الدخول غير صحيحة", "Identifiants incorrects")
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Container className="mt-5" style={{ maxWidth: 480 }}>
        <Card>
          <Card.Header className="text-center">
            <h1 className="h4 mb-0">{t("دخول الأدمن", "Connexion Admin")}</h1>
          </Card.Header>
          <Card.Body>
            {error && <Alert variant="danger">{error}</Alert>}
            <Form onSubmit={handleSubmit}>
              <Form.Group className="mb-3">
                <Form.Label>{t("البريد الإلكتروني", "Email")}</Form.Label>
                <Form.Control
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="username"
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>{t("كلمة المرور", "Mot de passe")}</Form.Label>
                <Form.Control
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </Form.Group>
              <Button type="submit" variant="primary" disabled={loading} className="w-100">
                {loading ? <Spinner size="sm" animation="border" /> : t("تسجيل الدخول", "Se connecter")}
              </Button>
            </Form>
          </Card.Body>
        </Card>
      </Container>
    </>
  );
};

export default AdminLoginPage;