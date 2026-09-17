/**
 * Factual store contact + social configuration.
 *
 * - STORE_EMAIL is a real, verifiable channel used by every order flow.
 * - Social profile URLs are injected by Vite at build time from
 *   VITE_FACEBOOK_URL / VITE_INSTAGRAM_URL. No placeholder URLs are ever set;
 *   when the owner has not configured a profile, the helper returns undefined
 *   and the UI simply hides that button.
 *
 * `typeof` guards keep this file safe outside a Vite build (Jest / plain
 * Node), where the injected identifiers do not exist.
 */

// Vite replaces these identifiers at build time; `typeof` keeps them safe when
// running under Jest / plain Node where they are not declared.
declare const __VITE_FACEBOOK_URL__: string | undefined;
declare const __VITE_INSTAGRAM_URL__: string | undefined;

export const STORE_EMAIL = "dxntraveldz@gmail.com";
export const STORE_EMAIL_MAILTO = `mailto:${STORE_EMAIL}`;

interface SiteSocialConfig {
  facebook?: string;
  instagram?: string;
}

export function readSiteSocialConfig(): SiteSocialConfig {
  const config: SiteSocialConfig = {};
  const facebook: unknown =
    typeof __VITE_FACEBOOK_URL__ === "string" ? __VITE_FACEBOOK_URL__ : undefined;
  const instagram: unknown =
    typeof __VITE_INSTAGRAM_URL__ === "string" ? __VITE_INSTAGRAM_URL__ : undefined;
  if (typeof facebook === "string" && facebook) config.facebook = facebook;
  if (typeof instagram === "string" && instagram) config.instagram = instagram;
  return config;
}