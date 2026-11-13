import { Router } from "express";
import { getPublicSettingsHandler } from "../controllers/settings.controller";

const router = Router();

router.get("/public", getPublicSettingsHandler);

export default router;
