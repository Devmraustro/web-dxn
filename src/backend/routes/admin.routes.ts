import { Router } from "express";
import {
  getDashboardStats,
  getRecentOrders,
  getRevenueStats,
  getTopProducts,
  getTopWilayas,
} from "../controllers/admin/dashboard.controller";
import { getAdminCatalog, getAdminProductById } from "../controllers/admin/catalog.controller";
import { getAdminCategories, upsertCategory } from "../controllers/category.controller";
import {
  addAdminLeadCommunication,
  addAdminLeadNote,
  exportAdminLeadsCsv,
  getAdminLeadById,
  getAdminLeads,
  updateAdminLead,
} from "../controllers/lead.controller";
import {
  getAdminContactMessages,
  updateAdminContactMessage,
} from "../controllers/contact.controller";
import {
  getAdminContent,
  upsertAdminArticle,
  upsertAdminContentBlock,
  upsertAdminFaq,
} from "../controllers/content.controller";
import {
  getAdminSettingsHandler,
  updateAdminSettingsHandler,
} from "../controllers/settings.controller";
import { authenticate, adminOnly } from "../middleware/auth.middleware";
import { validateRequest } from "../middleware/validateRequest.middleware";
import {
  categoryUpsertSchema,
  educationalArticleUpsertSchema,
  faqUpsertSchema,
  membershipLeadCommSchema,
  membershipLeadNoteSchema,
  membershipLeadUpdateSchema,
  siteSettingsUpdateSchema,
} from "../middleware/validationSchema";

const router = Router();

// All admin routes require authenticated admin/owner
router.use(authenticate);
router.use(adminOnly);

// Dashboard & Analytics
router.get("/dashboard/stats", getDashboardStats);
router.get("/dashboard/recent-orders", getRecentOrders);
router.get("/dashboard/revenue", getRevenueStats);
router.get("/dashboard/top-products", getTopProducts);
router.get("/dashboard/top-wilayas", getTopWilayas);

// Admin catalog & categories
router.get("/catalog", getAdminCatalog);
router.get("/products/:id", getAdminProductById);
router.get("/categories", getAdminCategories);
router.put("/categories", validateRequest(categoryUpsertSchema), upsertCategory);

// Admin CRM — Membership Leads (Phase 7)
router.get("/leads/export.csv", exportAdminLeadsCsv);
router.get("/leads", getAdminLeads);
router.get("/leads/:id", getAdminLeadById);
router.patch("/leads/:id", validateRequest(membershipLeadUpdateSchema), updateAdminLead);
router.post("/leads/:id/notes", validateRequest(membershipLeadNoteSchema), addAdminLeadNote);
router.post("/leads/:id/communications", validateRequest(membershipLeadCommSchema), addAdminLeadCommunication);

// Admin Contact Messages
router.get("/messages", getAdminContactMessages);
router.patch("/messages/:id", updateAdminContactMessage);

// Admin CMS — Articles, FAQs & Content Blocks (Phase 10)
router.get("/content", getAdminContent);
router.put("/content/articles/:slug", validateRequest(educationalArticleUpsertSchema), upsertAdminArticle);
router.put("/content/faqs/:slug", validateRequest(faqUpsertSchema), upsertAdminFaq);
router.put("/content/blocks/:key", upsertAdminContentBlock);

// Admin Site Settings, Notifications & Audit Trail (Phase 10 & Phase 11)
router.get("/settings", getAdminSettingsHandler);
router.put("/settings", validateRequest(siteSettingsUpdateSchema), updateAdminSettingsHandler);

export default router;
