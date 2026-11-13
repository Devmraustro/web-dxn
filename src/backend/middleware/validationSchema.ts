import * as yup from "yup";
import { isUrlLike, isValidSlug } from "../utils/slug";

const slugFormatMessage =
  "Slug must be a lowercase URL-safe slug (letters, numbers and hyphens only), not a URL or path";

const slugInputTest = (value: string | undefined): boolean => {
  if (value === undefined || value === null) return true;
  const v = value.trim();
  if (!v) return true;
  return !isUrlLike(v) && isValidSlug(v);
};

const phoneTest = (value: string | undefined): boolean => {
  if (!value) return true;
  const cleaned = value.replace(/\s+/g, "").replace(/^\+/, "");
  // Accept all three Algerian mobile prefixes (05/06/07) for Djezzy, Mobilis,
  // and Ooredoo. Was previously restricted to 05 which silently rejected
  // ~70% of real Algerian numbers.
  return /^0[5-7]\d{8}$/.test(cleaned);
};

// --- Auth schemas ---

export const registerSchema = yup.object({
  email: yup.string().email("Invalid email address").required("Email is required"),
  password: yup
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password too long")
    .required("Password is required"),
  firstName: yup.string().required("First name is required").max(100),
  lastName: yup.string().required("Last name is required").max(100),
  phone: yup.string().test("algerian-phone", "Invalid Algerian phone number", phoneTest),
  // role is intentionally NOT accepted: privileged roles are only set by
  // server-side admin tooling, never from the public registration payload.
});

export const loginSchema = yup.object({
  email: yup.string().email("Invalid email address").required("Email is required"),
  password: yup.string().required("Password is required"),
});

export const forgotPasswordSchema = yup.object({
  email: yup.string().email("Invalid email address").required("Email is required"),
});

export const resetPasswordSchema = yup.object({
  password: yup
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password too long")
    .required("Password is required"),
});

export const updateProfileSchema = yup.object({
  firstName: yup.string().max(100),
  lastName: yup.string().max(100),
  phone: yup.string().test("algerian-phone", "Invalid Algerian phone number", phoneTest),
  secondPhone: yup.string().test("algerian-phone", "Invalid Algerian phone number", phoneTest),
  wilaya: yup.string().max(100),
  commune: yup.string().max(100),
  address: yup.string().max(500),
});

// --- Product schemas ---

const translationSchema = yup.object({
  title: yup.string(),
  description: yup.string(),
  size: yup.string(),
  specifications: yup.string().max(5000),
  ingredients: yup.string().max(5000),
  usageInstructions: yup.string().max(5000),
  storageInstructions: yup.string().max(3000),
});

const productCreateFields = {
  category: yup.string().max(64),
  categoryId: yup.string().nullable().max(40),
  points: yup.number().min(0).max(1_000_000),
  price: yup.number().min(0, "Price cannot be negative").max(10_000_000).required("Price is required"),
  compareAtPrice: yup.number().min(0).max(10_000_000),
  stockQuantity: yup
    .number()
    .integer("Stock must be an integer")
    .min(0, "Stock cannot be negative")
    .max(1_000_000),
  isActive: yup.boolean(),
  isFeatured: yup.boolean(),
  sortOrder: yup.number().integer().min(0).max(1_000_000),
  image: yup.string().max(500),
  images: yup.array().of(yup.string().max(500)).max(10),
};

const productUpdateFields = {
  category: yup.string().max(64),
  categoryId: yup.string().nullable().max(40),
  points: yup.number().min(0).max(1_000_000),
  price: yup.number().min(0, "Price cannot be negative").max(10_000_000),
  compareAtPrice: yup.number().min(0).max(10_000_000),
  stockQuantity: yup
    .number()
    .integer("Stock must be an integer")
    .min(0, "Stock cannot be negative")
    .max(1_000_000),
  isActive: yup.boolean(),
  isFeatured: yup.boolean(),
  sortOrder: yup.number().integer().min(0).max(1_000_000),
  image: yup.string().max(500),
  images: yup.array().of(yup.string().max(500)).max(10),
};

export const productSchema = yup.object({
  sku: yup.string().required("SKU is required").max(100),
  slug: yup
    .string()
    .max(200)
    .test("product-slug-format", slugFormatMessage, slugInputTest),
  ...productCreateFields,
  translations: yup.object({
    ar: translationSchema,
    fr: translationSchema,
  }),
});

