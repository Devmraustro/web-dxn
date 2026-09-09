import { Router } from "express";
import { authenticate, adminOnly } from "../middleware/auth.middleware";
import { uploadImage, uploadImages, deleteImage } from "../controllers/upload.controller";
import {
  uploadImage as multerUploadImage,
  uploadImages as multerUploadImages,
} from "../middleware/upload.middleware";

const router = Router();

// The multer middleware (memory storage + MIME/magic-byte checks) MUST run
// before the controller, which reads req.file / req.files.
router.post(
  "/image",
  authenticate,
  adminOnly,
  multerUploadImage,
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
  multerUploadImages,
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
