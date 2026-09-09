import * as yup from "yup";

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
});

const productCreateFields = {
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
  slug: yup.string().required("Slug is required").max(200),
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
    .oneOf(["cod", "baridimob"], "Invalid payment method")
    .required("Payment method is required"),
  confirmed: yup.boolean().required("Order must be confirmed").oneOf([true], "Order must be confirmed"),
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