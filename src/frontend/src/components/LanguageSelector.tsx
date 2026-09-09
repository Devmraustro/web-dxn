import React from "react";
import { useLanguage } from "../context/LanguageContext";

const LanguageSelector = () => {
  const { language, changeLanguage } = useLanguage();

  return (
    <div className="language-selector" role="group" aria-label="Language selector">
      <button
        type="button"
        onClick={() => changeLanguage("ar")}
        className={language === "ar" ? "selected" : ""}
        aria-pressed={language === "ar"}
        aria-label="Switch language to Arabic"
      >
        AR
      </button>
      <button
        type="button"
        onClick={() => changeLanguage("fr")}
        className={language === "fr" ? "selected" : ""}
        aria-pressed={language === "fr"}
        aria-label="Switch language to French"
      >
        FR
      </button>
    </div>
  );
};

export default LanguageSelector;