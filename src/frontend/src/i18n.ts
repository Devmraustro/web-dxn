import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import arTranslation from "../public/locales/ar.json";
import frTranslation from "../public/locales/fr.json";
import LanguageDetector from "i18next-browser-languagedetector";
import { normalizeLanguage } from "./utils/languageSwitcher";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      ar: {
        translation: arTranslation,
      },
      fr: {
        translation: frTranslation,
      },
    },
    lng:
      typeof window !== "undefined"
        ? normalizeLanguage(window.localStorage.getItem("dxn_language"))
        : "ar",
    fallbackLng: "ar",
    interpolation: {
      escapeValue: false, // React already escapes values
    },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
    },
  });

export default i18n;