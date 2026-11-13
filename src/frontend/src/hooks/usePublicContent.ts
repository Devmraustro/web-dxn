import { useEffect, useState } from "react";
import api from "../services/api";

export interface PublicEducationalArticle {
  slug: string;
  category: string;
  sortOrder: number;
  readingMinutes: number;
  ar: {
    title: string;
    summary: string;
    scientificInfo: string;
    ingredientEvidence: string;
    traditionalUses: string;
    unprovenClaimsNotice: string;
    usageAndStorage: string;
    disclaimer: string;
  };
  fr: {
    title: string;
    summary: string;
    scientificInfo: string;
    ingredientEvidence: string;
    traditionalUses: string;
    unprovenClaimsNotice: string;
    usageAndStorage: string;
    disclaimer: string;
  };
}

export interface PublicFaqItem {
  slug: string;
  category: string;
  sortOrder: number;
  ar: { question: string; answer: string };
  fr: { question: string; answer: string };
}

export interface PublicContentState {
  articles: PublicEducationalArticle[];
  faqs: PublicFaqItem[];
  blocks: Record<string, any>;
  loading: boolean;
}

let cachedContent: Omit<PublicContentState, "loading"> | null = null;

export function invalidatePublicContentCache(): void {
  cachedContent = null;
}

export function usePublicContent(): PublicContentState {
  const [state, setState] = useState<PublicContentState>({
    articles: cachedContent?.articles || [],
    faqs: cachedContent?.faqs || [],
    blocks: cachedContent?.blocks || {},
    loading: !cachedContent,
  });

  useEffect(() => {
    let active = true;
    api
      .get("/content/public")
      .then((res: any) => {
        if (!active) return;
        const data = res?.data?.data;
        if (data) {
          cachedContent = {
            articles: Array.isArray(data.articles) ? data.articles : [],
            faqs: Array.isArray(data.faqs) ? data.faqs : [],
            blocks: data.blocks || {},
          };
          setState({ ...cachedContent, loading: false });
        } else {
          setState((prev) => ({ ...prev, loading: false }));
        }
      })
      .catch(() => {
        if (active) setState((prev) => ({ ...prev, loading: false }));
      });
    return () => {
      active = false;
    };
  }, []);

  return state;
}
