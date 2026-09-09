import React from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";

const Header = () => {
  const { language, changeLanguage } = useLanguage();
  const { isAuthenticated, user, logout } = useAuth();
  const { items, total } = useCart();
  const navigate = useNavigate();
  const isAdmin = isAuthenticated && (user?.role === "owner" || user?.role === "admin");

  const t = (ar: string, fr: string) => (language === "ar" ? ar : fr);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <header className="dxn-header">
      <nav className="dxn-nav" aria-label="Main navigation">
        <div className="dxn-brand">
          <Link to="/" className="dxn-brand-link">
            <span className="dxn-brand-title">DXN</span>
            <span className="dxn-brand-sub">Store</span>
          </Link>
        </div>

        <ul className="dxn-nav-links" role="menubar">
          <li role="menuitem">
            <NavLink
              to="/"
              className={({ isActive }) => (isActive ? "dxn-link active" : "dxn-link")}
              end
            >
              {t("الرئيسية", "Accueil")}
            </NavLink>
          </li>
          <li role="menuitem">
            <NavLink
              to="/products"
              className={({ isActive }) => (isActive ? "dxn-link active" : "dxn-link")}
            >
              {t("المنتجات", "Produits")}
            </NavLink>
          </li>
          <li role="menuitem">
            <NavLink
              to="/cart"
              className={({ isActive }) => (isActive ? "dxn-link active" : "dxn-link")}
            >
              {t("السلة", "Panier")}
              {items.length > 0 && <span className="dxn-cart-count" aria-label={`${items.length} items`}>{items.length}</span>}
            </NavLink>
          </li>
          <li role="menuitem">
            <NavLink
              to="/checkout"
              className={({ isActive }) => (isActive ? "dxn-link active" : "dxn-link")}
            >
              {t("إتمام الطلب", "Commande")}
            </NavLink>
          </li>
          {isAdmin && (
            <li role="menuitem">
              <NavLink
                to="/admin"
                className={({ isActive }) => (isActive ? "dxn-link active" : "dxn-link")}
              >
                {t("لوحة التحكم", "Admin")}
              </NavLink>
            </li>
          )}
        </ul>

        <div className="dxn-header-actions">
          <div className="language-selector" role="group" aria-label="Language selector">
            <button
              type="button"
              onClick={() => changeLanguage("ar")}
              className={language === "ar" ? "selected" : ""}
              aria-pressed={language === "ar"}
              aria-label="العربية"
            >
              AR
            </button>
            <button
              type="button"
              onClick={() => changeLanguage("fr")}
              className={language === "fr" ? "selected" : ""}
              aria-pressed={language === "fr"}
              aria-label="Français"
            >
              FR
            </button>
          </div>

          {isAdmin ? (
            <button type="button" className="dxn-logout" onClick={handleLogout}>
              {t("تسجيل الخروج", "Déconnexion")}
            </button>
          ) : (
            <Link to="/admin/login" className="dxn-login-link">
              {t("دخول الأدمن", "Admin")}
            </Link>
          )}
        </div>
      </nav>

      <div className="dxn-cart-total" aria-live="polite">
        {t("المجموع", "Total")}: {total} DA
      </div>
    </header>
  );
};

export default Header;