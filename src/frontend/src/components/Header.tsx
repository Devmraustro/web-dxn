import React, { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import LanguageSelector from "./LanguageSelector";

const CartIcon = ({ size = 18 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="9" cy="21" r="1" />
    <circle cx="20" cy="21" r="1" />
    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
  </svg>
);

const PinIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

const MenuIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </svg>
);

const CloseIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const Header = () => {
  const { language } = useLanguage();
  const { isAuthenticated, user, logout } = useAuth();
  const { items, total } = useCart();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const isAdmin = isAuthenticated && (user?.role === "owner" || user?.role === "admin");

  const t = (ar: string, fr: string) => (language === "ar" ? ar : fr);

  const cartCount = items.reduce((sum, i) => sum + (Number(i.quantity) || 0), 0);

  const handleLogout = () => {
    logout();
    setMenuOpen(false);
    navigate("/");
  };

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    isActive ? "dxn-link active" : "dxn-link";

  const navItems = [
    { to: "/", label: t("الرئيسية", "Accueil"), end: true },
    { to: "/products", label: t("المنتجات", "Produits") },
    { to: "/cart", label: t("السلة", "Panier"), badge: cartCount },
    { to: "/checkout", label: t("إتمام الطلب", "Commande") },
    ...(isAdmin ? [{ to: "/admin", label: t("لوحة التحكم", "Admin") }] : []),
  ];

  return (
    <>
      {/* Announcement bar */}
      <div className="dxn-topbar">
        <div className="dxn-topbar-inner">
          <span className="dxn-topbar-item">
            <PinIcon />
            {t("توصيل إلى جميع ولايات الجزائر (58 ولاية)", "Livraison vers les 58 wilayas d'Algérie")}
          </span>
          <span className="dxn-topbar-item dxn-topbar-gold">
            {t("الدفع عند الاستلام متاح", "Paiement à la livraison disponible")}
          </span>
        </div>
      </div>

      <header className="dxn-header">
        <nav className="dxn-nav" aria-label="Main navigation">
          {/* Brand */}
          <Link to="/" className="dxn-brand" onClick={() => setMenuOpen(false)}>
            <span className="dxn-brand-badge">DXN</span>
            <span>
              <span className="dxn-brand-name d-block">DXN Store</span>
              <span className="dxn-brand-sub">{t("صحتك أولاً", "Votre santé d'abord")}</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <ul className="dxn-nav-links" role="menubar">
            {navItems.map((item: any) => (
              <li role="menuitem" key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={linkClass}
                  onClick={() => setMenuOpen(false)}
                >
                  {item.to === "/cart" && <CartIcon size={16} />}
                  <span>{item.label}</span>
                  {typeof item.badge === "number" && item.badge > 0 && (
                    <span className="dxn-nav-badge dxn-nav-badge-glow" aria-label={`${item.badge} ${t("عناصر", "articles")}`}>
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>

          {/* Actions */}
          <div className="dxn-header-actions">
            <LanguageSelector />
            {isAdmin ? (
              <button type="button" className="dxn-logout-btn" onClick={handleLogout}>
                {t("تسجيل الخروج", "Déconnexion")}
              </button>
            ) : (
              <Link to="/admin/login" className="dxn-login-btn">
                {t("دخول الأدمن", "Admin")}
              </Link>
            )}
            <button
              type="button"
              className="dxn-hamburger"
              aria-expanded={menuOpen}
              aria-label={menuOpen ? t("إغلاق القائمة", "Fermer le menu") : t("فتح القائمة", "Ouvrir le menu")}
              onClick={() => setMenuOpen((v) => !v)}
            >
              {menuOpen ? <CloseIcon /> : <MenuIcon />}
            </button>
          </div>
        </nav>

        {/* Mobile menu */}
        <div className={menuOpen ? "dxn-mobile-menu open dxn-anim-fade-in" : "dxn-mobile-menu"}>
          {navItems.map((item: any) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={linkClass}
              onClick={() => setMenuOpen(false)}
            >
              <span>{item.label}</span>
              {typeof item.badge === "number" && item.badge > 0 && (
                <span className="dxn-nav-badge">{item.badge}</span>
              )}
            </NavLink>
          ))}
          <div className="dxn-mobile-menu-row">
            {isAdmin ? (
              <button type="button" className="dxn-logout-btn" onClick={handleLogout}>
                {t("تسجيل الخروج", "Déconnexion")}
              </button>
            ) : (
              <Link to="/admin/login" className="dxn-login-btn" onClick={() => setMenuOpen(false)}>
                {t("دخول الأدمن", "Admin")}
              </Link>
            )}
          </div>
        </div>

        {/* Cart summary bar */}
        {items.length > 0 && (
          <div className="dxn-cartbar dxn-anim-fade-in" aria-live="polite">
            <div className="dxn-cartbar-inner">
              <span>
                <CartIcon size={15} /> {t("المجموع", "Total")}:
              </span>
              <span className="dxn-cartbar-total">
                {total.toLocaleString("fr-DZ")} DA
              </span>
            </div>
          </div>
        )}
      </header>
    </>
  );
};

export default Header;