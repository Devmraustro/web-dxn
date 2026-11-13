/**
 * DXN NADZ — Site Settings Service (Public Safe Config + Admin Management).
 *
 * SECURITY INVARIANTS:
 * 1. Secret environment variables (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`,
 *    `JWT_SECRET`, API keys) are NEVER stored in or returned by this service.
 * 2. Social URLs must be valid `https://` URLs (or empty string when unconfigured).
 *    Fake placeholder URLs (e.g. `example.com`) are rejected/stripped.
 * 3. Sponsor membership number is read-only to public visitors and managed only
 *    by `owner`/`admin` (or via `DXN_SPONSOR_MEMBER_ID` env fallback).
 */
import mongoose from "mongoose";
import * as Models from "../../Database/Models";
import { isTelegramConfigured } from "./telegram.service";
import { normalizeOptionalDxnMemberId } from "./attribution.service";

export interface PublicSocialLinks {
  facebook: string;
  instagram: string;
  tiktok: string;
  telegram: string;
  whatsapp: string;
}

export interface PublicSiteSettings {
  brandName: string;
  sponsorMembershipNumber: string | null;
  sponsorConfigured: boolean;
  sponsorNameAr: string;
  sponsorNameFr: string;
  whatsappNumber: string;
  whatsappUrl: string;
  contactEmail: string;
  socialLinks: PublicSocialLinks;
  businessHoursAr: string;
  businessHoursFr: string;
}

export interface AdminSiteSettings extends PublicSiteSettings {
  telegramNotificationsEnabled: boolean;
  notifyOnNewOrder: boolean;
  notifyOnNewLead: boolean;
  notifyOnNewContact: boolean;
  telegramEnvConfigured: boolean;
}

const DEFAULT_EMAIL = "dxntraveldz@gmail.com";

export function sanitizeExternalHttpsUrl(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const trimmed = raw.trim();
  if (!trimmed) return "";
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:") return "";
    const host = parsed.hostname.toLowerCase();
    if (
      host === "example.com" ||
      host.endsWith(".example.com") ||
      trimmed.includes("undefined")
    ) {
      return "";
    }
    return parsed.toString();
  } catch {
    return "";
  }
}

export function sanitizeWhatsappNumber(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const trimmed = raw.trim();
  if (!trimmed) return "";
  // Keep optional leading + and digits
  const digits = trimmed.replace(/[^\d+]/g, "");
  const numericOnly = digits.replace(/\D/g, "");
  if (numericOnly.length < 8 || numericOnly.length > 15) return "";
  return numericOnly;
}

export function buildWhatsappUrl(whatsappNumber: string, explicitUrl?: string): string {
  const safeExplicit = sanitizeExternalHttpsUrl(explicitUrl);
  if (safeExplicit) return safeExplicit;
  const cleanDigits = sanitizeWhatsappNumber(whatsappNumber);
  if (!cleanDigits) return "";
  // Normalize local Algerian mobile 05/06/07XXXXXXXX to 2135/6/7XXXXXXXX for wa.me
  if (/^0[5-7]\d{8}$/.test(cleanDigits)) {
    return `https://wa.me/213${cleanDigits.slice(1)}`;
  }
  return `https://wa.me/${cleanDigits}`;
}

async function loadRawSettingsDoc(): Promise<any | null> {
  try {
    const SiteSettingsModel = (Models as any).SiteSettings;
    if (!SiteSettingsModel || typeof SiteSettingsModel.findOne !== "function") return null;
    if (
      SiteSettingsModel.db &&
      typeof mongoose.connection?.readyState === "number" &&
      mongoose.connection.readyState !== 1 &&
      !(SiteSettingsModel.findOne as any)._isMockFunction
    ) {
      return null;
    }
    const query = SiteSettingsModel.findOne({ key: "global" });
    if (query && typeof query.lean === "function") {
      return await query.lean();
    }
    return await query;
  } catch {
    return null;
  }
}

