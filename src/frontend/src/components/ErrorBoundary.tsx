import React from "react";

/**
 * DXN Natural Life — Application Error Boundary.
 *
 * ROOT CAUSE CONTEXT (post-release): an uncaught render/runtime error (e.g. a
 * failed lazy-chunk load, a transient hydration/API error during navigation)
 * unmounts the entire React tree in React 19 and leaves a completely blank
 * white page — most notably observed on `/join`.
 *
 * This boundary catches any render/lifecycle error below it and renders a
 * friendly, bilingual fallback with a retry action instead of a blank screen.
 * It never redirects users away from the requested route.
 */

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * DXN Natural Life — Recoverable error fallback UI (never a blank page).
 * Exported separately so it can be unit-tested without a client DOM.
 */
export const ErrorFallback: React.FC<{ onRetry: () => void }> = ({ onRetry }) => {
  const isArabic =
    typeof document !== "undefined" &&
    (document.documentElement.getAttribute("lang")?.toLowerCase().startsWith("ar") ?? false);

  return (
    <div className="dxn-page dxn-error-boundary">
      <div className="container py-5">
        <div
          className="text-center p-4 rounded-4"
          style={{
            background: "#f8faf9",
            border: "1px solid var(--dxn-border)",
            maxWidth: 560,
            margin: "0 auto",
          }}
          role="alert"
        >
          <div
            className="d-inline-flex align-items-center justify-content-center rounded-circle mb-3"
            style={{ width: 64, height: 64, background: "#fdecec", color: "#b3261e", fontSize: "1.75rem" }}
            aria-hidden="true"
          >
            !
          </div>
          <h1 className="h4 fw-bold mb-2">
            {isArabic
              ? "تعذّر تحميل هذه الصفحة مؤقتاً"
              : "Cette page ne peut pas être chargée pour le moment"}
          </h1>
          <p className="text-muted mb-4">
            {isArabic
              ? "لم ينجح تحميل المحتوى. حاول مرة أخرى — لا داعي للقلق، بياناتك لم تتأثر."
              : "Le contenu n'a pas pu être chargé. Veuillez réessayer — vos données ne sont pas affectées."}
          </p>
          <div className="d-flex justify-content-center gap-3 flex-wrap">
            <button type="button" className="dxn-btn dxn-btn-primary" onClick={onRetry}>
              {isArabic ? "إعادة المحاولة" : "Réessayer"}
            </button>
            <a href="/" className="dxn-btn dxn-btn-outline">
              {isArabic ? "العودة إلى الصفحة الرئيسية" : "Retour à l'accueil"}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: unknown): void {
    // Surface the real error in the browser console for diagnosis while the
    // user always sees a recoverable UI (never a blank page).
    console.error("DXN Natural Life render error:", error, info);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false });
    if (typeof window !== "undefined") {
      // Full reload guarantees a clean chunk/state recovery.
      window.location.reload();
    }
  };

  render(): React.ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }
    return <ErrorFallback onRetry={this.handleRetry} />;
  }
}

export default ErrorBoundary;
