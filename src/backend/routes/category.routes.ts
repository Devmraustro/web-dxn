import { Router } from "express";
import { getPublicCategories, upsertCategory } from "../controllers/category.controller";
import { authenticate, adminOnly } from "../middleware/auth.middleware";
import { validateRequest } from "../middleware/validateRequest.middleware";
import { categoryUpsertSchema } from "../middleware/validationSchema";

const router = Router();

router.get("/", getPublicCategories);
router.post("/", authenticate, adminOnly, validateRequest(categoryUpsertSchema), upsertCategory);

export default router;
