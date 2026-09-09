import { Request, Response } from "express";
import { getStorageProvider, isSafeImageUrl } from "../config/storage";
import { imageSignatureMismatch } from "../middleware/upload.middleware";

/** Validate a buffered file against its declared MIME type before storing. */
const checkSignature = (file: Express.Multer.File): string | null =>
  imageSignatureMismatch(file.mimetype, file.buffer);

export const uploadImage = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ message: "No file uploaded" });
      return;
    }

    // Multer only checks extension + declared MIME in its fileFilter (which
    // runs before the buffer exists); verify the actual bytes now.
    const mismatch = checkSignature(req.file);
    if (mismatch) {
      res.status(400).json({ message: mismatch });
      return;
    }

    const provider = getStorageProvider();
    const url = await provider.upload(req.file);

    res.json({
      success: true,
      data: { url, filename: req.file.originalname, size: req.file.size },
    });
  } catch (error: any) {
    // Never echo internal error strings (filesystem paths, provider config) to
    // the client; details stay server-side in the logs.
    console.error("Upload image error:", error?.message || error);
    res.status(500).json({ message: "Upload failed" });
  }
};

export const uploadImages = async (req: Request, res: Response) => {
  try {
    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      res.status(400).json({ message: "No files uploaded" });
      return;
    }

    const files = req.files as Express.Multer.File[];

    // Validate EVERY file's content signature before storing ANY file, so a
    // bad file in the batch cannot leave partially-stored uploads behind.
    for (const file of files) {
      const mismatch = checkSignature(file);
      if (mismatch) {
        res.status(400).json({ message: `${mismatch} (${file.originalname || "file"})` });
        return;
      }
    }

    const provider = getStorageProvider();
    const results = await Promise.all(
      files.map(async (file) => {
        const url = await provider.upload(file);
        return { url, filename: file.originalname, size: file.size };
      })
    );

    res.json({ success: true, data: results });
  } catch (error: any) {
    console.error("Upload images error:", error?.message || error);
    res.status(500).json({ message: "Upload failed" });
  }
};

export const deleteImage = async (req: Request, res: Response) => {
  try {
    const { url } = req.body;
    const allowedBase = (process.env.BASE_URL || "http://localhost:5000").replace(/\/+$/, "");

    if (!url || typeof url !== "string" || !isSafeImageUrl(url, allowedBase)) {
      res.status(400).json({ message: "Invalid image URL" });
      return;
    }

    const provider = getStorageProvider();
    await provider.delete(url);

    res.json({ success: true, message: "Image deleted" });
  } catch (error: any) {
    console.error("Delete image error:", error?.message || error);
    res.status(500).json({ message: "Delete failed" });
  }
};
