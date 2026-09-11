import {
  normalizeLanguage,
  resolveDirection,
  resolveTargetLanguage,
  isButtonSelected,
  readSavedLanguage,
  writeSavedLanguage,
  LANGUAGE_STORAGE_KEY,
} from "./languageSwitcher";

class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  clear() {
    this.map.clear();
  }
  getItem(key: string) {
    return this.map.has(key) ? this.map.get(key)! : null;
  }
  key(index: number) {
    return [...this.map.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
  setItem(key: string, value: string) {
    this.map.set(key, String(value));
  }
}

describe("languageSwitcher", () => {
  describe("Arabic selection behavior", () => {
    it("AR targets 'ar' and is selected when the current language is Arabic", () => {
      expect(resolveTargetLanguage("AR")).toBe("ar");
      expect(resolveTargetLanguage("ar")).toBe("ar");
      expect(normalizeLanguage("ar")).toBe("ar");
      expect(isButtonSelected("ar", "ar")).toBe(true);
      // The French button is NOT active while Arabic is selected.
      expect(isButtonSelected("fr", "ar")).toBe(false);
    });

    it("Arabic resolves to RTL direction", () => {
      expect(resolveDirection("ar")).toBe("rtl");
    });
  });

  describe("French selection behavior", () => {
    it("FR targets 'fr' and is selected when the current language is French", () => {
      expect(resolveTargetLanguage("FR")).toBe("fr");
      expect(resolveTargetLanguage("fr")).toBe("fr");
      expect(normalizeLanguage("fr")).toBe("fr");
      expect(isButtonSelected("fr", "fr")).toBe(true);
      // The Arabic button is NOT active while French is selected.
      expect(isButtonSelected("ar", "fr")).toBe(false);
    });

    it("French resolves to LTR direction", () => {
      expect(resolveDirection("fr")).toBe("ltr");
    });
  });

  describe("active language state", () => {
    it("Arabic current → AR active and FR inactive (exactly one selected)", () => {
      expect(isButtonSelected("ar", "ar")).toBe(true);
      expect(isButtonSelected("fr", "ar")).toBe(false);
      expect([isButtonSelected("ar", "ar"), isButtonSelected("fr", "ar")].filter(Boolean)).toHaveLength(1);
    });

    it("French current → FR active and AR inactive (exactly one selected)", () => {
      expect(isButtonSelected("ar", "fr")).toBe(false);
      expect(isButtonSelected("fr", "fr")).toBe(true);
      expect([isButtonSelected("ar", "fr"), isButtonSelected("fr", "fr")].filter(Boolean)).toHaveLength(1);
    });

    it("switching target is always canonical: AR→ar, FR→fr (never swapped)", () => {
      expect(resolveTargetLanguage("AR")).toBe("ar");
      expect(resolveTargetLanguage("ar")).toBe("ar");
      expect(resolveTargetLanguage("FR")).toBe("fr");
      expect(resolveTargetLanguage("fr")).toBe("fr");
    });
  });

  describe("RTL/LTR direction", () => {
    it("Arabic resolves to rtl", () => {
      expect(resolveDirection("ar")).toBe("rtl");
    });

    it("French resolves to ltr", () => {
      expect(resolveDirection("fr")).toBe("ltr");
    });
  });

  describe("arbitrary values", () => {
    it("normalizes anything that is not ar/fr to the fallback", () => {
      expect(normalizeLanguage("en")).toBe("ar");
      expect(normalizeLanguage("")).toBe("ar");
      expect(normalizeLanguage(null)).toBe("ar");
      expect(normalizeLanguage(undefined)).toBe("ar");
      expect(normalizeLanguage("ARABIC")).toBe("ar");
      expect(normalizeLanguage("   ")).toBe("ar");
    });

    it("normalizes case-insensitively — the root-cause fix for the reversed buttons", () => {
      expect(normalizeLanguage("AR")).toBe("ar");
      expect(normalizeLanguage("Fr")).toBe("fr");
      expect(normalizeLanguage("FR")).toBe("fr");
      expect(normalizeLanguage(" ar ")).toBe("ar");
    });
  });

  describe("persistence", () => {
    it("stores under the single dxn_language key and reads it back", () => {
      const storage = new MemoryStorage();
      writeSavedLanguage(storage, "fr");
      expect(storage.getItem(LANGUAGE_STORAGE_KEY)).toBe("fr");
      expect(readSavedLanguage(storage)).toBe("fr");
    });

    it("falls back to Arabic when nothing is stored or storage throws", () => {
      expect(readSavedLanguage(new MemoryStorage())).toBe("ar");
      expect(readSavedLanguage({ getItem: () => null })).toBe("ar");
      expect(readSavedLanguage({ getItem: () => "bogus" })).toBe("ar");
    });

    it("reads an upcased persisted value back as Arabic (never an inverted state)", () => {
      expect(readSavedLanguage({ getItem: () => "AR" })).toBe("ar");
      expect(readSavedLanguage({ getItem: () => "Fr" })).toBe("fr");
    });
  });
});