export const productUpdateSchema = yup.object({
  sku: yup.string().max(100),
  slug: yup.string().max(200),
  ...productUpdateFields,
  translations: yup.object({
    ar: translationSchema,
    fr: translationSchema,
  }),
});

// --- Pack schemas ---

const packContentSchema = yup.object({
  productId: yup.string().required("Product ID is required"),
  quantity: yup.number().integer("Quantity must be an integer").positive("Quantity must be positive"),
});

export const packSchema = yup.object({
  name: yup.string().required("Name is required").max(200),
  slug: yup.string().required("Slug is required").max(200),
  price: yup.number().required("Price is required").positive("Price must be positive").max(1_000_000),
  compareAtPrice: yup.number().positive().max(1_000_000),
  contents: yup.array().of(packContentSchema),
});

export const packUpdateSchema = yup.object({
  name: yup.string().max(200),
  slug: yup.string().max(200),
  price: yup.number().positive("Price must be positive").max(1_000_000),
  compareAtPrice: yup.number().positive().max(1_000_000),
  contents: yup.array().of(packContentSchema),
});

// --- Order schemas ---

const customerInfoSchema = yup.object({
  firstName: yup.string().required().max(100),
  lastName: yup.string().required().max(100),
  phone: yup
    .string()
    .required("Phone is required")
    .test("algerian-phone", "Invalid Algerian phone number", phoneTest),
  secondPhone: yup.string().test("algerian-phone", "Invalid Algerian phone number", phoneTest),
});

export const cartItemSchema = yup
  .object({
    productId: yup.string().matches(/^[0-9a-fA-F]{24}$/, "Invalid product id"),
    packId: yup.string().matches(/^[0-9a-fA-F]{24}$/, "Invalid pack id"),
    quantity: yup
      .number()
      .integer("Quantity must be an integer")
      .positive("Quantity must be positive")
      .max(999, "Quantity too large")
      .required("Quantity is required"),
    // unitPrice is accepted for client-side display compatibility but NEVER
    // used by the server to compute totals.
    unitPrice: yup.number().positive(),
  })
  .test(
    "exactly-one-identifier",
    "Each cart item must reference exactly one product or pack",
    (value) => {
      const hasProduct = typeof value?.productId === "string" && value.productId.length > 0;
      const hasPack = typeof value?.packId === "string" && value.packId.length > 0;
      return hasProduct !== hasPack;
    }
  );

export const orderCreateSchema = yup.object({
  customerInfo: customerInfoSchema.required("Customer information is required"),
  cartItems: yup
    .array()
    .of(cartItemSchema)
    .min(1, "Cart is empty")
    .required("Cart items are required"),
  deliveryMethod: yup
    .string()
    .oneOf(["home", "office"], "Invalid delivery method")
    .required("Delivery method is required"),
  wilaya: yup.string().required("Wilaya is required").max(100),
  commune: yup.string().required("Commune is required").max(100),
  // Address is OPTIONAL: office delivery (post office pickup) does not need
  // a street address. The server clears it for office delivery too.
  address: yup.string().max(500),
  paymentMethod: yup
    .string()
    .oneOf(["cod"], "Invalid payment method. Only Cash on Delivery is accepted.")
    .required("Payment method is required"),
  confirmed: yup.boolean().required("Order must be confirmed").oneOf([true], "Order must be confirmed"),
  // Optional customer DXN membership number (never mandatory; empty/null permitted)
  dxnMemberId: yup
    .string()
    .nullable()
    .optional()
    .max(32, "DXN membership number is too long")
    .test(
      "optional-dxn-member-id",
      "DXN membership number must contain 5 to 24 letters or digits",
      (value) => {
        if (value === null || value === undefined || value.trim() === "") return true;
        const compact = value.trim().replace(/[\s-]+/g, "");
        return /^[A-Za-z0-9]{5,24}$/.test(compact);
      }
    ),
  trafficSource: yup
    .object({
      source: yup.string().max(64),
      ref: yup.string().max(64),
      utmSource: yup.string().max(64),
      utmMedium: yup.string().max(64),
      utmCampaign: yup.string().max(80),
      landingPath: yup.string().max(200),
    })
    .optional(),
});

