import { Router } from "express";
import { createMembershipLead } from "../controllers/lead.controller";
import { publicFormRateLimiter } from "../middleware/security.middleware";
import { validateRequest } from "../middleware/validateRequest.middleware";
import { membershipLeadCreateSchema } from "../middleware/validationSchema";

const router = Router();

// Public recruitment form submission (rate-limited + validated + honeypot-protected)
router.post("/", publicFormRateLimiter, validateRequest(membershipLeadCreateSchema), createMembershipLead);

export default router;
