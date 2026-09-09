import fs from "fs";
import path from "path";
import crypto from "crypto";
import https from "https";

const UPLOAD_DIR = path.resolve(
  process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads")
);

const STORAGE_PROVIDER = (process.env.STORAGE_PROVIDER || "local") as "local" | "cloudinary";

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

/** Allowed file extensions (must match upload.middleware magic-byte checks). */
const SAFE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp"]);

/** Local filenames are always a random UUID + a safe extension. */
const LOCAL_FILENAME_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|gif|webp)$/i;

export const isSafeLocalFilename = (name: string): boolean => LOCAL_FILENAME_RE.test(name);

/**
 * URL-level safety check for the admin delete-image endpoint.
 *
 * Accepted:
 *  - Cloudinary URLs (https://res.cloudinary.com/...)
 *  - local `/uploads/<filename>` URLs where <filename> is a SINGLE plain
 *    filename segment (no slashes/backslashes, no traversal, no query/hash).
 *
 * The physical delete is still gated by `isSafeLocalFilename` (UUID names
 * only), so allowing any plain single-segment name here only means the API
 * returns 200/no-op for files the server could not have generated itself —
 * it cannot be used to delete anything outside the uploads dir.
 */
export const isSafeImageUrl = (url: string, baseUrl: string): boolean => {
  if (!url || typeof url !== "string") return false;
  // Path-traversal / encoded traversal attempts are never valid URLs.
  if (url.includes("..") || url.includes("\\") || /%2e|%00|%2f/i.test(url)) return false;
  if (/^https:\/\/res\.cloudinary\.com\//.test(url)) return true;
  const prefix = `${baseUrl.replace(/\/+$/, "")}/uploads/`;
  if (!url.startsWith(prefix)) return false;
  const rest = url.slice(prefix.length);
  // Exactly one filename segment, no sub-paths or separators.
  if (!rest || rest.includes("/") || rest.includes("?")) return false;
  return true;
};

export interface StorageProvider {
  upload(file: Express.Multer.File): Promise<string>;
  delete(url: string): Promise<void>;
}

function getImageUrl(filename: string): string {
  const baseUrl = (process.env.BASE_URL || "http://localhost:5000").replace(/\/+$/, "");
  return `${baseUrl}/uploads/${filename}`;
}

export class LocalStorageProvider implements StorageProvider {
  async upload(file: Express.Multer.File): Promise<string> {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeExt = SAFE_EXTENSIONS.has(ext) ? ext : ".jpg";
    const filename = `${crypto.randomUUID()}${safeExt}`;
    const filepath = path.join(UPLOAD_DIR, filename);
    fs.writeFileSync(filepath, file.buffer);
    return getImageUrl(filename);
  }

  async delete(url: string): Promise<void> {
    const prefix = `${(process.env.BASE_URL || "http://localhost:5000").replace(/\/+$/, "")}/uploads/`;
    if (!url.startsWith(prefix)) return;
    const filename = url.slice(prefix.length).split(/[/?#]/)[0] || "";
    // Defense in depth: only ever touch a generated UUID filename. Any
    // traversal / separator tricks make the delete a no-op.
    if (!isSafeLocalFilename(filename)) return;
    const filepath = path.join(UPLOAD_DIR, filename);
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
    }
  }
}

function cloudinaryPublicIdFromUrl(url: string): string {
  const match = url.match(/\/image\/upload\/(?:v\d+\/)?(.+)$/);
  if (!match) return "";
  return (match[1] || "").replace(/\.[a-z0-9]+$/i, "");
}

function cloudinaryRequest(
  pathWithVersion: string,
  fields: Record<string, string>,
  filePath?: string
): Promise<any> {
  return new Promise((resolve, reject) => {
    const FormData = require("form-data");
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME || "";
    const form = new FormData();
    for (const [k, v] of Object.entries(fields)) {
      if (v) form.append(k, v);
    }
    if (filePath) {
      form.append("file", fs.createReadStream(filePath));
    }
    const options = {
      hostname: "api.cloudinary.com",
      path: `/v1_1/${cloudName}${pathWithVersion}`,
      method: "POST",
      headers: form.getHeaders(),
    };
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new Error("Cloudinary response parse failed"));
        }
      });
    });
    req.on("error", reject);
    form.pipe(req);
  });
}

