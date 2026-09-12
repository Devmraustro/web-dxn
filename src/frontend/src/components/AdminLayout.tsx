import React from "react";
import { NavLink, useNavigate, Navigate } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";
import { useAuth } from "../context/AuthContext";

const ShieldIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const AdminLayout = ({ children }: { children: React.ReactNode }) => {
  const { language } = useLanguage();
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();
  const isAdmin = isAuthenticated && (user?.role === "owner" || user?.role === "admin");

  const t = (ar: string, fr: string) => (language === "ar" ? ar : fr);

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }
  if (!isAdmin) {
    return (
      <div className="container mt-5" style={{ maxWidth: 480 }}>
        <div className="dxn-feedback-error p-3">
          {t("ليس لديك صلاحيات أدمن", "Vous n'avez pas les droits d'administrateur")}
        </div>
      </div>
    );
  }

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-title">
          <ShieldIcon />
          {t("لوحة التحكم", "Administration")}
        </div>
        <nav className="admin-sidebar-nav" aria-label="Admin navigation">
          <NavLink
            to="/admin"
            end
            className={({ isActive }) => (isActive ? "admin-link active" : "admin-link")}
          >
            {t("لوحة التحكم", "Tableau de bord")}
          </NavLink>
          <NavLink
            to="/admin/products"
            className={({ isActive }) => (isActive ? "admin-link active" : "admin-link")}
          >
            {t("المنتجات", "Produits")}
          </NavLink>
          <NavLink
            to="/admin/orders"
            className={({ isActive }) => (isActive ? "admin-link active" : "admin-link")}
          >
            {t("الطلبات", "Commandes")}
          </NavLink>
          <NavLink
            to="/admin/reviews"
            className={({ isActive }) => (isActive ? "admin-link active" : "admin-link")}
          >
            {t("التقييمات", "Avis")}
          </NavLink>
          <NavLink to="/" className="admin-link">
            {t("العودة للمتجر", "Voir la boutique")}
          </NavLink>
        </nav>
        <button type="button" className="admin-logout" onClick={handleLogout}>
          {t("تسجيل الخروج", "Déconnexion")}
        </button>
      </aside>
      <main className="admin-content">{children}</main>
    </div>
  );
};

export default AdminLayout;