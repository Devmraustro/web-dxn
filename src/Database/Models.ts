const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// ==========================================
// USER & AUTHENTICATION
// ==========================================

const userSchema = new Schema({
  email: { type: String, unique: true, required: true, lowercase: true },
  password: { type: String, required: true },
  role: { type: String, enum: ["owner", "admin", "staff", "support"], default: "staff" },
  name: { type: String },
  phone: { type: String },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  lastLogin: { type: Date },
  // Password reset: hashed token + expiry stored per user (multi-instance and
  // serverless friendly; never store the raw token).
  passwordResetTokenHash: { type: String },
  passwordResetExpiresAt: { type: Date },
}, { timestamps: true });

userSchema.index({ passwordResetTokenHash: 1 }, { unique: true, sparse: true });

const User = mongoose.model("User", userSchema);

// ==========================================
// CUSTOMER
// ==========================================

const customerSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User" },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  phone: { type: String, required: true },
  secondPhone: { type: String },
  email: { type: String, lowercase: true, trim: true },
  country: { type: String, default: "Algeria" },
  dxnMemberId: { type: String, default: null },
  wilaya: { type: String, required: true },
  commune: { type: String },
  address: { type: String },
  createdAt: { type: Date, default: Date.now },
  orders: [{ type: Schema.Types.ObjectId, ref: "Order" }],
}, { timestamps: true });

customerSchema.index({ phone: 1 });

const Customer = mongoose.model("Customer", customerSchema);

// ==========================================
// PRODUCT CATEGORY
// ==========================================

