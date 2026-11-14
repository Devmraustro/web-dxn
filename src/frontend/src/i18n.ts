import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import arTranslation from "./locales/ar.json";
import frTranslation from "./locales/fr.json";
import LanguageDetector from "i18next-browser-languagedetector";
import { normalizeLanguage } from "./utils/languageSwitcher";
import { isBrowserStorageAvailable, safeStorageGetItem } from "./utils/safeStorage";

// Storage can be denied by browser privacy settings. Probe it once before
// i18next boots so neither the explicit `lng` read nor the localStorage
// detector/cache can throw a pre-mount SecurityError (blank white screen).
const localStorageAvailable = isBrowserStorageAvailable("localStorage");

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
    lng: normalizeLanguage(safeStorageGetItem("dxn_language")),
    fallbackLng: "ar",
    interpolation: {
      escapeValue: false, // React already escapes values
    },
    detection: {
      order: localStorageAvailable ? ["localStorage", "navigator"] : ["navigator"],
      caches: localStorageAvailable ? ["localStorage"] : [],
    },
  });

export default i18n;