function mergeWithEnvDefaults(doc: any | null): AdminSiteSettings {
  const envSponsorRes = normalizeOptionalDxnMemberId(process.env.DXN_SPONSOR_MEMBER_ID || "");
  const dbSponsorRes = normalizeOptionalDxnMemberId(doc?.sponsorMembershipNumber || "");
  const sponsorMembershipNumber = dbSponsorRes.valid && dbSponsorRes.value
    ? dbSponsorRes.value
    : (envSponsorRes.valid ? envSponsorRes.value : null);

  const whatsappNumber =
    sanitizeWhatsappNumber(doc?.whatsappNumber) ||
    sanitizeWhatsappNumber(process.env.STORE_WHATSAPP_NUMBER) ||
    "";

  const socialLinks: PublicSocialLinks = {
    facebook:
      sanitizeExternalHttpsUrl(doc?.socialLinks?.facebook) ||
      sanitizeExternalHttpsUrl(process.env.VITE_FACEBOOK_URL),
    instagram:
      sanitizeExternalHttpsUrl(doc?.socialLinks?.instagram) ||
      sanitizeExternalHttpsUrl(process.env.VITE_INSTAGRAM_URL),
    tiktok:
      sanitizeExternalHttpsUrl(doc?.socialLinks?.tiktok) ||
      sanitizeExternalHttpsUrl(process.env.VITE_TIKTOK_URL),
    telegram:
      sanitizeExternalHttpsUrl(doc?.socialLinks?.telegram) ||
      sanitizeExternalHttpsUrl(process.env.VITE_TELEGRAM_URL),
    whatsapp: "",
  };

  const whatsappUrl = buildWhatsappUrl(
    whatsappNumber,
    doc?.socialLinks?.whatsapp || process.env.VITE_WHATSAPP_URL
  );
  socialLinks.whatsapp = whatsappUrl;

  const contactEmail =
    (typeof doc?.contactEmail === "string" && doc.contactEmail.includes("@")
      ? doc.contactEmail.trim()
      : "") ||
    (typeof process.env.STORE_EMAIL === "string" && process.env.STORE_EMAIL.includes("@")
      ? process.env.STORE_EMAIL.trim()
      : DEFAULT_EMAIL);

  return {
    brandName:
      typeof doc?.brandName === "string" && doc.brandName.trim()
        ? doc.brandName.trim()
        : "DXN NADZ",
    sponsorMembershipNumber,
    sponsorConfigured: Boolean(sponsorMembershipNumber),
    sponsorNameAr: typeof doc?.sponsorNameAr === "string" ? doc.sponsorNameAr.trim() : "",
    sponsorNameFr: typeof doc?.sponsorNameFr === "string" ? doc.sponsorNameFr.trim() : "",
    whatsappNumber,
    whatsappUrl,
    contactEmail,
    socialLinks,
    businessHoursAr: typeof doc?.businessHoursAr === "string" ? doc.businessHoursAr.trim() : "",
    businessHoursFr: typeof doc?.businessHoursFr === "string" ? doc.businessHoursFr.trim() : "",
    telegramNotificationsEnabled:
      typeof doc?.telegramNotificationsEnabled === "boolean"
        ? doc.telegramNotificationsEnabled
        : true,
    notifyOnNewOrder:
      typeof doc?.notifyOnNewOrder === "boolean" ? doc.notifyOnNewOrder : true,
    notifyOnNewLead:
      typeof doc?.notifyOnNewLead === "boolean" ? doc.notifyOnNewLead : true,
    notifyOnNewContact:
      typeof doc?.notifyOnNewContact === "boolean" ? doc.notifyOnNewContact : true,
    telegramEnvConfigured: isTelegramConfigured(),
  };
}

export async function getPublicSiteSettings(): Promise<PublicSiteSettings> {
  const full = await getAdminSiteSettings();
  return {
    brandName: full.brandName,
    sponsorMembershipNumber: full.sponsorMembershipNumber,
    sponsorConfigured: full.sponsorConfigured,
    sponsorNameAr: full.sponsorNameAr,
    sponsorNameFr: full.sponsorNameFr,
    whatsappNumber: full.whatsappNumber,
    whatsappUrl: full.whatsappUrl,
    contactEmail: full.contactEmail,
    socialLinks: full.socialLinks,
    businessHoursAr: full.businessHoursAr,
    businessHoursFr: full.businessHoursFr,
  };
}

export async function getAdminSiteSettings(): Promise<AdminSiteSettings> {
  const doc = await loadRawSettingsDoc();
  return mergeWithEnvDefaults(doc);
}