export const orderStatusUpdateSchema = yup.object({
  status: yup
    .string()
    .oneOf(
      [
        "new",
        "pending_payment",
        "confirmed",
        "processing",
        "shipped",
        "delivered",
        "cancelled",
        "rejected",
      ],
      "Invalid status"
    )
    .required("Status is required"),
});

// --- Shipping schemas ---

export const wilayaSchema = yup.object({
  name: yup.string().required("Wilaya name is required").max(100),
  nameFr: yup.string().max(100),
});

export const shippingRateSchema = yup.object({
  wilayaId: yup.string().required("Wilaya is required"),
  deliveryMethod: yup
    .string()
    .oneOf(["home", "office"], "Invalid delivery method")
    .required("Delivery method is required"),
  price: yup.number().required("Price is required").min(0, "Price must be >= 0").max(100_000),
});

export const shippingCalculateSchema = yup.object({
  wilayaId: yup.string().required(),
  deliveryMethod: yup.string().oneOf(["home", "office"]).required(),
  items: yup.array().of(
    yup.object({
      productId: yup.string(),
      packId: yup.string(),
      quantity: yup.number().integer().positive().required(),
    })
  ),
});

// --- Offer schemas ---

const offerValue = (required: boolean) => {
  let schema: yup.NumberSchema = yup
    .number()
    .min(0, "Offer value cannot be negative")
    .max(10_000_000)
    .test("value-by-type", "Percentage offers are capped at 100", function percentageBound(value?: number) {
      if (value === undefined) return true;
      const type = (this.parent as any)?.type;
      if (type === "percentage" && value > 100) {
        return this.createError({ message: "Percentage offer cannot exceed 100" });
      }
      return true;
    });
  if (required) {
    schema = schema.required("Value is required");
  }
  return schema;
};

export const offerCreateSchema = yup.object({
  title: yup.string().required().max(200),
  slug: yup.string().required().max(200),
  type: yup.string().oneOf(["percentage", "fixed"]).required("Type is required"),
  value: offerValue(true),
  productId: yup.string(),
  packId: yup.string(),
  startDate: yup.date(),
  endDate: yup.date().min(yup.ref("startDate"), "endDate must be after startDate"),
});

export const offerUpdateSchema = yup.object({
  title: yup.string().max(200),
  slug: yup.string().max(200),
  type: yup.string().oneOf(["percentage", "fixed"]),
  value: offerValue(false),
  productId: yup.string(),
  packId: yup.string(),
  startDate: yup.date(),
  endDate: yup.date(),
});

// --- Review schemas ---

export const reviewCreateSchema = yup.object({
  productId: yup.string().required("Product ID is required"),
  customerName: yup.string().max(200),
  rating: yup.number().integer("Rating must be integer").min(1).max(5).required("Rating is required"),
  title: yup.string().max(200),
  content: yup.string().max(2000),
  images: yup.array().of(yup.string()),
});

export const reviewUpdateSchema = yup.object({
  customerName: yup.string().max(200),
  rating: yup.number().integer().min(1).max(5),
  title: yup.string().max(200),
  content: yup.string().max(2000),
  images: yup.array().of(yup.string()),
  isPublished: yup.boolean(),
});

// --- DXN NADZ: International phone validator for Recruitment & Contact ---

const internationalPhoneTest = (value?: string | null): boolean => {
  if (!value) return false;
  const trimmed = value.trim();
  if (!/^\+?[\d\s()-]{7,25}$/.test(trimmed)) return false;
  const digits = trimmed.replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15;
};

const optionalDxnMemberTest = (value?: string | null): boolean => {
  if (value === null || value === undefined || value.trim() === "") return true;
  const compact = value.trim().replace(/[\s-]+/g, "");
  return /^[A-Za-z0-9]{5,24}$/.test(compact);
};

// --- DXN NADZ: Membership Lead (Recruitment & CRM) schemas ---