const productCategorySchema = new Schema({
  slug: { type: String, unique: true, required: true, lowercase: true, trim: true },
  nameAr: { type: String, required: true, trim: true },
  nameFr: { type: String, required: true, trim: true },
  descriptionAr: { type: String, default: "" },
  descriptionFr: { type: String, default: "" },
  sortOrder: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

productCategorySchema.index({ isActive: 1, sortOrder: 1 });

const ProductCategory = mongoose.model("ProductCategory", productCategorySchema);

// ==========================================
// PRODUCT
// ==========================================

const productSchema = new Schema({
  sku: { type: String, unique: true, required: true },
  slug: { type: String, unique: true, required: true },
  category: { type: String, default: "general", lowercase: true, trim: true },
  categoryId: { type: Schema.Types.ObjectId, ref: "ProductCategory", default: null },
  price: { type: Number, required: true, default: 0, min: 0 },
  compareAtPrice: { type: Number, min: 0 },
  image: { type: String },
  images: { type: [String], default: [] },
  isActive: { type: Boolean, default: true },
  isFeatured: { type: Boolean, default: false },
  sortOrder: { type: Number, default: 0 },
  stockQuantity: { type: Number, default: 0, min: 0 }, // Server-authoritative stock
  points: { type: Number, default: 0, min: 0 }, // DXN product points
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}, { timestamps: true });

productSchema.index({ isActive: 1, category: 1, sortOrder: 1 });

const productTranslationSchema = new Schema({
  productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
  language: { type: String, enum: ["ar", "fr"], required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  size: { type: String },
  specifications: { type: String },
  ingredients: { type: String },
  usageInstructions: { type: String },
  storageInstructions: { type: String },
  metaTitle: { type: String },
  metaDescription: { type: String },
}, { timestamps: true });

productTranslationSchema.index({ productId: 1, language: 1 }, { unique: true });

const ProductTranslation = mongoose.model("ProductTranslation", productTranslationSchema);

const Product = mongoose.model("Product", productSchema);

// ==========================================
// PACK
// ==========================================

const packSchema = new Schema({
  name: { type: String, required: true },
  slug: { type: String, unique: true, required: true },
  image: { type: String },
  price: { type: Number, required: true },
  compareAtPrice: { type: Number },
  isActive: { type: Boolean, default: true },
  isFeatured: { type: Boolean, default: false },
  sortOrder: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}, { timestamps: true });

const Pack = mongoose.model("Pack", packSchema);

const packItemSchema = new Schema({
  packId: { type: Schema.Types.ObjectId, ref: "Pack", required: true },
  productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
  quantity: { type: Number, default: 1 },
}, { timestamps: true, _id: false });

const PackItem = mongoose.model("PackItem", packItemSchema);

// ==========================================
// OFFER
// ==========================================

const offerSchema = new Schema({
  title: { type: String, required: true },
  slug: { type: String, unique: true, required: true },
  type: { type: String, enum: ["percentage", "fixed", "promotional"], required: true },
  value: { type: Number, required: true },
  isActive: { type: Boolean, default: true },
  startDate: { type: Date },
  endDate: { type: Date },
  isFeatured: { type: Boolean, default: false },
  sortOrder: { type: Number, default: 0 },
  productId: { type: Schema.Types.ObjectId, ref: "Product" },
  packId: { type: Schema.Types.ObjectId, ref: "Pack" },
  createdAt: { type: Date, default: Date.now },
}, { timestamps: true });

const Offer = mongoose.model("Offer", offerSchema);

// ==========================================
// ORDER
// ==========================================

const orderSchema = new Schema({
  orderNumber: { type: String, unique: true, required: true },
  customerId: { type: Schema.Types.ObjectId, ref: "Customer" },
  customerInfo: {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    phone: { type: String, required: true },
    secondPhone: { type: String },
    wilaya: { type: String, required: true },
    commune: { type: String },
    address: { type: String },
  },
  deliveryMethod: { type: String, enum: ["home", "office"], required: true },
  homeAddress: { type: String },
  wilaya: { type: String },
  commune: { type: String },
  address: { type: String },
  paymentMethod: { type: String, enum: ["cod", "baridimob"], required: true },
  paymentStatus: { type: String, enum: ["pending", "verified", "rejected", "completed"], default: "pending" },
  status: { type: String, enum: ["new", "pending_payment", "confirmed", "processing", "shipped", "delivered", "cancelled", "rejected"], default: "new" },
  subtotal: { type: Number, required: true },
  shippingFee: { type: Number, required: true },
  discount: { type: Number, default: 0 },
  total: { type: Number, required: true },
  items: [
    {
      productId: { type: Schema.Types.ObjectId, ref: "Product" },
      packId: { type: Schema.Types.ObjectId, ref: "Pack" },
      productName: { type: String, required: true },
      packName: { type: String },
      quantity: { type: Number, required: true, min: 1 },
      unitPrice: { type: Number, required: true },
      totalPrice: { type: Number, required: true },
    },
  ],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  internalNotes: { type: String },
  adminId: { type: Schema.Types.ObjectId, ref: "User" },
  // Optional customer DXN membership number (never mandatory; null when omitted; private to order/admin/Telegram)
  dxnMemberId: { type: String, default: null, trim: true },
  // Traffic source & referral attribution (?ref=facebook|instagram|tiktok|whatsapp, UTM params)
  trafficSource: {
    source: { type: String, default: "direct" },
    ref: { type: String, default: "" },
    utmSource: { type: String, default: "" },
    utmMedium: { type: String, default: "" },
    utmCampaign: { type: String, default: "" },
    landingPath: { type: String, default: "" },
  },
  // Opaque client idempotency key: unique (sparse) so duplicate submissions of
  // the same checkout cannot create two orders, across restarts/replicas.
  metadata: { type: Schema.Types.Mixed, default: {} },
}, { timestamps: true });

// Real-query indexes: dashboard lists orders sorted by creation and filters by
// status; admin top-product analytics unwinds line items; idempotency lookup.
orderSchema.index({ createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ "items.productId": 1 });
orderSchema.index({ "trafficSource.source": 1, createdAt: -1 });
orderSchema.index({ dxnMemberId: 1 }, { sparse: true });
orderSchema.index({ "metadata.idempotencyKey": 1 }, { unique: true, sparse: true });

const Order = mongoose.model("Order", orderSchema);

// ==========================================
// SHIPPING ZONES / WILAYAS
// ==========================================

const wilayaSchema = new Schema({
  code: { type: Number },
  name: { type: String, required: true },
  nameFr: { type: String },
  nameAr: { type: String },
  aliases: [{ type: String }],
  reformYear: { type: Number },
  parentCode: { type: Number, default: null },
  parentName: { type: String, default: null },
  coverageStatus: {
    type: String,
    enum: ["served", "via_parent_wilaya", "confirm_by_phone", "unserved"],
    default: "served",
  },
  homeDeliverySupported: { type: Boolean, default: true },
  officeDeliverySupported: { type: Boolean, default: true },
  coverageNoteAr: { type: String, default: "" },
  coverageNoteFr: { type: String, default: "" },
  isActive: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
}, { timestamps: true });

// Lookup by official code/name is the hot path for shipping rate resolution.
wilayaSchema.index({ code: 1 }, { unique: true, sparse: true });
wilayaSchema.index({ name: 1 }, { unique: true, sparse: true });

const Wilaya = mongoose.model("Wilaya", wilayaSchema);

const shippingRateSchema = new Schema({
  wilayaId: { type: Schema.Types.ObjectId, ref: "Wilaya", required: true },
  deliveryMethod: { type: String, enum: ["home", "office"], required: true },
  price: { type: Number, required: true },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

const ShippingRate = mongoose.model("ShippingRate", shippingRateSchema);

// ==========================================
// REVIEWS / TESTIMONIALS
// ==========================================

const reviewSchema = new Schema({
  productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
  customerName: { type: String },
  customerId: { type: Schema.Types.ObjectId, ref: "Customer" },
  rating: { type: Number, min: 1, max: 5 },
  title: { type: String },
  content: { type: String },
  images: [{ type: String }],
  isPublished: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
}, { timestamps: true });

const Review = mongoose.model("Review", reviewSchema);

// ==========================================
// AI KNOWLEDGE
// ==========================================

const aiKnowledgeSchema = new Schema({
  key: { type: String, required: true, unique: true },
  category: { type: String, required: true },
  question: { type: String, required: true },
  answer: { type: String, required: true },
  language: { type: String, enum: ["ar", "fr"], default: "ar" },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

const AIKnowledge = mongoose.model("AIKnowledge", aiKnowledgeSchema);

// ==========================================
// CONVERSATIONS / MESSAGES
// ==========================================

const conversationSchema = new Schema({
  customerId: { type: Schema.Types.ObjectId, ref: "Customer" },
  platform: { type: String, enum: ["instagram", "facebook"], required: true },
  platformId: { type: String },
  lastMessage: { type: String },
  lastActivity: { type: Date },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

const Conversation = mongoose.model("Conversation", conversationSchema);

const messageSchema = new Schema({
  conversationId: { type: Schema.Types.ObjectId, ref: "Conversation", required: true },
  role: { type: String, enum: ["user", "assistant", "system"], required: true },
  content: { type: String, required: true },
}, { timestamps: true });

const Message = mongoose.model("Message", messageSchema);

// ==========================================
// SOCIAL ACCOUNTS
// ==========================================

const socialAccountSchema = new Schema({
  platform: { type: String, enum: ["instagram", "facebook"], required: true },
  platformId: { type: String, required: true },
  username: { type: String },
  accessToken: { type: String },
  refreshToken: { type: String },
  expiresAt: { type: Date },
  isConnected: { type: Boolean, default: true },
  connectedAt: { type: Date, default: Date.now },
}, { timestamps: true });

const SocialAccount = mongoose.model("SocialAccount", socialAccountSchema);

// ==========================================
// WEBHOOK EVENTS
// ==========================================

const webhookEventSchema = new Schema({
  source: { type: String, enum: ["telegram", "meta", "stripe", "baridimob"], required: true },
  event: { type: String, required: true },
  payload: { type: Schema.Types.Mixed, required: true },
  status: { type: String, enum: ["received", "processed", "error"], default: "received" },
  processedAt: { type: Date },
  /**
   * Durable idempotency key (Phase 23): unique per processed event so that a
   * Meta retry redelivering the same webhook is recognized across restarts and
   * replicas. Sparse because only webhook sources that carry a stable key
   * (e.g. "meta") populate it.
   */
  dedupKey: { type: String, unique: true, sparse: true },
}, { timestamps: true });

// Compound index for querying a source's recent processed events.
webhookEventSchema.index({ source: 1, createdAt: -1 });

const WebhookEvent = mongoose.model("WebhookEvent", webhookEventSchema);

// ==========================================
// ADMIN NOTES
// ==========================================

const adminNoteSchema = new Schema({
  title: { type: String, required: true },
  message: { type: String, required: true },
  type: { type: String, enum: ["info", "warning", "error", "success"], default: "info" },
  relatedModel: { type: String },
  relatedId: { type: Schema.Types.ObjectId },
  createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  createdAt: { type: Date, default: Date.now },
}, { timestamps: true });

const AdminNote = mongoose.model("AdminNote", adminNoteSchema);

// ==========================================
// MEMBERSHIP LEADS (DXN NADZ RECRUITMENT & CRM)
// ==========================================

const membershipLeadSchema = new Schema({
  leadReference: { type: String, unique: true, required: true },
  firstName: { type: String, required: true, trim: true, maxlength: 100 },
  lastName: { type: String, required: true, trim: true, maxlength: 100 },
  country: { type: String, required: true, trim: true, maxlength: 100 },
  phone: { type: String, required: true, trim: true, maxlength: 30 },
  preferredContactMethod: {
    type: String,
    enum: ["whatsapp", "phone", "telegram", "email"],
    required: true,
    default: "whatsapp",
  },
  email: { type: String, lowercase: true, trim: true, maxlength: 160, default: "" },
  existingMembershipNumber: { type: String, trim: true, maxlength: 32, default: null },
  sponsorMembershipNumber: { type: String, trim: true, maxlength: 32, default: null },
  message: { type: String, trim: true, maxlength: 2000, default: "" },
  privacyConsent: { type: Boolean, required: true, default: false },
  privacyConsentAt: { type: Date, default: Date.now },
  status: {
    type: String,
    enum: ["new", "contacted", "interested", "customer", "registered_member", "not_interested"],
    default: "new",
  },
  officialMembershipNumber: { type: String, trim: true, maxlength: 32, default: null },
  registeredAt: { type: Date, default: null },
  followUpDate: { type: Date, default: null },
  assignedTo: { type: Schema.Types.ObjectId, ref: "User", default: null },
  trafficSource: {
    source: { type: String, default: "direct" },
    ref: { type: String, default: "" },
    utmSource: { type: String, default: "" },
    utmMedium: { type: String, default: "" },
    utmCampaign: { type: String, default: "" },
    landingPath: { type: String, default: "" },
  },
  notes: [
    {
      content: { type: String, required: true, maxlength: 2000 },
      createdBy: { type: Schema.Types.ObjectId, ref: "User" },
      authorName: { type: String, default: "" },
      createdAt: { type: Date, default: Date.now },
    },
  ],
  communicationHistory: [
    {
      channel: {
        type: String,
        enum: ["whatsapp", "phone", "telegram", "email", "other"],
        default: "phone",
      },
      summary: { type: String, required: true, maxlength: 2000 },
      outcome: { type: String, maxlength: 300, default: "" },
      createdBy: { type: Schema.Types.ObjectId, ref: "User" },
      authorName: { type: String, default: "" },
      createdAt: { type: Date, default: Date.now },
    },
  ],
}, { timestamps: true });

membershipLeadSchema.index({ createdAt: -1 });
membershipLeadSchema.index({ status: 1, createdAt: -1 });
membershipLeadSchema.index({ country: 1, createdAt: -1 });
membershipLeadSchema.index({ "trafficSource.source": 1, createdAt: -1 });
membershipLeadSchema.index({ phone: 1 });

const MembershipLead = mongoose.model("MembershipLead", membershipLeadSchema);

// ==========================================
// CONTACT MESSAGES
// ==========================================

const contactMessageSchema = new Schema({
  reference: { type: String, unique: true, required: true },
  name: { type: String, required: true, trim: true, maxlength: 150 },
  phone: { type: String, trim: true, maxlength: 30, default: "" },
  email: { type: String, lowercase: true, trim: true, maxlength: 160, default: "" },
  subject: { type: String, trim: true, maxlength: 200, default: "" },
  message: { type: String, required: true, trim: true, maxlength: 3000 },
  privacyConsent: { type: Boolean, required: true, default: false },
  status: {
    type: String,
    enum: ["new", "read", "replied", "archived"],
    default: "new",
  },
  adminNotes: { type: String, maxlength: 2000, default: "" },
  trafficSource: {
    source: { type: String, default: "direct" },
    ref: { type: String, default: "" },
    landingPath: { type: String, default: "" },
  },
}, { timestamps: true });

contactMessageSchema.index({ status: 1, createdAt: -1 });
contactMessageSchema.index({ createdAt: -1 });

const ContactMessage = mongoose.model("ContactMessage", contactMessageSchema);

// ==========================================
// NOTIFICATION LOGS (TELEGRAM RELIABILITY & DEDUP)
// ==========================================

const notificationLogSchema = new Schema({
  dedupKey: { type: String, unique: true, sparse: true },
  eventType: {
    type: String,
    enum: ["new_order", "order_status", "new_lead", "new_contact", "escalation"],
    required: true,
  },
  referenceId: { type: String, required: true },
  delivered: { type: Boolean, default: false },
  skipped: { type: Boolean, default: false },
  attempts: { type: Number, default: 1 },
  httpStatus: { type: Number },
  errorSummary: { type: String, maxlength: 500, default: "" },
}, { timestamps: true });

notificationLogSchema.index({ eventType: 1, createdAt: -1 });
notificationLogSchema.index({ referenceId: 1 });

const NotificationLog = mongoose.model("NotificationLog", notificationLogSchema);

// ==========================================
// SITE SETTINGS (PUBLIC SAFE CONFIG + ADMIN MANAGEMENT)
// ==========================================

const siteSettingsSchema = new Schema({
  key: { type: String, unique: true, required: true, default: "global" },
  brandName: { type: String, default: "DXN NADZ", trim: true, maxlength: 80 },
  sponsorMembershipNumber: { type: String, trim: true, maxlength: 32, default: "" },
  sponsorNameAr: { type: String, trim: true, maxlength: 120, default: "" },
  sponsorNameFr: { type: String, trim: true, maxlength: 120, default: "" },
  whatsappNumber: { type: String, trim: true, maxlength: 30, default: "" },
  contactEmail: { type: String, trim: true, maxlength: 160, default: "" },
  socialLinks: {
    facebook: { type: String, trim: true, maxlength: 500, default: "" },
    instagram: { type: String, trim: true, maxlength: 500, default: "" },
    tiktok: { type: String, trim: true, maxlength: 500, default: "" },
    telegram: { type: String, trim: true, maxlength: 500, default: "" },
    whatsapp: { type: String, trim: true, maxlength: 500, default: "" },
  },
  telegramNotificationsEnabled: { type: Boolean, default: true },
  notifyOnNewOrder: { type: Boolean, default: true },
  notifyOnNewLead: { type: Boolean, default: true },
  notifyOnNewContact: { type: Boolean, default: true },
  businessHoursAr: { type: String, maxlength: 200, default: "" },
  businessHoursFr: { type: String, maxlength: 200, default: "" },
  updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true });

const SiteSettings = mongoose.model("SiteSettings", siteSettingsSchema);

// ==========================================
// EDUCATIONAL ARTICLES & FAQ & CONTENT BLOCKS (CMS)
// ==========================================

const educationalArticleSchema = new Schema({
  slug: { type: String, unique: true, required: true, lowercase: true, trim: true },
  category: {
    type: String,
    enum: ["ganoderma", "spirulina", "supplements", "nutrition", "usage", "faq"],
    default: "supplements",
  },
  sortOrder: { type: Number, default: 0 },
  isPublished: { type: Boolean, default: true },
  readingMinutes: { type: Number, default: 4, min: 1, max: 60 },
  ar: {
    title: { type: String, required: true, maxlength: 200 },
    summary: { type: String, required: true, maxlength: 600 },
    scientificInfo: { type: String, required: true, maxlength: 12000 },
    ingredientEvidence: { type: String, maxlength: 8000, default: "" },
    traditionalUses: { type: String, maxlength: 8000, default: "" },
    unprovenClaimsNotice: { type: String, maxlength: 4000, default: "" },
    usageAndStorage: { type: String, maxlength: 6000, default: "" },
    disclaimer: { type: String, maxlength: 2000, default: "" },
  },
  fr: {
    title: { type: String, required: true, maxlength: 200 },
    summary: { type: String, required: true, maxlength: 600 },
    scientificInfo: { type: String, required: true, maxlength: 12000 },
    ingredientEvidence: { type: String, maxlength: 8000, default: "" },
    traditionalUses: { type: String, maxlength: 8000, default: "" },
    unprovenClaimsNotice: { type: String, maxlength: 4000, default: "" },
    usageAndStorage: { type: String, maxlength: 6000, default: "" },
    disclaimer: { type: String, maxlength: 2000, default: "" },
  },
  updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true });

educationalArticleSchema.index({ isPublished: 1, sortOrder: 1 });

const EducationalArticle = mongoose.model("EducationalArticle", educationalArticleSchema);

const faqItemSchema = new Schema({
  slug: { type: String, unique: true, required: true, lowercase: true, trim: true },
  category: {
    type: String,
    enum: ["company", "products", "ordering", "membership", "compliance"],
    default: "company",
  },
  sortOrder: { type: Number, default: 0 },
  isPublished: { type: Boolean, default: true },
  ar: {
    question: { type: String, required: true, maxlength: 400 },
    answer: { type: String, required: true, maxlength: 4000 },
  },
  fr: {
    question: { type: String, required: true, maxlength: 400 },
    answer: { type: String, required: true, maxlength: 4000 },
  },
  updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true });

faqItemSchema.index({ isPublished: 1, category: 1, sortOrder: 1 });

const FaqItem = mongoose.model("FaqItem", faqItemSchema);

const contentBlockSchema = new Schema({
  key: { type: String, unique: true, required: true, lowercase: true, trim: true },
  ar: { type: Schema.Types.Mixed, default: {} },
  fr: { type: Schema.Types.Mixed, default: {} },
  founderPortraitUrl: { type: String, default: "" },
  updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true });

const ContentBlock = mongoose.model("ContentBlock", contentBlockSchema);

// ==========================================
// ADMIN AUDIT LOGS
// ==========================================

const auditLogSchema = new Schema({
  actorId: { type: Schema.Types.ObjectId, ref: "User" },
  actorEmail: { type: String, default: "" },
  actorRole: { type: String, default: "" },
  action: { type: String, required: true, maxlength: 120 },
  resourceType: { type: String, required: true, maxlength: 80 },
  resourceId: { type: String, default: "", maxlength: 120 },
  summary: { type: String, maxlength: 500, default: "" },
  ip: { type: String, maxlength: 64, default: "" },
}, { timestamps: true });

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ actorId: 1, createdAt: -1 });
auditLogSchema.index({ resourceType: 1, createdAt: -1 });

const AuditLog = mongoose.model("AuditLog", auditLogSchema);

module.exports = {
  User, Customer, ProductCategory, Product, ProductTranslation,
  Pack, PackItem,
  Offer,
  Order,
  Wilaya, ShippingRate,
  Review,
  AIKnowledge, Conversation, Message, SocialAccount, WebhookEvent,
  AdminNote,
  MembershipLead,
  ContactMessage,
  NotificationLog,
  SiteSettings,
  EducationalArticle,
  FaqItem,
  ContentBlock,
  AuditLog,
};

// Typed named exports so the rest of the TypeScript codebase can import
// these models as `import { Order } from "../../Database/Models"`.
export {
  User, Customer, ProductCategory, Product, ProductTranslation,
  Pack, PackItem,
  Offer,
  Order,
  Wilaya, ShippingRate,
  Review,
  AIKnowledge, Conversation, Message, SocialAccount, WebhookEvent,
  AdminNote,
  MembershipLead,
  ContactMessage,
  NotificationLog,
  SiteSettings,
  EducationalArticle,
  FaqItem,
  ContentBlock,
  AuditLog,
};