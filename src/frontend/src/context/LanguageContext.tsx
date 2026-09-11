import React, { createContext, useContext, useState, useEffect } from "react";
import i18n from "../i18n";
import {
  normalizeLanguage,
  readSavedLanguage,
  writeSavedLanguage,
  resolveDirection,
  type UiLanguage,
  type DocumentDirection,
} from "../utils/languageSwitcher";

interface LanguageContextType {
  language: UiLanguage;
  dir: DocumentDirection;
  changeLanguage: (lang: string) => void;
}

const LanguageContext = createContext<LanguageContextType>({
  language: "ar",
  dir: "rtl",
  changeLanguage: () => {},
});

export const LanguageProvider = ({ children }: { children: React.ReactNode }) => {
  // ROOT-CAUSE FIX: the stored value is normalized (case-insensitively) on
  // read. Previously the raw string was used verbatim, so any persisted value
  // other than the exact byte "ar" silently rendered French + LTR while the
  // AR/FR buttons both appeared inactive — i.e. a "reversed" switcher.
  const [language, setLanguage] = useState<UiLanguage>(() =>
    typeof window !== "undefined" && typeof window.localStorage !== "undefined"
      ? readSavedLanguage(window.localStorage)
      : "ar"
  );

  const dir = resolveDirection(language);

  // Keep the HTML dir attribute, i18n language and persisted preference in
  // sync whenever language changes. Without this the whole page layout stays
  // LTR even when the UI is Arabic.
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.dir = dir;
      document.documentElement.lang = language;
    }
    i18n.changeLanguage(language);
    if (typeof window !== "undefined" && typeof window.localStorage !== "undefined") {
      writeSavedLanguage(window.localStorage, language);
    }
  }, [language, dir]);

  const changeLanguage = (lang: string) => {
    setLanguage(normalizeLanguage(lang));
  };

  return (
    <LanguageContext.Provider value={{ language, dir, changeLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);

export default LanguageContext;