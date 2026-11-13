import { Router } from "express";
import { getPublicArticleBySlug, getPublicContent } from "../controllers/content.controller";

const router = Router();

router.get("/public", getPublicContent);
router.get("/articles/:slug", getPublicArticleBySlug);

export default router;