export const membershipLeadCreateSchema = yup.object({
  firstName: yup.string().trim().min(2, "First name is too short").max(100).required("First name is required"),
  lastName: yup.string().trim().min(2, "Last name is too short").max(100).required("Last name is required"),
  country: yup.string().trim().min(2, "Country is required").max(100).required("Country is required"),
  phone: yup
    .string()
    .required("Phone number is required")
    .test("intl-phone", "Invalid phone number", internationalPhoneTest),
  preferredContactMethod: yup
    .string()
    .oneOf(["whatsapp", "phone", "telegram", "email"], "Invalid preferred contact method")
    .required("Preferred contact method is required"),
  email: yup
    .string()
    .nullable()
    .optional()
    .transform((v) => (typeof v === "string" && v.trim() === "" ? undefined : v))
    .email("Invalid email address")
    .max(160),
  existingMembershipNumber: yup
    .string()
    .nullable()
    .optional()
    .max(32)
    .test("optional-dxn-id", "Invalid DXN membership number", optionalDxnMemberTest),
  message: yup.string().nullable().optional().max(2000),
  privacyConsent: yup
    .boolean()
    .required("Privacy consent is required")
    .oneOf([true], "You must consent to data processing to submit this form"),
  // Anti-spam honeypot: bots fill hidden 'website' inputs
  website: yup.string().optional().max(200),
  trafficSource: yup
    .object({
      source: yup.string().max(64),
      ref: yup.string().max(64),
      utmSource: yup.string().max(64),
      utmMedium: yup.string().max(64),
      utmCampaign: yup.string().max(80),
      landingPath: yup.string().max(200),
    })
    .optional(),
});

export const membershipLeadUpdateSchema = yup.object({
  status: yup
    .string()
    .oneOf(
      ["new", "contacted", "interested", "customer", "registered_member", "not_interested"],
      "Invalid lead status"
    )
    .optional(),
  officialMembershipNumber: yup
    .string()
    .nullable()
    .optional()
    .max(32)
    .test("optional-dxn-id", "Invalid DXN membership number", optionalDxnMemberTest),
  followUpDate: yup.date().nullable().optional(),
});

export const membershipLeadNoteSchema = yup.object({
  content: yup.string().trim().min(1, "Note cannot be empty").max(2000).required("Note content is required"),
});

export const membershipLeadCommSchema = yup.object({
  channel: yup
    .string()
    .oneOf(["whatsapp", "phone", "telegram", "email", "other"])
    .required("Channel is required"),
  summary: yup.string().trim().min(1, "Summary cannot be empty").max(2000).required("Summary is required"),
  outcome: yup.string().trim().max(300).optional(),
});

// --- DXN NADZ: Contact Message schemas ---

export const contactCreateSchema = yup
  .object({
    name: yup.string().trim().min(2, "Name is too short").max(150).required("Name is required"),
    phone: yup
      .string()
      .nullable()
      .optional()
      .test("optional-intl-phone", "Invalid phone number", (val) => {
        if (!val || val.trim() === "") return true;
        return internationalPhoneTest(val);
      }),
    email: yup
      .string()
      .nullable()
      .optional()
      .transform((v) => (typeof v === "string" && v.trim() === "" ? undefined : v))
      .email("Invalid email address")
      .max(160),
    subject: yup.string().trim().max(200).optional(),
    message: yup.string().trim().min(5, "Message is too short").max(3000).required("Message is required"),
    privacyConsent: yup
      .boolean()
      .required("Privacy consent is required")
      .oneOf([true], "Privacy consent is required"),
    website: yup.string().optional().max(200),
    trafficSource: yup
      .object({
        source: yup.string().max(64),
        ref: yup.string().max(64),
        landingPath: yup.string().max(200),
      })
      .optional(),
  })
  .test(
    "phone-or-email-required",
    "Please provide at least a phone number or an email address",
    (val) => {
      const hasPhone = Boolean(val?.phone && String(val.phone).trim().length > 0);
      const hasEmail = Boolean(val?.email && String(val.email).trim().length > 0);
      return hasPhone || hasEmail;
    }
  );

// --- DXN NADZ: Site Settings & Categories & CMS schemas ---

