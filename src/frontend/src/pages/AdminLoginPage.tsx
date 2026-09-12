import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";
import { useAuth } from "../context/AuthContext";
import { Container, Form, Button } from "react-bootstrap";

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
    <Container className="mt-5 mb-5" style={{ maxWidth: 460 }}>
      <div className="dxn-form-card dxn-anim-fade-up">
        <div
          className="text-center text-white"
          style={{
            background: "linear-gradient(135deg, #0a3a1e 0%, #14532d 100%)",
            padding: "1.6rem 1rem",
          }}
        >
          <div
            className="d-inline-flex align-items-center justify-content-center mb-2"
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: "rgba(255,255,255,0.14)",
              color: "#d4a017",
            }}
            aria-hidden="true"
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <h1 className="h4 mb-0 fw-bold">{t("دخول الأدمن", "Connexion Admin")}</h1>
        </div>

        <div className="dxn-form-card-body">
          {error && <div className="dxn-feedback-error p-3 mb-3" role="alert">{error}</div>}
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
            <Form.Group className="mb-4">
              <Form.Label>{t("كلمة المرور", "Mot de passe")}</Form.Label>
              <Form.Control
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </Form.Group>
            <Button type="submit" className="dxn-btn dxn-btn-primary w-100" disabled={loading}>
              {loading ? (
                <>
                  <span className="dxn-btn-spinner" aria-hidden="true"></span>
                  {t("جارٍ الدخول...", "Connexion...")}
                </>
              ) : (
                t("تسجيل الدخول", "Se connecter")
              )}
            </Button>
          </Form>
          <div className="text-center mt-3">
            <Link to="/" className="small text-decoration-none" style={{ color: "#1a5d3a" }}>
              {t("العودة للمتجر", "Retour à la boutique")}
            </Link>
          </div>
        </div>
      </div>
    </Container>
  );
};

export default AdminLoginPage;