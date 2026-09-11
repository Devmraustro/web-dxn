import React from "react";
import { useLanguage } from "../context/LanguageContext";
import { isButtonSelected, resolveTargetLanguage } from "../utils/languageSwitcher";

/**
 * Single canonical AR/FR switcher. Both buttons derive their target language
 * from `resolveTargetLanguage` (AR→ar, FR→fr — never swapped) and their active
 * state from `isButtonSelected` (selected iff the button's code equals the
 * current normalized language). RTL/LTR and persistence are handled by the
 * context; this component only renders state that can never invert.
 */
const LanguageSelector = () => {
  const { language, changeLanguage } = useLanguage();

  return (
    <div className="language-selector" role="group" aria-label="Language selector">
      <button
        type="button"
        onClick={() => changeLanguage(resolveTargetLanguage("AR"))}
        className={isButtonSelected("ar", language) ? "selected" : ""}
        aria-pressed={isButtonSelected("ar", language)}
        aria-label={language === "ar" ? "العربية (مفعّلة)" : "العربية — Switcher vers l'arabe"}
      >
        AR
      </button>
      <button
        type="button"
        onClick={() => changeLanguage(resolveTargetLanguage("FR"))}
        className={isButtonSelected("fr", language) ? "selected" : ""}
        aria-pressed={isButtonSelected("fr", language)}
        aria-label={language === "fr" ? "Français (actif)" : "Français — التبديل إلى الفرنسية"}
      >
        FR
      </button>
    </div>
  );
};

export default LanguageSelector;