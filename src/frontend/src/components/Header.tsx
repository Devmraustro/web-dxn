import React, { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { useSiteSettings } from "../context/SiteSettingsContext";
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

/** Social icon links — rendered only when the owner has configured a real URL. */
const FacebookIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5 3.7 9.16 8.44 9.94v-7.03H7.9v-2.9h2.54V9.85c0-2.53 1.5-3.92 3.78-3.92 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.57v1.88h2.78l-.44 2.9h-2.34V22c4.74-.79 8.43-4.95 8.43-9.94Z" />
  </svg>
);

const InstagramIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.5" cy="6.5" r="1.1" fill="currentColor" stroke="none" />
  </svg>
);

const WhatsAppIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M20.52 3.48A11.86 11.86 0 0 0 12.06 0C5.5 0 .16 5.34.16 11.9c0 2.1.55 4.15 1.6 5.95L0 24l6.33-1.66a11.9 11.9 0 0 0 5.73 1.46h.01c6.55 0 11.9-5.34 11.9-11.9 0-3.18-1.24-6.17-3.45-8.42ZM12.07 21.8h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.75.98 1-3.66-.24-.37a9.86 9.86 0 0 1-1.52-5.26c0-5.45 4.44-9.89 9.9-9.89 2.64 0 5.13 1.03 7 2.9a9.83 9.83 0 0 1 2.9 7c0 5.46-4.44 9.89-9.89 9.89Zm5.43-7.41c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.65.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.64-2.05-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.21-.24-.58-.48-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.42.25-.7.25-1.3.17-1.42-.07-.12-.27-.2-.57-.35Z" />
  </svg>
);

const isSafeExternalUrl = (url: string): boolean =>
  typeof url === "string" && /^https?:\/\//i.test(url);

const SocialIcons: React.FC = () => {
  const { settings } = useSiteSettings();
  const { language } = useLanguage();

  const items = [
    {
      key: "facebook",
      href: settings.socialLinks.facebook,
      label: language === "ar" ? "صفحة فيسبوك" : "Page Facebook",
      Icon: FacebookIcon,
    },
    {
      key: "instagram",
      href: settings.socialLinks.instagram,
      label: language === "ar" ? "حساب إنستغرام" : "Compte Instagram",
      Icon: InstagramIcon,
    },
    {
      key: "whatsapp",
      href: settings.whatsappUrl,
      label: language === "ar" ? "واتساب DXN NADZ" : "WhatsApp DXN NADZ",
      Icon: WhatsAppIcon,
    },
  ].filter((item) => isSafeExternalUrl(item.href));

  if (items.length === 0) return null;

  return (
    <div className="dxn-header-socials" aria-label={language === "ar" ? "روابط التواصل الاجتماعي" : "Liens sociaux"}>
      {items.map(({ key, href, label, Icon }) => (
        <a
          key={key}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="dxn-social-icon"
          aria-label={label}
          title={label}
        >
          <Icon />
        </a>
      ))}
    </div>
  );
};

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
  const { items } = useCart();
  const { settings } = useSiteSettings();
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
    { to: "/about", label: t("من هي DXN؟", "Qui est DXN ?") },
    { to: "/education", label: t("مركز المعرفة", "Éducation") },
    { to: "/faq", label: t("الأسئلة الشائعة", "FAQ") },
    { to: "/contact", label: t("تواصل معنا", "Contact") },
    { to: "/join", label: t("انضم إلى فريقنا", "Rejoindre l'équipe"), highlight: true },
    { to: "/cart", label: t("السلة", "Panier"), badge: cartCount },
    // NOTE: the admin dashboard is intentionally NOT advertised in public
    // navigation — owners reach /admin directly by URL (auth still enforced).
  ];

  return (
    <>
      <div className="dxn-topbar">
        <div className="dxn-topbar-inner">
          <span className="dxn-topbar-item">
            <PinIcon />
            {t(
              "توصيل عبر ولايات الجزائر (69 ولاية — حسب تغطية شركة التوصيل)",
              "Livraison en Algérie (69 wilayas — selon couverture du transporteur)"
            )}
          </span>
          <span className="dxn-topbar-item dxn-topbar-gold">
            {t("الدفع عند الاستلام متاح — الشراء متاح للجميع بدون اشتراط عضوية", "Paiement à la livraison — Achat ouvert sans adhésion")}
          </span>
        </div>
      </div>

      <header className="dxn-header">
        <nav className="dxn-nav" aria-label="Main navigation">
          <Link to="/" className="dxn-brand" onClick={() => setMenuOpen(false)}>
            <span className="dxn-brand-badge">DXN</span>
            <span>
              <span className="dxn-brand-name d-block">{settings.brandName || "DXN NADZ"}</span>
              <span className="dxn-brand-sub">
                {t("منتجات متنوعة • معرفة موثوقة", "Produits • Savoir • Équipe")}
              </span>
            </span>
          </Link>

          <ul className="dxn-nav-links" role="menubar">
            {navItems.map((item: any) => (
              <li role="menuitem" key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    item.highlight
                      ? `dxn-link dxn-nav-cta-pill${isActive ? " active" : ""}`
                      : linkClass({ isActive })
                  }
                  onClick={() => setMenuOpen(false)}
                >
                  {item.to === "/cart" && <CartIcon size={16} />}
                  <span>{item.label}</span>
                  {typeof item.badge === "number" && item.badge > 0 && (
                    <span
                      className="dxn-nav-badge dxn-nav-badge-glow"
                      aria-label={`${item.badge} ${t("عناصر", "articles")}`}
                    >
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>

          <div className="dxn-header-actions">
            <LanguageSelector />
            <SocialIcons />
            {isAdmin && (
              <button type="button" className="dxn-logout-btn" onClick={handleLogout}>
                {t("تسجيل الخروج", "Déconnexion")}
              </button>
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
          <NavLink to="/founder" className={linkClass} onClick={() => setMenuOpen(false)}>
            <span>{t("تعرّف على مؤسس DXN", "Fondateur de DXN")}</span>
          </NavLink>
          <NavLink to="/why-dxn" className={linkClass} onClick={() => setMenuOpen(false)}>
            <span>{t("لماذا يختار الكثيرون DXN؟", "Pourquoi choisir DXN ?")}</span>
          </NavLink>
          {isAdmin && (
            <div className="dxn-mobile-menu-row">
              <button type="button" className="dxn-logout-btn" onClick={handleLogout}>
                {t("تسجيل الخروج", "Déconnexion")}
              </button>
            </div>
          )}
        </div>
      </header>
    </>
  );
};

export default Header;
