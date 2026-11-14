import React from "react";
import { useLocation } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";
import { useSiteSettings } from "../context/SiteSettingsContext";

/**
 * Phase 11 — Configurable Floating WhatsApp Button.
 * Rendered ONLY on public pages AND only when the owner has configured a real
 * WhatsApp number/URL (never a broken or fabricated number).
 */
const FloatingWhatsApp: React.FC = () => {
  const { settings } = useSiteSettings();
  const { language } = useLanguage();
  const location = useLocation();

  if (location.pathname.startsWith("/admin")) return null;
  if (!settings.whatsappUrl) return null;

  const greeting =
    language === "ar"
      ? "السلام عليكم فريق DXN للحياة الطبيعية، لدي استفسار بخصوص المنتجات أو العضوية."
      : "Bonjour l'équipe DXN Natural Life, j'ai une question concernant vos produits ou l'adhésion.";

  const sep = settings.whatsappUrl.includes("?") ? "&" : "?";
  const href = `${settings.whatsappUrl}${sep}text=${encodeURIComponent(greeting)}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="dxn-floating-whatsapp"
      aria-label={language === "ar" ? "تواصل عبر واتساب مع فريق DXN للحياة الطبيعية" : "Contacter DXN Natural Life sur WhatsApp"}
      title={language === "ar" ? "تواصل عبر واتساب" : "WhatsApp DXN Natural Life"}
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M20.52 3.48A11.86 11.86 0 0 0 12.06 0C5.5 0 .16 5.34.16 11.9c0 2.1.55 4.15 1.6 5.95L0 24l6.33-1.66a11.9 11.9 0 0 0 5.73 1.46h.01c6.55 0 11.9-5.34 11.9-11.9 0-3.18-1.24-6.17-3.45-8.42ZM12.07 21.8h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.75.98 1-3.66-.24-.37a9.86 9.86 0 0 1-1.52-5.26c0-5.45 4.44-9.89 9.9-9.89 2.64 0 5.13 1.03 7 2.9a9.83 9.83 0 0 1 2.9 7c0 5.46-4.44 9.89-9.89 9.89Zm5.43-7.41c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.65.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.64-2.05-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.21-.24-.58-.48-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.42.25-.7.25-1.3.17-1.42-.07-.12-.27-.2-.57-.35Z" />
      </svg>
      <span className="dxn-floating-whatsapp-label">
        {language === "ar" ? "واتساب" : "WhatsApp"}
      </span>
    </a>
  );
};

export default FloatingWhatsApp;
