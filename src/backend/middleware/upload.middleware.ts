import multer from "multer";
import { MAX_FILE_SIZE } from "../config/env";

const MAX_UPLOAD_SIZE = parseInt(MAX_FILE_SIZE) || 5 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp"]);

const uploadError = (message: string): Error & { statusCode?: number } => {
  const err: Error & { statusCode?: number } = new Error(message);
  err.statusCode = 400;
  return err;
};

const DISALLOWED_EXTENSIONS = new Set([
  ".exe",
  ".bat",
  ".cmd",
  ".sh",
  ".php",
  ".phtml",
  ".asp",
  ".aspx",
  ".jsp",
  ".jspx",
  ".cgi",
  ".pl",
  ".py",
  ".rb",
  ".sh",
  ".zip",
  ".tar",
  ".gz",
  ".rar",
  ".7z",
  ".html",
  ".htm",
  ".svg",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_UPLOAD_SIZE,
    files: 10,
    fieldSize: MAX_UPLOAD_SIZE,
  },
  fileFilter: (
    _req: Express.Request,
    file: Express.Multer.File,
    cb: multer.FileFilterCallback
  ) => {
    const name = String(file.originalname || "");
    const dot = name.lastIndexOf(".");
    const ext = dot >= 0 ? name.slice(dot).toLowerCase() : "";

    if (DISALLOWED_EXTENSIONS.has(ext)) {
      cb(uploadError(`File extension ${ext} is not allowed. Upload only image files (JPEG, PNG, GIF, WebP).`));
      return;
    }

    // NOTE: multer's fileFilter runs BEFORE the file stream is buffered, so
    // `file.buffer` does not exist here. Magic-byte (content signature)
    // verification therefore happens in the controller once memory storage has
    // populated `req.file.buffer` (see imageSignatureMismatch below).
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(uploadError(`Invalid MIME type '${file.mimetype}'. Only JPEG, PNG, GIF, and WebP images are allowed.`));
      return;
    }

    if (!ALLOWED_EXTENSIONS.has(ext)) {
      cb(uploadError(`Invalid file extension '${ext}'. Only .jpg, .jpeg, .png, .gif, .webp are allowed.`));
      return;
    }

    cb(null, true);
  },
});

/**
 * Content-signature (magic-byte) validation, run AFTER multer has buffered the
 * file. Returns null when the bytes match the declared MIME type, otherwise a
 * user-safe error message. Enforces that the file is genuinely the image type
 * the client claimed (blocks polyglot/renamed payloads).
 */
export const imageSignatureMismatch = (mime: string, buffer: Buffer): string | null => {
  if (!Buffer.isBuffer(buffer)) return "File content could not be read.";
  if (buffer.length === 0) return "File is empty.";
  const has = (bytes: number[], offset = 0): boolean =>
    bytes.every((byte, i) => buffer[offset + i] === byte);

  let valid = false;
  if (mime === "image/jpeg") {
    valid = buffer.length >= 3 && has([0xff, 0xd8, 0xff]);
  } else if (mime === "image/png") {
    valid = buffer.length >= 8 && has([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  } else if (mime === "image/gif") {
    // GIF87a or GIF89a
    valid =
      buffer.length >= 6 &&
      (has([0x47, 0x49, 0x46, 0x38, 0x37, 0x61]) || has([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]));
  } else if (mime === "image/webp") {
    // RIFF....WEBP : "RIFF" at offset 0, "WEBP" at offset 8 (bytes 4-7 are the chunk size).
    valid =
      buffer.length >= 12 &&
      has([0x52, 0x49, 0x46, 0x46]) &&
      buffer.toString("latin1", 8, 12) === "WEBP";
  } else {
    return `Unsupported MIME type '${mime}'.`;
  }
  if (!valid) {
    return "File content does not match its declared MIME type. Upload only valid image files.";
  }
  return null;
};

export const uploadImage = upload.single("image");
export const uploadImages = upload.array("images", 10);

export default upload;
