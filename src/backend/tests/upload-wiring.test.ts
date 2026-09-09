/**
 * DB-free regression tests for the admin upload chain.
 *
 * Exercises the FULL HTTP path (multer middleware → controller → local
 * storage provider) without MongoDB: `authenticate` verifies the JWT only, and
 * uploads write to an isolated temp UPLOAD_DIR. Covers:
 *  - valid image uploads (PNG/WebP/JPEG/GIF) actually succeed,
 *  - declared-MIME vs content-signature (magic-byte) enforcement,
 *  - authorization (401 no token / 403 staff),
 *  - secure delete (only server-generated local URLs; traversal rejected),
 *  - batch upload validates every file before storing any.
 *
 * NOTE: env vars must be set before `app` is imported (module-scope reads).
 */
import fs from "fs";
import os from "os";
import path from "path";

process.env.UPLOAD_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "dxn-upload-wiring-"));
process.env.JWT_SECRET = "0123456789abcdef0123456789abcdef";
process.env.NODE_ENV = "test";
process.env.BASE_URL = "http://localhost:5000";

import request from "supertest";
import jwt from "jsonwebtoken";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { default: app } = require("../../backend/app");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { imageSignatureMismatch } = require("../../backend/middleware/upload.middleware");

const UPLOAD_DIR = process.env.UPLOAD_DIR;

const adminToken = jwt.sign({ role: "admin", userId: "000000000000000000000000" }, process.env.JWT_SECRET);
const staffToken = jwt.sign({ role: "staff", userId: "000000000000000000000000" }, process.env.JWT_SECRET);

const PNG_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);
const WEBP_BYTES = Buffer.concat([
  Buffer.from("RIFF"),
  Buffer.from([0x24, 0x00, 0x00, 0x00]),
  Buffer.from("WEBPVP8 "),
  Buffer.alloc(16),
]);
const GIF_BYTES = Buffer.concat([Buffer.from("GIF89a"), Buffer.alloc(16)]);
const JPEG_BYTES = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(32)]);

const countStoredFiles = (): number =>
  fs.existsSync(UPLOAD_DIR) ? fs.readdirSync(UPLOAD_DIR).length : 0;

afterAll(() => {
  try {
    fs.rmSync(UPLOAD_DIR, { recursive: true, force: true });
  } catch {
    /* best effort cleanup */
  }
});

describe("Upload wiring — authorization", () => {
  it("rejects unauthenticated uploads with 401", async () => {
    const res = await request(app)
      .post("/api/upload/image")
      .attach("image", PNG_BYTES, "pixel.png");
    expect(res.status).toBe(401);
  });

  it("rejects non-admin (staff) uploads with 403", async () => {
    const res = await request(app)
      .post("/api/upload/image")
      .set("Authorization", `Bearer ${staffToken}`)
      .attach("image", PNG_BYTES, "pixel.png");
    expect(res.status).toBe(403);
  });
});

describe("Upload wiring — valid images are stored", () => {
  it.each([
    ["png", PNG_BYTES, "image/png", ".png"],
    ["webp", WEBP_BYTES, "image/webp", ".webp"],
    ["gif", GIF_BYTES, "image/gif", ".gif"],
    ["jpeg", JPEG_BYTES, "image/jpeg", ".jpg"],
  ])("%s upload returns a served URL and persists the file", async (_name, bytes, mime, ext) => {
    const before = countStoredFiles();
    const res = await request(app)
      .post("/api/upload/image")
      .set("Authorization", `Bearer ${adminToken}`)
      .attach("image", bytes, { filename: `img${ext}`, contentType: mime });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const url: string = res.body.data.url;
    expect(url).toMatch(new RegExp(`/uploads/[0-9a-f-]{36}\\${ext}$`));
    expect(countStoredFiles()).toBe(before + 1);
    // Stored filename matches the URL basename exactly.
    const filename = url.split("/").pop() as string;
    expect(fs.existsSync(path.join(UPLOAD_DIR, filename))).toBe(true);
  });
});

