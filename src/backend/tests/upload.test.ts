import request from "supertest";
import jwt from "jsonwebtoken";
import { startServer } from "../../backend/index";

process.env.JWT_SECRET = process.env.JWT_SECRET || "dxn_store_development_secret";

let app: ReturnType<typeof startServer>;
let server: ReturnType<typeof app.listen>;

beforeAll(async () => {
  app = startServer();
  server = app.listen(0);
});

afterAll(async () => {
  server.close();
});

const adminToken = jwt.sign(
  { role: "admin", userId: "admin-user-id" },
  process.env.JWT_SECRET as string,
  { expiresIn: "1h" }
);
const staffToken = jwt.sign(
  { role: "staff", userId: "staff-user-id" },
  process.env.JWT_SECRET as string,
  { expiresIn: "1h" }
);

describe("H23 - Review Screenshot Upload", () => {
  describe("POST /api/upload/image — auth", () => {
    it("should reject unauthenticated upload", async () => {
      const response = await request(app)
        .post("/api/upload/image")
        .field("name", "test");
      expect(response.status).toBe(401);
    });

    it("should reject non-admin staff upload", async () => {
      const response = await request(app)
        .post("/api/upload/image")
        .set("Authorization", `Bearer ${staffToken}`)
        .field("name", "test");
      expect(response.status).toBe(403);
    });

    it("should reject upload without a file (JSON body)", async () => {
      const response = await request(app)
        .post("/api/upload/image")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({});
      expect(response.status).toBe(400);
      expect(response.body.message).toMatch(/no file/i);
    });
  });

  describe("POST /api/upload/images (batch) — auth", () => {
    it("should reject unauthenticated batch upload", async () => {
      const response = await request(app)
        .post("/api/upload/images")
        .set("Authorization", `Bearer ${staffToken}`)
        .field("name", "test");
      expect(response.status).toBe(403);
    });
  });

  describe("DELETE /api/upload/image — auth", () => {
    it("should reject unauthenticated delete", async () => {
      const response = await request(app)
        .delete("/api/upload/image")
        .send({ url: "http://localhost:5000/uploads/test.jpg" });
      expect(response.status).toBe(401);
    });

    it("should reject non-admin delete", async () => {
      const response = await request(app)
        .delete("/api/upload/image")
        .set("Authorization", `Bearer ${staffToken}`)
        .send({ url: "http://localhost:5000/uploads/test.jpg" });
      expect(response.status).toBe(403);
    });

    it("should reject delete without URL", async () => {
      const response = await request(app)
        .delete("/api/upload/image")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({});
      expect(response.status).toBe(400);
    });

    it("should reject delete with external URL domain", async () => {
      const response = await request(app)
        .delete("/api/upload/image")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ url: "http://evil.com/uploads/test.jpg" });
      expect(response.status).toBe(400);
    });

    it("should succeed for valid local URL (no-op on nonexistent file)", async () => {
      const response = await request(app)
        .delete("/api/upload/image")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ url: "http://localhost:5000/uploads/nonexistent.jpg" });
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("success", true);
    });
  });

  describe("Review with image URLs", () => {
    it("should create a review with image URLs via the review endpoint", async () => {
      const response = await request(app)
        .post("/api/reviews")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          productId: "000000000000000000000001",
          customerName: "Ahmed B.",
          rating: 5,
          title: "Excellent product",
          content: "Worked perfectly!",
          images: [
            "http://localhost:5000/uploads/test-image-1.jpg",
            "http://localhost:5000/uploads/test-image-2.png",
          ],
        });
      expect(response.status).toBeGreaterThanOrEqual(201);
    });
  });

  describe("PUT /api/reviews/:id — auth", () => {
    it("should reject unauthenticated review update", async () => {
      const response = await request(app)
        .put("/api/reviews/some-review-id")
        .send({ images: ["http://localhost:5000/uploads/test.jpg"] });
      expect(response.status).toBe(401);
    });

    it("should reject non-admin review update", async () => {
      const response = await request(app)
        .put("/api/reviews/some-review-id")
        .set("Authorization", `Bearer ${staffToken}`)
        .send({ title: "Updated" });
      expect(response.status).toBe(403);
    });
  });

  describe("DELETE /api/reviews/:id — auth", () => {
    it("should reject unauthenticated review delete", async () => {
      const response = await request(app)
        .delete("/api/reviews/some-review-id");
      expect(response.status).toBe(401);
    });

    it("should reject non-admin review delete", async () => {
      const response = await request(app)
        .delete("/api/reviews/some-review-id")
        .set("Authorization", `Bearer ${staffToken}`);
      expect(response.status).toBe(403);
    });
  });
});
