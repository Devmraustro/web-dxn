import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import api from "../services/api";
import { SITE_SOCIAL, STORE_EMAIL } from "../config/site";
import { captureReferralFromLocation } from "../utils/referralAttribution";

export interface PublicSocialLinks {
  facebook: string;
  instagram: string;
  tiktok: string;
  telegram: string;
  whatsapp: string;
}

export interface SiteSettingsState {
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
  loaded: boolean;
}

const DEFAULT_SETTINGS: SiteSettingsState = {
  brandName: "DXN Natural Life",
  sponsorMembershipNumber: null,
  sponsorConfigured: false,
  sponsorNameAr: "",
  sponsorNameFr: "",
  whatsappNumber: "",
  whatsappUrl: "",
  contactEmail: STORE_EMAIL,
  socialLinks: {
    facebook: SITE_SOCIAL.facebookUrl || "",
    instagram: SITE_SOCIAL.instagramUrl || "",
    tiktok: "",
    telegram: "",
    whatsapp: "",
  },
  businessHoursAr: "",
  businessHoursFr: "",
  loaded: false,
};

interface SiteSettingsContextValue {
  settings: SiteSettingsState;
  refreshSettings: () => Promise<void>;
}

const SiteSettingsContext = createContext<SiteSettingsContextValue>({
  settings: DEFAULT_SETTINGS,
  refreshSettings: async () => {},
});

export const SiteSettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<SiteSettingsState>(DEFAULT_SETTINGS);
  const location = useLocation();

  // Capture ?ref= and utm_* parameters on every route transition
  useEffect(() => {
    captureReferralFromLocation(location.search, location.pathname);
  }, [location.search, location.pathname]);

  const refreshSettings = useCallback(async () => {
    try {
      const res = await api.get("/settings/public");
      const data = res?.data?.data;
      if (data && typeof data === "object") {
        setSettings({
          brandName: data.brandName || "DXN Natural Life",
          sponsorMembershipNumber: data.sponsorMembershipNumber || null,
          sponsorConfigured: Boolean(data.sponsorConfigured && data.sponsorMembershipNumber),
          sponsorNameAr: data.sponsorNameAr || "",
          sponsorNameFr: data.sponsorNameFr || "",
          whatsappNumber: data.whatsappNumber || "",
          whatsappUrl: data.whatsappUrl || data.socialLinks?.whatsapp || "",
          contactEmail: data.contactEmail || STORE_EMAIL,
          socialLinks: {
            facebook: data.socialLinks?.facebook || SITE_SOCIAL.facebookUrl || "",
            instagram: data.socialLinks?.instagram || SITE_SOCIAL.instagramUrl || "",
            tiktok: data.socialLinks?.tiktok || "",
            telegram: data.socialLinks?.telegram || "",
            whatsapp: data.socialLinks?.whatsapp || data.whatsappUrl || "",
          },
          businessHoursAr: data.businessHoursAr || "",
          businessHoursFr: data.businessHoursFr || "",
          loaded: true,
        });
        return;
      }
    } catch {
      // Fallback safely to build-time defaults
    }
    setSettings((prev) => ({ ...prev, loaded: true }));
  }, []);

  useEffect(() => {
    void refreshSettings();
  }, [refreshSettings]);

  return (
    <SiteSettingsContext.Provider value={{ settings, refreshSettings }}>
      {children}
    </SiteSettingsContext.Provider>
  );
};

export const useSiteSettings = () => useContext(SiteSettingsContext);
