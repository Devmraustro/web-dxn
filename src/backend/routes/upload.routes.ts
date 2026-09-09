import { Router } from "express";
import { authenticate, adminOnly } from "../middleware/auth.middleware";
import { uploadImage, uploadImages, deleteImage } from "../controllers/upload.controller";
import {
  uploadImage as multerUploadImage,
  uploadImages as multerUploadImages,
} from "../middleware/upload.middleware";

const router = Router();

// The multer middleware (memory storage + extension/declared-MIME checks) MUST
// run before the controller, which reads req.file / req.files and additionally
// verifies the file's magic bytes (content signature) before anything is
// stored. Multer/validation errors flow to the central error middleware.
router.post(
  "/image",
  authenticate,
  adminOnly,
  multerUploadImage,
  uploadImage
);

router.post(
  "/images",
  authenticate,
  adminOnly,
  multerUploadImages,
  uploadImages
);

router.delete(
  "/image",
  authenticate,
  adminOnly,
  deleteImage
);

export default router;
