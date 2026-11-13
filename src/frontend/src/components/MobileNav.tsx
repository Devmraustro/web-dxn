import React, { useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";
import { useCart } from "../context/CartContext";

const HomeIcon = () => (
  <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);

const PackageIcon = () => (
  <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="16.5" y1="9.4" x2="7.5" y2="4.21" />
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
    <line x1="12" y1="22.08" x2="12" y2="12" />
  </svg>
);

const BookIcon = () => (
  <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
  </svg>
);

const TeamIcon = () => (
  <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const CartIcon = () => (
  <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="9" cy="21" r="1" />
    <circle cx="20" cy="21" r="1" />
    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
  </svg>
);

const MobileNav = () => {
  const { language } = useLanguage();
  const { items } = useCart();
  const location = useLocation();

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
    { to: "/education", label: t("المعرفة", "Savoir"), icon: BookIcon },
    { to: "/join", label: t("انضم للفريق", "Équipe"), icon: TeamIcon },
    { to: "/cart", label: t("السلة", "Panier"), icon: CartIcon, badge: cartCount },
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
              <span className="mobile-nav-icon-wrap">
                <Icon />
                {typeof item.badge === "number" && item.badge > 0 && (
                  <span className="mobile-nav-badge">{item.badge}</span>
                )}
              </span>
              <span className="mobile-nav-label">{item.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileNav;
