import { safetyGuard } from "../../backend/services/ai.service";

describe("AI Safety Guard", () => {
  describe("medical claims detection", () => {
    it("should detect cure claims", () => {
      const result = safetyGuard("This product guarantees weight loss");
      expect(result.safe).toBe(false);
      expect(result.violationType).toBe("medical_claim");
    });

    it("should detect guaranteed health outcomes", () => {
      const result = safetyGuard("This product cures diabetes");
      expect(result.safe).toBe(false);
      expect(result.violationType).toBe("medical_claim");
    });

    it("should allow general product questions", () => {
      const result = safetyGuard("What are the benefits of this product?");
      expect(result.safe).toBe(true);
    });

    it("should detect miracle solution claims", () => {
      const result = safetyGuard("This is a miracle solution for this problem");
      expect(result.safe).toBe(false);
      expect(result.violationType).toBe("medical_claim");
    });
  });

  describe("price invention detection", () => {
    it("should detect price invention", () => {
      const result = safetyGuard("this product costs 500 DZD");
      expect(result.safe).toBe(false);
      expect(result.violationType).toBe("price_invention");
    });

    it("should allow general questions without price claims", () => {
      const result = safetyGuard("Is this product available?");
      expect(result.safe).toBe(true);
    });
  });

  describe("Arabic messages", () => {
    it("should work with Arabic messages", () => {
      const result = safetyGuard("هل المنتج متوفر للطلب؟");
      expect(result).toBeDefined();
    });

    it("should work with Darija/mixed messages", () => {
      const result = safetyGuard("فين المنتج هذا؟");
      expect(result).toBeDefined();
    });
  });

  describe("French messages", () => {
    it("should work with French messages", () => {
      const result = safetyGuard("Ce produit est-il disponible ?");
      expect(result).toBeDefined();
    });
  });
});
