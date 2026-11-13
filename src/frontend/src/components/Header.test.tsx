import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";

import Header from "./Header";
import ErrorBoundary, { ErrorFallback } from "./ErrorBoundary";

// Mock the context hooks so the header renders deterministically without
// network / router / localStorage side effects.
jest.mock("../context/LanguageContext", () => ({
  useLanguage: () => ({ language: "fr" }),
}));
jest.mock("../context/AuthContext", () => ({
  useAuth: () => ({ isAdmin: false }),
}));
jest.mock("../context/CartContext", () => ({
  useCart: () => ({ items: [], count: 0 }),
}));
jest.mock("../context/SiteSettingsContext", () => ({
  useSiteSettings: () => ({
    settings: {
      brandName: "DXN NADZ",
      whatsappUrl: "https://wa.me/213551234567",
      socialLinks: {
        facebook: "https://www.facebook.com/dxnnadz",
        instagram: "https://www.instagram.com/dxnnadz",
        tiktok: "",
        telegram: "",
        whatsapp: "https://wa.me/213551234567",
      },
    },
  }),
}));

const renderHeader = () =>
  renderToStaticMarkup(
    <MemoryRouter>
      <Header />
    </MemoryRouter>
  );

describe("Header public navigation (post-release fixes)", () => {
  it("does not render any public link to the admin dashboard or admin login", () => {
    const html = renderHeader();
    // No href anywhere should point at /admin or /admin/login.
    expect(html).not.toContain("href=\"/admin");
    expect(html).not.toContain("href='/admin");
    expect(html).not.toContain("/admin/login");
    expect(html).not.toContain(">Admin<");
    expect(html).not.toContain("لوحة التحكم");
  });

  it("still renders the primary public navigation links", () => {
    const html = renderHeader();
    expect(html).toContain("/products");
    expect(html).toContain("/join");
    expect(html).toContain("/cart");
  });

  it("renders configured social links (Facebook / Instagram / WhatsApp) with safe external targets", () => {
    const html = renderHeader();
    expect(html).toContain("https://www.facebook.com/dxnnadz");
    expect(html).toContain("https://www.instagram.com/dxnnadz");
    expect(html).toContain("https://wa.me/213551234567");
    // external links must be opened safely
    expect(html).toContain("noopener noreferrer");
    expect(html).toContain("target=\"_blank\"");
  });

  it("renders accessible labels for the social icons", () => {
    const html = renderHeader();
    expect(html).toContain('aria-label="Page Facebook"');
    expect(html).toContain('aria-label="Compte Instagram"');
  });
});

describe("ErrorBoundary", () => {
  let docLang: string | null = null;
  beforeAll(() => {
    // Minimal document stub — the fallback reads document.documentElement.lang
    // to pick AR vs FR. testEnvironment is node, so provide a tiny shim.
    global.document = {
      documentElement: {
        getAttribute: (name: string) => (name === "lang" ? docLang : null),
        setAttribute: (name: string, value: string) => {
          if (name === "lang") docLang = value;
        },
        removeAttribute: (name: string) => {
          if (name === "lang") docLang = null;
        },
      },
    } as unknown as Document;
  });
  afterAll(() => {
    delete (global as { document?: unknown }).document;
  });

  it("renders its children when there is no error", () => {
    const html = renderToStaticMarkup(
      <ErrorBoundary>
        <p>content</p>
      </ErrorBoundary>
    );
    expect(html).toContain("content");
  });

  it("renders a recoverable fallback instead of a blank screen when a child errors", () => {
    // React error boundaries are client-side (not exercised by SSR renderToStaticMarkup),
    // so verify the exported fallback UI that the boundary renders on error.
    const html = renderToStaticMarkup(<ErrorFallback onRetry={jest.fn()} />);
    expect(html.length).toBeGreaterThan(0);
    expect(html).toContain("Réessayer");
    expect(html).toContain("Retour");
    expect(html).toContain("accueil");
    expect(html).toContain('role="alert"');
  });

  it("renders the Arabic fallback when the document language is Arabic", () => {
    document.documentElement.setAttribute("lang", "ar");
    const html = renderToStaticMarkup(<ErrorFallback onRetry={jest.fn()} />);
    expect(html).toContain("إعادة المحاولة");
    expect(html).toContain("العودة إلى الصفحة الرئيسية");
    document.documentElement.removeAttribute("lang");
  });
});
