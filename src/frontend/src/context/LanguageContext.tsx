import React, { createContext, useContext, useState, useEffect } from "react";
import i18n from "../i18n";

interface LanguageContextType {
  language: string;
  changeLanguage: (lang: string) => void;
}

const LanguageContext = createContext<LanguageContextType>({
  language: "ar",
  changeLanguage: () => {},
});

export const LanguageProvider = ({ children }: { children: React.ReactNode }) => {
  const [language, setLanguage] = useState<string>(() => {
    const saved = localStorage.getItem("dxn_language");
    return saved || "ar";
  });

  // Keep the HTML dir attribute and i18n language in sync whenever language changes.
  // Without this the whole page layout stays LTR even when the UI is Arabic.
  useEffect(() => {
    const dir = language === "ar" ? "rtl" : "ltr";
    if (typeof document !== "undefined") {
      document.documentElement.dir = dir;
      document.documentElement.lang = language;
    }
    i18n.changeLanguage(language);
    localStorage.setItem("dxn_language", language);
  }, [language]);

  const changeLanguage = (lang: string) => {
    setLanguage(lang);
  };

  return (
    <LanguageContext.Provider value={{ language, changeLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);

export default LanguageContext;