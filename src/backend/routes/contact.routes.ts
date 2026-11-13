import { Router } from "express";
import { createContactMessage } from "../controllers/contact.controller";
import { publicFormRateLimiter } from "../middleware/security.middleware";
import { validateRequest } from "../middleware/validateRequest.middleware";
import { contactCreateSchema } from "../middleware/validationSchema";

const router = Router();

router.post("/", publicFormRateLimiter, validateRequest(contactCreateSchema), createContactMessage);

export default router;