export const siteSettingsUpdateSchema = yup.object({
  brandName: yup.string().trim().max(80).optional(),
  sponsorMembershipNumber: yup
    .string()
    .nullable()
    .optional()
    .max(32)
    .test("optional-dxn-id", "Invalid sponsor DXN membership number", optionalDxnMemberTest),
  sponsorNameAr: yup.string().trim().max(120).optional(),
  sponsorNameFr: yup.string().trim().max(120).optional(),
  whatsappNumber: yup.string().trim().max(30).optional(),
  contactEmail: yup
    .string()
    .nullable()
    .optional()
    .transform((v) => (typeof v === "string" && v.trim() === "" ? undefined : v))
    .email("Invalid email address")
    .max(160),
  socialLinks: yup
    .object({
      facebook: yup.string().trim().max(500).optional(),
      instagram: yup.string().trim().max(500).optional(),
      tiktok: yup.string().trim().max(500).optional(),
      telegram: yup.string().trim().max(500).optional(),
      whatsapp: yup.string().trim().max(500).optional(),
    })
    .optional(),
  telegramNotificationsEnabled: yup.boolean().optional(),
  notifyOnNewOrder: yup.boolean().optional(),
  notifyOnNewLead: yup.boolean().optional(),
  notifyOnNewContact: yup.boolean().optional(),
  businessHoursAr: yup.string().trim().max(200).optional(),
  businessHoursFr: yup.string().trim().max(200).optional(),
});

export const categoryUpsertSchema = yup.object({
  slug: yup
    .string()
    .trim()
    .lowercase()
    .matches(/^[a-z0-9-]{2,64}$/, "Category slug must contain lowercase letters, numbers, or hyphens")
    .required("Category slug is required"),
  nameAr: yup.string().trim().min(2).max(120).required("Arabic name is required"),
  nameFr: yup.string().trim().min(2).max(120).required("French name is required"),
  descriptionAr: yup.string().trim().max(600).optional(),
  descriptionFr: yup.string().trim().max(600).optional(),
  sortOrder: yup.number().integer().min(0).max(10000).optional(),
  isActive: yup.boolean().optional(),
});

export const educationalArticleUpsertSchema = yup.object({
  slug: yup
    .string()
    .trim()
    .lowercase()
    .matches(/^[a-z0-9-]{2,120}$/, "Invalid article slug")
    .required("Slug is required"),
  category: yup
    .string()
    .oneOf(["ganoderma", "spirulina", "supplements", "nutrition", "usage", "faq"])
    .optional(),
  sortOrder: yup.number().integer().min(0).max(10000).optional(),
  isPublished: yup.boolean().optional(),
  readingMinutes: yup.number().integer().min(1).max(60).optional(),
  ar: yup
    .object({
      title: yup.string().trim().min(3).max(200).required(),
      summary: yup.string().trim().min(5).max(600).required(),
      scientificInfo: yup.string().trim().min(10).max(12000).required(),
      ingredientEvidence: yup.string().trim().max(8000).optional(),
      traditionalUses: yup.string().trim().max(8000).optional(),
      unprovenClaimsNotice: yup.string().trim().max(4000).optional(),
      usageAndStorage: yup.string().trim().max(6000).optional(),
      disclaimer: yup.string().trim().max(2000).optional(),
    })
    .required(),
  fr: yup
    .object({
      title: yup.string().trim().min(3).max(200).required(),
      summary: yup.string().trim().min(5).max(600).required(),
      scientificInfo: yup.string().trim().min(10).max(12000).required(),
      ingredientEvidence: yup.string().trim().max(8000).optional(),
      traditionalUses: yup.string().trim().max(8000).optional(),
      unprovenClaimsNotice: yup.string().trim().max(4000).optional(),
      usageAndStorage: yup.string().trim().max(6000).optional(),
      disclaimer: yup.string().trim().max(2000).optional(),
    })
    .required(),
});

export const faqUpsertSchema = yup.object({
  slug: yup
    .string()
    .trim()
    .lowercase()
    .matches(/^[a-z0-9-]{2,120}$/, "Invalid FAQ slug")
    .required("Slug is required"),
  category: yup
    .string()
    .oneOf(["company", "products", "ordering", "membership", "compliance"])
    .optional(),
  sortOrder: yup.number().integer().min(0).max(10000).optional(),
  isPublished: yup.boolean().optional(),
  ar: yup
    .object({
      question: yup.string().trim().min(3).max(400).required(),
      answer: yup.string().trim().min(5).max(4000).required(),
    })
    .required(),
  fr: yup
    .object({
      question: yup.string().trim().min(3).max(400).required(),
      answer: yup.string().trim().min(5).max(4000).required(),
    })
    .required(),
});
