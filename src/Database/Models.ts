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
  wilaya: { type: String, required: true },
  commune: { type: String },
  address: { type: String },
  createdAt: { type: Date, default: Date.now },
  orders: [{ type: Schema.Types.ObjectId, ref: "Order" }],
}, { timestamps: true });

const Customer = mongoose.model("Customer", customerSchema);

// ==========================================
// PRODUCT
// ==========================================

const productSchema = new Schema({
  sku: { type: String, unique: true, required: true },
  slug: { type: String, unique: true, required: true },
  price: { type: Number, required: true, default: 0, min: 0 },
  compareAtPrice: { type: Number, min: 0 },
  image: { type: String },
  images: { type: [String], default: [] },
  isActive: { type: Boolean, default: true },
  isFeatured: { type: Boolean, default: false },
  sortOrder: { type: Number, default: 0 },
  stockQuantity: { type: Number, default: 0, min: 0 }, // Server-authoritative stock
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}, { timestamps: true });

const productTranslationSchema = new Schema({
  productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
  language: { type: String, enum: ["ar", "fr"], required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  size: { type: String },
  specifications: { type: String },
  metaTitle: { type: String },
  metaDescription: { type: String },
}, { timestamps: true });

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
  // Opaque client idempotency key: unique (sparse) so duplicate submissions of
  // the same checkout cannot create two orders, across restarts/replicas.
  metadata: { type: Schema.Types.Mixed, default: {} },
}, { timestamps: true });

// Real-query indexes: dashboard lists orders sorted by creation and filters by
// status; admin top-product analytics unwinds line items; idempotency lookup.
orderSchema.index({ createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ "items.productId": 1 });
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

module.exports = {
  User, Customer, Product, ProductTranslation,
  Pack, PackItem,
  Offer,
  Order,
  Wilaya, ShippingRate,
  Review,
  AIKnowledge, Conversation, Message, SocialAccount, WebhookEvent,
  AdminNote
};

// Typed named exports so the rest of the TypeScript codebase can import
// these models as `import { Order } from "../../Database/Models"`.
export {
  User, Customer, Product, ProductTranslation,
  Pack, PackItem,
  Offer,
  Order,
  Wilaya, ShippingRate,
  Review,
  AIKnowledge, Conversation, Message, SocialAccount, WebhookEvent,
  AdminNote,
};