describe("Upload wiring — magic-byte / MIME enforcement", () => {
  it("rejects text masquerading as PNG (400) and stores nothing", async () => {
    const before = countStoredFiles();
    const res = await request(app)
      .post("/api/upload/image")
      .set("Authorization", `Bearer ${adminToken}`)
      .attach("image", Buffer.from("not a png at all"), "fake.png");
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/does not match/i);
    expect(countStoredFiles()).toBe(before);
  });

  it("rejects HTML payloads declared as PNG (XSS polyglot, 400)", async () => {
    const res = await request(app)
      .post("/api/upload/image")
      .set("Authorization", `Bearer ${adminToken}`)
      .attach("image", Buffer.from("<html><script>alert(1)</script></html>"), "evil.png");
    expect(res.status).toBe(400);
  });

  it("rejects valid PNG bytes declared as GIF (signature vs declared MIME, 400)", async () => {
    const res = await request(app)
      .post("/api/upload/image")
      .set("Authorization", `Bearer ${adminToken}`)
      .attach("image", PNG_BYTES, { filename: "pixel.gif", contentType: "image/gif" });
    expect(res.status).toBe(400);
  });

  it("rejects unsupported MIME types at the multer stage (400)", async () => {
    const res = await request(app)
      .post("/api/upload/image")
      .set("Authorization", `Bearer ${adminToken}`)
      .attach("image", PNG_BYTES, { filename: "pixel.pdf", contentType: "application/pdf" });
    expect(res.status).toBe(400);
  });

  it("rejects dangerous/executable extensions (svg, 400)", async () => {
    const res = await request(app)
      .post("/api/upload/image")
      .set("Authorization", `Bearer ${adminToken}`)
      .attach("image", PNG_BYTES, { filename: "pixel.svg", contentType: "image/png" });
    expect(res.status).toBe(400);
  });

  it("batch upload rejects the whole batch when one file is invalid and stores nothing", async () => {
    const before = countStoredFiles();
    const res = await request(app)
      .post("/api/upload/images")
      .set("Authorization", `Bearer ${adminToken}`)
      .attach("images", PNG_BYTES, "ok1.png")
      .attach("images", Buffer.from("bad"), "bad2.png")
      .attach("images", PNG_BYTES, "ok3.png");
    expect(res.status).toBe(400);
    expect(countStoredFiles()).toBe(before);
  });

  it("batch upload stores all files when every file is valid", async () => {
    const before = countStoredFiles();
    const res = await request(app)
      .post("/api/upload/images")
      .set("Authorization", `Bearer ${adminToken}`)
      .attach("images", PNG_BYTES, "a.png")
      .attach("images", JPEG_BYTES, "b.jpg");
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(countStoredFiles()).toBe(before + 2);
  });
});

describe("Upload wiring — imageSignatureMismatch (pure)", () => {
  it("accepts genuine signatures per MIME", () => {
    expect(imageSignatureMismatch("image/png", PNG_BYTES)).toBeNull();
    expect(imageSignatureMismatch("image/webp", WEBP_BYTES)).toBeNull();
    expect(imageSignatureMismatch("image/gif", GIF_BYTES)).toBeNull();
    expect(imageSignatureMismatch("image/jpeg", JPEG_BYTES)).toBeNull();
  });

  it("rejects 'WEBP' placed at offset 4 (old buggy check) because it is not at offset 8", () => {
    const wrong = Buffer.concat([Buffer.from("RIFFWEBP"), Buffer.alloc(16)]);
    expect(imageSignatureMismatch("image/webp", wrong)).not.toBeNull();
  });

  it("rejects mismatched bytes and empty buffers", () => {
    expect(imageSignatureMismatch("image/png", Buffer.from("XXXX"))).not.toBeNull();
    expect(imageSignatureMismatch("image/png", Buffer.alloc(0))).not.toBeNull();
  });
});

describe("Upload delete — secure by design", () => {
  it("deletes an existing server-generated URL", async () => {
    const up = await request(app)
      .post("/api/upload/image")
      .set("Authorization", `Bearer ${adminToken}`)
      .attach("image", PNG_BYTES, "del.png");
    const url = up.body.data.url as string;
    const filename = url.split("/").pop() as string;
    expect(fs.existsSync(path.join(UPLOAD_DIR, filename))).toBe(true);

    const del = await request(app)
      .delete("/api/upload/image")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ url });
    expect(del.status).toBe(200);
    expect(fs.existsSync(path.join(UPLOAD_DIR, filename))).toBe(false);
  });

  it("rejects traversal / encoded URLs", async () => {
    const cases = [
      "http://localhost:5000/uploads/..%2f..%2fetc%2fpasswd",
      "http://localhost:5000/uploads/../../etc/passwd",
      "http://localhost:5000/uploads/evil.png?x=1",
      "https://evil.example/x.png",
    ];
    for (const url of cases) {
      const res = await request(app)
        .delete("/api/upload/image")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ url });
      expect(res.status).toBe(400);
    }
  });
});
