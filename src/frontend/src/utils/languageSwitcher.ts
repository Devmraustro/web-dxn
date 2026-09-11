/**
 * Pure language-switching helpers, unit-tested so the switcher semantics can
 * never silently regress (e.g. labels swapped or active state inverted).
 */

export type UiLanguage = "ar" | "fr";
export type DocumentDirection = "rtl" | "ltr";

export const LANGUAGE_STORAGE_KEY = "dxn_language";

export const SUPPORTED_LANGUAGES: ReadonlyArray<UiLanguage> = ["ar", "fr"];

/**
 * Coerce any stored/unsafe value to a supported UI language.
 *
 * Case-insensitive on purpose: the ROOT-CAUSE bug this module fixes was that a
 * persisted value that was not byte-for-byte "ar" (e.g. an upcased "AR", a
 * partial/failed write, or a stray value from an older session) made the app
 * render French text + LTR while BOTH language buttons appeared unselected —
 * which reads as "the buttons are reversed". Normalizing deterministically
 * guarantees storage can only ever produce canonical ar|fr.
 */
export function normalizeLanguage(value: unknown, fallback: UiLanguage = "ar"): UiLanguage {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  return normalized === "ar" || normalized === "fr" ? (normalized as UiLanguage) : fallback;
}

/** The document direction for a UI language: Arabic is always RTL, French LTR. */
export function resolveDirection(language: UiLanguage): DocumentDirection {
  return language === "ar" ? "rtl" : "ltr";
}

/** The language a switch request targets: AR→ar, FR→fr (identity, never swapped). */
export function resolveTargetLanguage(pressed: string): UiLanguage {
  return normalizeLanguage(pressed) === "fr" ? "fr" : "ar";
}

/** A button is "selected/active" iff its code equals the current normalized language. */
export function isButtonSelected(buttonLanguage: unknown, currentLanguage: string): boolean {
  return normalizeLanguage(buttonLanguage) === normalizeLanguage(currentLanguage);
}

export function readSavedLanguage(storage: Pick<Storage, "getItem">): UiLanguage {
  try {
    return normalizeLanguage(storage.getItem(LANGUAGE_STORAGE_KEY));
  } catch {
    return "ar";
  }
}

export function writeSavedLanguage(
  storage: Pick<Storage, "setItem">,
  language: UiLanguage
): void {
  try {
    storage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    /* persistence is best-effort */
  }
}

export default {
  normalizeLanguage,
  resolveDirection,
  resolveTargetLanguage,
  isButtonSelected,
  readSavedLanguage,
  writeSavedLanguage,
  SUPPORTED_LANGUAGES,
  LANGUAGE_STORAGE_KEY,
};