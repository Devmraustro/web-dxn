import fs from "fs";
import path from "path";
import crypto from "crypto";

const UPLOAD_DIR = path.resolve(
  process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads")
);
const STORAGE_PROVIDER = (process.env.STORAGE_PROVIDER || "local") as
  | "local"
  | "cloudinary";

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

function getImageUrl(filename: string): string {
  const baseUrl = process.env.BASE_URL || "http://localhost:5000";
  return `${baseUrl}/uploads/${filename}`;
}

export interface StorageProvider {
  upload(file: Express.Multer.File): Promise<string>;
  delete(url: string): Promise<void>;
}

export class LocalStorageProvider implements StorageProvider {
  async upload(file: Express.Multer.File): Promise<string> {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeExt = [".jpg", ".jpeg", ".png", ".gif", ".webp"].includes(ext)
      ? ext
      : ".bin";
    const filename = `${crypto.randomUUID()}${safeExt}`;
    const filepath = path.join(UPLOAD_DIR, filename);
    fs.writeFileSync(filepath, file.buffer);
    return getImageUrl(filename);
  }

  async delete(url: string): Promise<void> {
    const filename = url.split("/uploads/").pop();
    if (!filename) return;
    const filepath = path.join(UPLOAD_DIR, filename);
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
    }
  }
}

export class CloudinaryStorageProvider implements StorageProvider {
  private cloudName = process.env.CLOUDINARY_CLOUD_NAME || "";
  private apiKey = process.env.CLOUDINARY_API_KEY || "";
  private apiSecret = process.env.CLOUDINARY_API_SECRET || "";

  async upload(file: Express.Multer.File): Promise<string> {
    if (!this.cloudName || !this.apiKey || !this.apiSecret) {
      throw new Error(
        "Cloudinary credentials not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET."
      );
    }
    const { writeFileSync } = await import("fs");
    const ext = path.extname(file.originalname).toLowerCase();
    const tmpPath = path.join((await import("os")).tmpdir(), `${crypto.randomUUID()}${ext}`);
    writeFileSync(tmpPath, file.buffer);
    const params: Record<string, any> = {
      timestamp: Math.round(Date.now() / 1000),
      api_key: this.apiKey,
    };
    const sigResult = await this.getSignature(params);
    const upResult = await this.uploadToCloudinary(tmpPath, sigResult);
    fs.unlinkSync(tmpPath);
    return upResult;
  }

  private async getSignature(params: Record<string, any>): Promise<string> {
    const { sign } = await import("crypto");
    const sortedKeys = Object.keys(params).sort();
    const str = sortedKeys.map((k) => `${k}=${params[k]}`).join("&");
    const sig = sign("sha256", str + this.apiSecret, this.apiSecret);
    return sig.toString("hex");
  }

  private async uploadToCloudinary(tmpPath: string, signature: string): Promise<string> {
    const FormData = (await import("form-data")).default;
    const https = await import("https");
    return new Promise((resolve, reject) => {
      const form = new FormData();
      form.append("file", fs.createReadStream(tmpPath));
      form.append("api_key", this.apiKey);
      form.append("timestamp", String(Math.round(Date.now() / 1000)));
      form.append("signature", signature);
      const options = {
        hostname: "api.cloudinary.com",
        path: `/v1_1/${this.cloudName}/image/upload`,
        method: "POST",
        headers: form.getHeaders(),
      };
      const req = https.request(options, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const parsed = JSON.parse(data);
            resolve(parsed.secure_url || parsed.url);
          } catch {
            reject(new Error("Cloudinary response parse failed"));
          }
        });
      });
      req.on("error", reject);
      form.pipe(req);
    });
  }

  async delete(_url: string): Promise<void> {}
}

let _provider: StorageProvider | null = null;

export function getStorageProvider(): StorageProvider {
  if (!_provider) {
    _provider =
      STORAGE_PROVIDER === "cloudinary"
        ? new CloudinaryStorageProvider()
        : new LocalStorageProvider();
  }
  return _provider;
}
