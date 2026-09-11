import { resolveOrderOutcome, orderSuccessCopy } from "./orderFlow";

const fallback = (lang: "ar" | "fr") =>
  lang === "ar" ? "فشل إرسال الطلب. حاول مرة أخرى." : "Échec de l'envoi de la commande. Réessayez.";

describe("orderFlow", () => {
  describe("resolveOrderOutcome", () => {
    it("shows success only after a confirmed successful backend creation (201 + success)", () => {
      const outcome = resolveOrderOutcome(
        201,
        { success: true, data: { orderNumber: "DXN-123" } },
        "ar",
        fallback("ar")
      );
      expect(outcome.showSuccess).toBe(true);
      expect(outcome.orderNumber).toBe("DXN-123");
      expect(outcome.errorMessage).toBeUndefined();
    });

    it("never shows success on an HTTP failure (400)", () => {
      const outcome = resolveOrderOutcome(
        400,
        { success: false, message: "Cart is empty" },
        "fr",
        fallback("fr")
      );
      expect(outcome.showSuccess).toBe(false);
      expect(outcome.errorMessage).toBe("Cart is empty");
    });

    it("never shows success on a 500 even if the body claims success", () => {
      const outcome = resolveOrderOutcome(
        500,
        { success: true, data: { orderNumber: "DXN-999" } },
        "ar",
        fallback("ar")
      );
      expect(outcome.showSuccess).toBe(false);
    });

    it("uses the localized fallback when the server provides no message", () => {
      const ar = resolveOrderOutcome(400, { success: false }, "ar", fallback("ar"));
      expect(ar.errorMessage).toBe(fallback("ar"));

      const fr = resolveOrderOutcome(400, { success: false }, "fr", fallback("fr"));
      expect(fr.errorMessage).toBe(fallback("fr"));
    });
  });

  describe("orderSuccessCopy", () => {
    it("returns the exact required Arabic copy — contact to CONFIRM, never claims payment/shipping/confirmation", () => {
      const copy = orderSuccessCopy("ar");
      expect(copy.title).toBe("تم إرسال طلبك بنجاح 🎉");
      expect(copy.body).toBe("سنتواصل معك ونرد عليك في أقرب وقت لتأكيد طلبك.");
    });

    it("returns the exact required French copy", () => {
      const copy = orderSuccessCopy("fr");
      expect(copy.title).toBe("Votre commande a été envoyée avec succès 🎉");
      expect(copy.body).toBe("Nous vous contacterons dans les plus brefs délais pour confirmer votre commande.");
    });
  });
});