function requireCloudinaryConfig(): { cloudName: string; apiKey: string; apiSecret: string } {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME || "";
  const apiKey = process.env.CLOUDINARY_API_KEY || "";
  const apiSecret = process.env.CLOUDINARY_API_SECRET || "";
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error(
      "Cloudinary credentials not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET."
    );
  }
  return { cloudName, apiKey, apiSecret };
}

export class CloudinaryStorageProvider implements StorageProvider {
  async upload(file: Express.Multer.File): Promise<string> {
    const { cloudName, apiKey, apiSecret } = requireCloudinaryConfig();
    const tmpDir = require("os").tmpdir();
    const ext = path.extname(file.originalname).toLowerCase();
    const safeExt = SAFE_EXTENSIONS.has(ext) ? ext : ".jpg";
    const tmpPath = path.join(tmpDir, `${crypto.randomUUID()}${safeExt}`);
    fs.writeFileSync(tmpPath, file.buffer);

    try {
      const timestamp = Math.round(Date.now() / 1000);
      // Cloudinary signs all request parameters EXCEPT `file` and `api_key`.
      const str = `timestamp=${timestamp}`;
      const signature = crypto.createHmac("sha256", apiSecret).update(str).digest("hex");
      const result = await cloudinaryRequest(
        "/image/upload",
        {
          api_key: apiKey,
          timestamp: String(timestamp),
          signature,
        },
        tmpPath
      );
      if (typeof result !== "object" || !result.secure_url) {
        throw new Error(result?.error?.message || "Cloudinary upload failed");
      }
      return result.secure_url as string;
    } finally {
      try {
        fs.unlinkSync(tmpPath);
      } catch {
        /* best effort cleanup */
      }
    }
  }

  async delete(url: string): Promise<void> {
    const publicId = cloudinaryPublicIdFromUrl(url);
    if (!publicId) return;
    const { apiKey, apiSecret } = requireCloudinaryConfig();
    const timestamp = Math.round(Date.now() / 1000);
    const str = `public_id=${publicId}&timestamp=${timestamp}`;
    const signature = crypto.createHmac("sha256", apiSecret).update(str).digest("hex");
    await cloudinaryRequest("/image/destroy", {
      public_id: publicId,
      timestamp: String(timestamp),
      signature,
    });
  }
}

let _provider: StorageProvider | null = null;

/**
 * Storage provider selection.
 * - STORAGE_PROVIDER=cloudinary -> Cloudinary (production / Vercel default)
 * - otherwise local filesystem (development only)
 *
 * FAIL CLOSED: production refuses to silently depend on the ephemeral local
 * filesystem (Vercel) or an anonymous Docker volume. Uploads require an
 * explicit provider — either STORAGE_PROVIDER=cloudinary with credentials, or
 * STORAGE_PROVIDER=local with an explicit mounted persistent volume.
 */
export function getStorageProvider(): StorageProvider {
  if (process.env.NODE_ENV === "production" && STORAGE_PROVIDER === "local" && !process.env.ALLOW_LOCAL_STORAGE_IN_PRODUCTION) {
    throw new Error(
      "Local filesystem storage is not available in production (filesystem is ephemeral on Vercel). " +
        "Set STORAGE_PROVIDER=cloudinary with CLOUDINARY_CLOUD_NAME/CLOUDINARY_API_KEY/CLOUDINARY_API_SECRET, " +
        "or explicitly opt into a persistent local mount with ALLOW_LOCAL_STORAGE_IN_PRODUCTION=true."
    );
  }
  if (!_provider) {
    _provider =
      STORAGE_PROVIDER === "cloudinary"
        ? new CloudinaryStorageProvider()
        : new LocalStorageProvider();
  }
  return _provider;
}

export const _resetProviderForTests = () => {
  _provider = null;
};

export default { getStorageProvider, isSafeLocalFilename, isSafeImageUrl };
