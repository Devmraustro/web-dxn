import React, { Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { LanguageProvider } from "./context/LanguageContext";
import { CartProvider } from "./context/CartContext";
import { AuthProvider } from "./context/AuthContext";
import { SiteSettingsProvider } from "./context/SiteSettingsContext";
import "bootstrap/dist/css/bootstrap.min.css";
import "./index.css";
import Header from "./components/Header";
import Footer from "./components/Footer";
import MobileNav from "./components/MobileNav";
import FloatingWhatsApp from "./components/FloatingWhatsApp";
import { ScrollToTop } from "./components/ScrollToTop";

// Route-level code splitting for fast initial load across Algerian mobile networks
const AdminLayout = lazy(() => import("./components/AdminLayout"));
const HomePage = lazy(() => import("./pages/HomePage"));
const AboutDxnPage = lazy(() => import("./pages/AboutDxnPage"));
const FounderPage = lazy(() => import("./pages/FounderPage"));
const WhyDxnPage = lazy(() => import("./pages/WhyDxnPage"));
const EducationCenterPage = lazy(() => import("./pages/EducationCenterPage"));
const ProductListPage = lazy(() => import("./pages/ProductListPage"));
const ProductDetailPage = lazy(() => import("./pages/ProductDetailPage"));
const JoinTeamPage = lazy(() => import("./pages/JoinTeamPage"));
const FaqTrustPage = lazy(() => import("./pages/FaqTrustPage"));
const ContactPage = lazy(() => import("./pages/ContactPage"));
const CartPage = lazy(() => import("./pages/CartPage"));
const CheckoutPage = lazy(() => import("./pages/CheckoutPage"));
const OrderConfirmationPage = lazy(() => import("./pages/OrderConfirmationPage"));
const PrivacyPolicyPage = lazy(() => import("./pages/PrivacyPolicyPage"));

const AdminLoginPage = lazy(() => import("./pages/AdminLoginPage"));
const AdminDashboardPage = lazy(() => import("./pages/AdminDashboardPage"));
const AdminProductsPage = lazy(() => import("./pages/AdminProductsPage"));
const AdminOrdersPage = lazy(() => import("./pages/AdminOrdersPage"));
const AdminLeadsPage = lazy(() => import("./pages/AdminLeadsPage"));
const AdminMessagesPage = lazy(() => import("./pages/AdminMessagesPage"));
const AdminContentPage = lazy(() => import("./pages/AdminContentPage"));
const AdminReviewPage = lazy(() => import("./pages/AdminReviewPage"));
const AdminSettingsPage = lazy(() => import("./pages/AdminSettingsPage"));

const PageSuspense = ({ children }: { children: React.ReactNode }) => (
  <Suspense
    fallback={
      <div className="dxn-loading" role="status">
        <div className="dxn-loading-ring"></div>
        <div>...</div>
      </div>
    }
  >
    {children}
  </Suspense>
);

const PublicFloatingCtas = () => {
  const location = useLocation();
  if (location.pathname.startsWith("/admin")) return null;
  return <FloatingWhatsApp />;
};

const App = () => (
  <HelmetProvider>
    <BrowserRouter>
      <SiteSettingsProvider>
        <ScrollToTop />
        <Header />
        <PageSuspense>
          <Routes>
            {/* Public Brand, Educational, Store & Recruitment Ecosystem */}
            <Route path="/" element={<HomePage />} />
            <Route path="/about" element={<AboutDxnPage />} />
            <Route path="/founder" element={<FounderPage />} />
            <Route path="/why-dxn" element={<WhyDxnPage />} />
            <Route path="/education" element={<EducationCenterPage />} />
            <Route path="/education/:slug" element={<EducationCenterPage />} />
            <Route path="/products" element={<ProductListPage />} />
            <Route path="/product/:slug" element={<ProductDetailPage />} />
            <Route path="/join" element={<JoinTeamPage />} />
            <Route path="/faq" element={<FaqTrustPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/order-confirmation/:orderNumber" element={<OrderConfirmationPage />} />
            <Route path="/privacy" element={<PrivacyPolicyPage />} />

            {/* Secure Admin Back-Office & CRM */}
            <Route path="/admin/login" element={<AdminLoginPage />} />
            <Route
              path="/admin"
              element={
                <AdminLayout>
                  <AdminDashboardPage />
                </AdminLayout>
              }
            />
            <Route
              path="/admin/products"
              element={
                <AdminLayout>
                  <AdminProductsPage />
                </AdminLayout>
              }
            />
            <Route
              path="/admin/orders"
              element={
                <AdminLayout>
                  <AdminOrdersPage />
                </AdminLayout>
              }
            />
            <Route
              path="/admin/leads"
              element={
                <AdminLayout>
                  <AdminLeadsPage />
                </AdminLayout>
              }
            />
            <Route
              path="/admin/messages"
              element={
                <AdminLayout>
                  <AdminMessagesPage />
                </AdminLayout>
              }
            />
            <Route
              path="/admin/content"
              element={
                <AdminLayout>
                  <AdminContentPage />
                </AdminLayout>
              }
            />
            <Route
              path="/admin/reviews"
              element={
                <AdminLayout>
                  <AdminReviewPage />
                </AdminLayout>
              }
            />
            <Route
              path="/admin/settings"
              element={
                <AdminLayout>
                  <AdminSettingsPage />
                </AdminLayout>
              }
            />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <Footer />
          <MobileNav />
        </PageSuspense>
        <PublicFloatingCtas />
      </SiteSettingsProvider>
    </BrowserRouter>
  </HelmetProvider>
);

const rootElement = document.getElementById("root");
if (rootElement) {
  createRoot(rootElement).render(
    <React.StrictMode>
      <LanguageProvider>
        <CartProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </CartProvider>
      </LanguageProvider>
    </React.StrictMode>
  );
}
