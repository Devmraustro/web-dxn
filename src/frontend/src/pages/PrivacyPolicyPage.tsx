import React, { useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";
import { useTranslation } from "react-i18next";

/**
 * Privacy Policy Page — Public, SEO-friendly, bilingual (AR/FR).
 * Matches the existing visual identity (green/gold/white, premium, responsive).
 * No authentication required.
 */
const PrivacyPolicyPage = () => {
  const { language, dir } = useLanguage();
  const { t } = useTranslation();

  // SEO: set document title and meta tags
  useEffect(() => {
    document.title = `${t("privacyPolicyTitle")} | DXN Store`;
  }, [language, t]);

  const currentYear = new Date().getFullYear();
  const lastUpdated = "2025-01-15"; // This should be updated when policy changes

  return (
    <>
      <Helmet>
        <title>{t("privacyPolicyTitle")} | DXN Store</title>
        <meta name="description" content={t("privacyPolicySubtitle")} />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href={`${window.location.origin}/privacy`} />
        <meta property="og:title" content={`${t("privacyPolicyTitle")} | DXN Store`} />
        <meta property="og:description" content={t("privacyPolicySubtitle")} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={`${window.location.origin}/privacy`} />
        <meta property="og:locale" content={language === "ar" ? "ar_DZ" : "fr_DZ"} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={`${t("privacyPolicyTitle")} | DXN Store`} />
        <meta name="twitter:description" content={t("privacyPolicySubtitle")} />
      </Helmet>

      <div className="dxn-privacy-page" dir={dir} lang={language}>
        <section className="dxn-privacy-hero">
          <div className="container">
            <div className="dxn-privacy-hero-content dxn-anim-fade-up">
              <span className="dxn-chip dxn-chip-gold">{t("privacyPolicy")}</span>
              <h1 className="dxn-privacy-title">{t("privacyPolicyTitle")}</h1>
              <p className="dxn-privacy-subtitle">{t("privacyPolicySubtitle")}</p>
              <p className="dxn-privacy-meta">
                <time dateTime={lastUpdated}>{t("privacyLastUpdated")}: {lastUpdated}</time>
              </p>
            </div>
          </div>
        </section>

        <main className="dxn-privacy-main">
          <div className="container">
            <div className="row">
              {/* Table of Contents (Sidebar) */}
              <aside className="col-lg-3 dxn-privacy-sidebar" aria-label={t("privacyPolicy")}>
                <nav className="dxn-privacy-toc dxn-anim-fade-up dxn-stagger-1">
                  <h2 className="dxn-toc-title">{t("privacyPolicyTitle")}</h2>
                  <ul className="dxn-toc-list">
                    <li><a href="#intro">{t("privacyIntro").split(" ")[0]}</a></li>
                    <li><a href="#data-collected">{t("privacyDataCollected")}</a></li>
                    <li><a href="#data-usage">{t("privacyDataUsage")}</a></li>
                    <li><a href="#payment-data">{t("privacyPaymentData")}</a></li>
                    <li><a href="#cookies">{t("privacyCookies")}</a></li>
                    <li><a href="#data-sharing">{t("privacyDataSharing")}</a></li>
                    <li><a href="#security">{t("privacySecurity")}</a></li>
                    <li><a href="#retention">{t("privacyRetention")}</a></li>
                    <li><a href="#rights">{t("privacyRights")}</a></li>
                    <li><a href="#contact">{t("privacyContact")}</a></li>
                    <li><a href="#updates">{t("privacyUpdates")}</a></li>
                  </ul>
                </nav>
              </aside>

              {/* Main Content */}
              <article className="col-lg-9 dxn-privacy-content">
                {/* Introduction */}
                <section id="intro" className="dxn-privacy-section dxn-anim-fade-up dxn-stagger-2">
                  <p className="dxn-privacy-intro">{t("privacyIntro")}</p>
                </section>

                {/* Data Collected */}
                <section id="data-collected" className="dxn-privacy-section dxn-anim-fade-up dxn-stagger-3">
                  <h2 className="dxn-privacy-section-title">{t("privacyDataCollected")}</h2>

                  <h3 className="dxn-privacy-subsection-title">{t("privacyPersonalData")}</h3>
                  <p>{t("privacyPersonalDataDesc")}</p>
                  <ul className="dxn-privacy-list">
                    <li>{t("privacyFirstName")}</li>
                    <li>{t("privacyLastName")}</li>
                    <li>{t("privacyPhone")}</li>
                    <li>{t("privacySecondPhone")}</li>
                    <li>{t("privacyWilaya")}</li>
                    <li>{t("privacyCommune")}</li>
                    <li>{t("privacyAddress")}</li>
                  </ul>

                  <h3 className="dxn-privacy-subsection-title">{t("privacyOrderData")}</h3>
                  <p>{t("privacyOrderDataDesc")}</p>

                  <h3 className="dxn-privacy-subsection-title">{t("privacyMessengerData")}</h3>
                  <p>{t("privacyMessengerDataDesc")}</p>
                </section>

                {/* Data Usage */}
                <section id="data-usage" className="dxn-privacy-section dxn-anim-fade-up dxn-stagger-4">
                  <h2 className="dxn-privacy-section-title">{t("privacyDataUsage")}</h2>
                  <ul className="dxn-privacy-list dxn-privacy-usage-list">
                    <li>
                      <span className="dxn-usage-icon">✓</span>
                      <span>{t("privacyUsageOrder")}</span>
                    </li>
                    <li>
                      <span className="dxn-usage-icon">✓</span>
                      <span>{t("privacyUsageContact")}</span>
                    </li>
                    <li>
                      <span className="dxn-usage-icon">✓</span>
                      <span>{t("privacyUsageSupport")}</span>
                    </li>
                    <li>
                      <span className="dxn-usage-icon">✓</span>
                      <span>{t("privacyUsageImprovement")}</span>
                    </li>
                  </ul>
                </section>

                {/* Payment Data */}
                <section id="payment-data" className="dxn-privacy-section dxn-anim-fade-up dxn-stagger-5">
                  <h2 className="dxn-privacy-section-title">{t("privacyPaymentData")}</h2>
                  <p>{t("privacyPaymentDataDesc")}</p>
                </section>

                {/* Cookies & Local Storage */}
                <section id="cookies" className="dxn-privacy-section dxn-anim-fade-up dxn-stagger-6">
                  <h2 className="dxn-privacy-section-title">{t("privacyCookies")}</h2>
                  <p>{t("privacyCookiesDesc")}</p>
                </section>

                {/* Data Sharing */}
                <section id="data-sharing" className="dxn-privacy-section dxn-anim-fade-up dxn-stagger-1">
                  <h2 className="dxn-privacy-section-title">{t("privacyDataSharing")}</h2>
                  <p>{t("privacySharingDelivery")}</p>
                  <p className="dxn-privacy-no-sale"><strong>{t("privacyNoSale")}</strong></p>
                  <p>{t("privacySharingLegal")}</p>
                </section>

                {/* Security */}
                <section id="security" className="dxn-privacy-section dxn-anim-fade-up dxn-stagger-2">
                  <h2 className="dxn-privacy-section-title">{t("privacySecurity")}</h2>
                  <p>{t("privacySecurityDesc")}</p>
                </section>

                {/* Retention */}
                <section id="retention" className="dxn-privacy-section dxn-anim-fade-up dxn-stagger-3">
                  <h2 className="dxn-privacy-section-title">{t("privacyRetention")}</h2>
                  <p>{t("privacyRetentionDesc")}</p>
                </section>

                {/* Rights */}
                <section id="rights" className="dxn-privacy-section dxn-anim-fade-up dxn-stagger-4">
                  <h2 className="dxn-privacy-section-title">{t("privacyRights")}</h2>
                  <p>{t("privacyRightsDesc")}</p>
                </section>

                {/* Contact */}
                <section id="contact" className="dxn-privacy-section dxn-anim-fade-up dxn-stagger-5">
                  <h2 className="dxn-privacy-section-title">{t("privacyContact")}</h2>
                  <p>{t("privacyContactDesc")}</p>
                  <p>
                    <Link to="/contact" className="dxn-btn dxn-btn-primary">
                      {t("contactUs")}
                    </Link>
                  </p>
                </section>

                {/* Updates */}
                <section id="updates" className="dxn-privacy-section dxn-anim-fade-up dxn-stagger-6">
                  <h2 className="dxn-privacy-section-title">{t("privacyUpdates")}</h2>
                  <p>{t("privacyUpdatesDesc")}</p>
                </section>

                {/* Last Updated Note */}
                <div className="dxn-privacy-footer-note dxn-anim-fade-up">
                  <p>
                    {t("privacyLastUpdated")}: {lastUpdated}
                  </p>
                </div>
              </article>
            </div>
          </div>
        </main>
      </div>
    </>
  );
};

export default PrivacyPolicyPage;