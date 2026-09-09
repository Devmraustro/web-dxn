import { Router } from "express";
import { authenticate, adminOnly } from "../middleware/auth.middleware";
import { uploadImage, uploadImages, deleteImage } from "../controllers/upload.controller";

const router = Router();

router.post(
  "/image",
  authenticate,
  adminOnly,
  uploadImage,
  (req, res) => {
    if (res.headersSent) return;
    res.status(500).json({ message: "Upload handler error" });
  }
);

router.post(
  "/images",
  authenticate,
  adminOnly,
  uploadImages,
  (req, res) => {
    if (res.headersSent) return;
    res.status(500).json({ message: "Upload handler error" });
  }
);

router.delete(
  "/image",
  authenticate,
  adminOnly,
  deleteImage
);

export default router;
