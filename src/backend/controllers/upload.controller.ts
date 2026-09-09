import { Request, Response } from "express";
import { getStorageProvider } from "../config/storage";

export const uploadImage = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ message: "No file uploaded" });
      return;
    }

    const provider = getStorageProvider();
    const url = await provider.upload(req.file);

    res.json({
      success: true,
      data: { url, filename: req.file.originalname, size: req.file.size },
    });
  } catch (error: any) {
    console.error("Upload image error:", error.message);
    res.status(500).json({ message: "Upload failed" });
  }
};

export const uploadImages = async (req: Request, res: Response) => {
  try {
    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      res.status(400).json({ message: "No files uploaded" });
      return;
    }

    const provider = getStorageProvider();
    const results = await Promise.all(
      (req.files as Express.Multer.File[]).map(async (file) => {
        const url = await provider.upload(file);
        return { url, filename: file.originalname, size: file.size };
      })
    );

    res.json({ success: true, data: results });
  } catch (error: any) {
    console.error("Upload images error:", error.message);
    res.status(500).json({ message: "Upload failed" });
  }
};

export const deleteImage = async (req: Request, res: Response) => {
  try {
    const { url } = req.body;

    if (!url || typeof url !== "string") {
      res.status(400).json({ message: "URL is required" });
      return;
    }

    const allowedBase =
      process.env.BASE_URL || "http://localhost:5000";
    if (!url.startsWith(allowedBase + "/uploads/") &&
        !url.startsWith("https://res.cloudinary.com/")) {
      res.status(400).json({ message: "Invalid image URL" });
      return;
    }

    const provider = getStorageProvider();
    await provider.delete(url);

    res.json({ success: true, message: "Image deleted" });
  } catch (error: any) {
    console.error("Delete image error:", error.message);
    res.status(500).json({ message: "Delete failed" });
  }
};
