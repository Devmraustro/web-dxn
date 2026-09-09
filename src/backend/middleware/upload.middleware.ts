import multer from "multer";
import { MAX_FILE_SIZE } from "../config/env";

const MAX_UPLOAD_SIZE = parseInt(MAX_FILE_SIZE) || 5 * 1024 * 1024;

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];

const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp"]);

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
    const ext = "." + file.originalname.split(".").pop()!.toLowerCase();

    if (DISALLOWED_EXTENSIONS.has(ext)) {
      cb(
        new Error(
          `File extension ${ext} is not allowed. Upload only image files (JPEG, PNG, GIF, WebP).`
        )
      );
      return;
    }

    if (!ALLOWED_EXTENSIONS.has(file.mimetype)) {
      cb(
        new Error(
          `Invalid MIME type '${file.mimetype}'. Only JPEG, PNG, GIF, and WebP images are allowed.`
        )
      );
      return;
    }

    if (!ALLOWED_EXTENSIONS.has(ext)) {
      cb(
        new Error(
          `Invalid file extension '${ext}'. Only .jpg, .jpeg, .png, .gif, .webp are allowed.`
        )
      );
      return;
    }

    const buffer = file.buffer;
    if (buffer.length === 0) {
      cb(new Error("File is empty."));
      return;
    }

    const JPEG_SIGNATURES = [
      [0xff, 0xd8, 0xff],
      [0xff, 0xd8, 0xff, 0xe0],
      [0xff, 0xd8, 0xff, 0xe1],
      [0xff, 0xd8, 0xff, 0xe2],
      [0xff, 0xd8, 0xff, 0xdb],
      [0xff, 0xd8, 0xff, 0xee],
      [0xff, 0xd8, 0xff, 0xe8],
    ];
    const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    const GIF_SIGNATURES = [
      [0x47, 0x49, 0x46, 0x38, 0x37, 0x61],
      [0x47, 0x49, 0x46, 0x38, 0x39, 0x61],
    ];
    const WEBP_SIGNATURES = [
      [0x52, 0x49, 0x46, 0x46, 0x57, 0x45, 0x42, 0x50],
    ];

    function matchesSig(buf: Buffer, sig: number[]): boolean {
      return sig.every((byte, i) => buf[i] === byte);
    }

    let valid = false;
    if (file.mimetype === "image/jpeg") {
      valid = JPEG_SIGNATURES.some((sig) => matchesSig(buffer, sig));
    } else if (file.mimetype === "image/png") {
      valid = matchesSig(buffer, PNG_SIGNATURE);
    } else if (file.mimetype === "image/gif") {
      valid = GIF_SIGNATURES.some((sig) => matchesSig(buffer, sig));
    } else if (file.mimetype === "image/webp") {
      valid = WEBP_SIGNATURES.some((sig) => matchesSig(buffer, sig));
    }

    if (!valid) {
      cb(
        new Error(
          "File content does not match its declared MIME type. Upload only valid image files."
        )
      );
      return;
    }

    cb(null, true);
  },
});

export const uploadImage = upload.single("image");
export const uploadImages = upload.array("images", 10);

export default upload;
