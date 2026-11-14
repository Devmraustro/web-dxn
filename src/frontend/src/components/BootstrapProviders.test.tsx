/**
 * Regression: provider state initializers run before the application
 * ErrorBoundary mounts. Denied browser storage must not blank the viewport.
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LanguageProvider } from "../context/LanguageContext";
import { CartProvider } from "../context/CartContext";
import { AuthProvider } from "../context/AuthContext";

const g = global as unknown as Record<string, unknown>;

describe("bootstrap providers with denied storage", () => {
  beforeAll(() => {
    const securityError = () => {
      const err = new Error("Access is denied for this document.");
      err.name = "SecurityError";
      throw err;
    };
    g.window = {
      get localStorage() {
        return securityError();
      },
      get sessionStorage() {
        return securityError();
      },
    };
  });

  afterAll(() => {
    delete g.window;
  });

  it("renders children instead of throwing before React mounts", () => {
    const html = renderToStaticMarkup(
      <LanguageProvider>
        <CartProvider>
          <AuthProvider>
            <p>bootstrap-ok</p>
          </AuthProvider>
        </CartProvider>
      </LanguageProvider>
    );
    expect(html).toContain("bootstrap-ok");
  });
});
