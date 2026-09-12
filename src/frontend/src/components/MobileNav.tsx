import React, { useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";

const HomeIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);

const PackageIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="16.5" y1="9.4" x2="7.5" y2="4.21" />
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
    <line x1="12" y1="22.08" x2="12" y2="12" />
  </svg>
);

const CartIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="9" cy="21" r="1" />
    <circle cx="20" cy="21" r="1" />
    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
  </svg>
);

const UserIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

/**
 * Fixed bottom navigation for storefront pages on small screens.
 * Hidden on checkout / confirmation / admin because those flows need focus and
 * full vertical space. Reserves extra body space (via .mobile-nav-active) only
 * while it is actually visible.
 */
const MobileNav = () => {
  const { language } = useLanguage();
  const { items } = useCart();
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();
  const isAdmin = isAuthenticated && (user?.role === "owner" || user?.role === "admin");

  const cartCount = items.reduce((sum, i) => sum + (Number(i.quantity) || 0), 0);

  const t = (ar: string, fr: string) => (language === "ar" ? ar : fr);

  const hiddenPaths = ["/checkout", "/order-confirmation", "/admin"];
  const isHidden = hiddenPaths.some((p) => location.pathname.startsWith(p));

  useEffect(() => {
    document.body.classList.toggle("mobile-nav-active", !isHidden);
    return () => {
      document.body.classList.remove("mobile-nav-active");
    };
  }, [isHidden]);

  if (isHidden) {
    return null;
  }

  const itemsNav = [
    { to: "/", label: t("الرئيسية", "Accueil"), icon: HomeIcon, end: true },
    { to: "/products", label: t("المنتجات", "Produits"), icon: PackageIcon },
    { to: "/cart", label: t("السلة", "Panier"), icon: CartIcon, badge: cartCount },
    { to: isAdmin ? "/admin" : "/admin/login", label: isAdmin ? t("الإدارة", "Admin") : t("دخول", "Login"), icon: UserIcon },
  ];

  return (
    <nav className="mobile-nav" aria-label={t("تنقل سريع", "Navigation rapide")}>
      <div className="mobile-nav-inner">
        {itemsNav.map((item: any) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => (isActive ? "mobile-nav-item active" : "mobile-nav-item")}
            >
              <span className="mobile-nav-icon">
                <Icon />
                {typeof item.badge === "number" && item.badge > 0 && (
                  <span className="mobile-nav-badge">{item.badge}</span>
                )}
              </span>
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileNav;