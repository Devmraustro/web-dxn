import React from "react";
import { NavLink, useNavigate, Navigate } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";
import { useAuth } from "../context/AuthContext";
import SeoHead from "./SeoHead";

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
        <SeoHead title="Admin Restricted" canonicalPath="/admin" noindex />
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

  const linkCls = ({ isActive }: { isActive: boolean }) =>
    isActive ? "admin-link active" : "admin-link";

  return (
    <div className="admin-shell">
      <SeoHead title="DXN للحياة الطبيعية — لوحة التحكم" canonicalPath="/admin" noindex />
      <aside className="admin-sidebar">
        <div className="admin-sidebar-title">
          <ShieldIcon />
          <span>DXN Natural Life Admin</span>
        </div>
        <nav className="admin-sidebar-nav" aria-label="Admin navigation">
          <NavLink to="/admin" end className={linkCls}>
            {t("نظرة عامة وتحليلات", "Tableau de bord")}
          </NavLink>
          <NavLink to="/admin/products" className={linkCls}>
            {t("المنتجات والتصنيفات", "Produits & Catégories")}
          </NavLink>
          <NavLink to="/admin/orders" className={linkCls}>
            {t("إدارة الطلبات", "Commandes")}
          </NavLink>
          <NavLink to="/admin/leads" className={linkCls}>
            {t("طلبات الانضمام (CRM)", "CRM Adhésions")}
          </NavLink>
          <NavLink to="/admin/messages" className={linkCls}>
            {t("رسائل التواصل", "Messages contact")}
          </NavLink>
          <NavLink to="/admin/content" className={linkCls}>
            {t("إدارة المحتوى والتثقيف", "Contenu & Éducation")}
          </NavLink>
          <NavLink to="/admin/reviews" className={linkCls}>
            {t("تقييمات العملاء", "Avis clients")}
          </NavLink>
          <NavLink to="/admin/settings" className={linkCls}>
            {t("الإعدادات والربط", "Paramètres & Liens")}
          </NavLink>
          <hr className="border-light opacity-25 my-2" />
          <NavLink to="/" className="admin-link">
            {t("معاينة المنصة العامة ↗", "Voir le site public ↗")}
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
