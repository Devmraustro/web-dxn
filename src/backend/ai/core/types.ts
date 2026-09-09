export type LanguageCode = "ar" | "fr";

export type AiPlatform = "instagram" | "facebook" | "web";

export enum Intent {
  PRODUCT_INFO = "PRODUCT_INFO",
  PRODUCT_PRICE = "PRODUCT_PRICE",
  PRODUCT_AVAILABILITY = "PRODUCT_AVAILABILITY",
  PRODUCT_RECOMMENDATION = "PRODUCT_RECOMMENDATION",
  PACK_INFO = "PACK_INFO",
  OFFER_INFO = "OFFER_INFO",
  SHIPPING = "SHIPPING",
  PAYMENT = "PAYMENT",
  ORDER_HELP = "ORDER_HELP",
  ORDER_STATUS = "ORDER_STATUS",
  GENERAL_STORE_INFO = "GENERAL_STORE_INFO",
  HUMAN_REQUEST = "HUMAN_REQUEST",
  COMPLAINT = "COMPLAINT",
  GREETING = "GREETING",
  THANKS = "THANKS",
  PRODUCT_LINK = "PRODUCT_LINK",
  OUT_OF_STOCK = "OUT_OF_STOCK",
  CATALOG = "CATALOG",
  UNKNOWN = "UNKNOWN",
}

export interface AiProviderRequest {
  systemPrompt: string;
  userMessage: string;
  language: LanguageCode;
  maxTokens?: number;
}

export interface AiProviderResponse {
  text: string;
  raw?: unknown;
  tokensUsed?: number;
}

export interface AiProvider {
  readonly name: string;
  /**
   * Non-fatal configuration problem (e.g. missing API key). Always a message
   * describing the missing variable, never the secret itself. Absent when the
   * provider is correctly configured (or is the deterministic fallback).
   */
  readonly configError?: string;
  generateResponse(req: AiProviderRequest): Promise<AiProviderResponse>;
  healthCheck(): Promise<boolean>;
}

export interface CatalogItem {
  id: string;
  slug: string;
  kind: "product" | "pack";
  title: string;
  priceDA: number;
  compareAtPriceDA?: number;
  available: boolean;
  stock?: number;
  category?: string;
  storeUrl: string;
}

export interface OfferInfo {
  id: string;
  title: string;
  type: "percentage" | "fixed" | "promotional";
  value: number;
  label?: string;
}

export interface ShippingInfo {
  wilaya?: string;
  homeDelivery: boolean;
  officeDelivery: boolean;
  homePriceDA?: number;
  officePriceDA?: number;
}

export interface BusinessContext {
  catalog: CatalogItem[];
  offers: OfferInfo[];
  shipping: ShippingInfo;
  store: {
    name: string;
    currency: string;
    paymentMethods: string[];
    contact?: string;
  };
  faq?: { question: string; answer: string; language: LanguageCode }[];
}

export interface IntentResult {
  intent: Intent;
  confidence: number;
  language: LanguageCode;
  entities: {
    product?: string;
    pack?: string;
    category?: string;
    wilaya?: string;
    orderNumber?: string;
  };
}

export interface OrchestratorResult {
  response: string;
  needsHumanHandoff: boolean;
  escalationReason?: string;
  intent: Intent;
  language: LanguageCode;
  confidence: number;
  performedRetrieval: boolean;
  validation: "safe" | "fallback" | "blocked";
}
