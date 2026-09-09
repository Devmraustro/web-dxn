import request from "supertest";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { startServer } from "../../backend/index";
import { Product, ProductTranslation } from "../../Database/Models";
import type { Server } from "http";

process.env.JWT_SECRET = process.env.JWT_SECRET || "dxn_store_development_secret";

let app: ReturnType<typeof startServer>;
let server: Server;

// Admin auth header for write operations (products are now admin-only)
const adminAuthHeader = (role = "owner") => {
  const token = jwt.sign(
    { role, userId: new mongoose.Types.ObjectId().toString() },
    process.env.JWT_SECRET as string,
    { expiresIn: "1h" }
  );
  return { Authorization: `Bearer ${token}` };
};

beforeAll(async () => {
  app = startServer();
  server = app.listen(0);
});

afterAll(async () => {
  await mongoose.connection.close();
  server.close();
});

beforeEach(async () => {
  await Promise.all([
    Product.deleteMany({}),
    ProductTranslation.deleteMany({}),
  ]);
}, 30000);

describe("Product API", () => {
  describe("GET /api/products", () => {
    it("should return a list of products", async () => {
      const response = await request(app)
        .get("/api/products")
        .expect(200);

      expect(response.body).toHaveProperty("success", true);
      expect(response.body).toHaveProperty("data");
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it("should filter products by language", async () => {
      await ProductTranslation.create({
        productId: new mongoose.Types.ObjectId(),
        language: "ar",
        title: "منتج تجريبي",
        description: "وصف المنتج التجريبي",
      });

      const response = await request(app)
        .get("/api/products?language=ar")
        .expect(200);

      expect(response.body.data).toBeDefined();
    });
  });

  describe("GET /api/products/:id", () => {
    it("should return a single product", async () => {
      const product = new Product({
        sku: "DXN-TEST-001",
        slug: "test-product",
        price: 100,
        isActive: true,
      });
      await product.save();

      await ProductTranslation.create({
        productId: product._id,
        language: "ar",
        title: "اسم المنتج",
        description: "وصف المنتج",
        size: "Medium",
      });

      const response = await request(app)
        .get(`/api/products/${product._id}`)
        .expect(200);

      expect(response.body).toHaveProperty("success", true);
      expect(response.body.data).toHaveProperty("sku", "DXN-TEST-001");
      expect(response.body.data).toHaveProperty("size", "Medium");
    });

    it("should return 404 for non-existent product", async () => {
      const fakeId = new mongoose.Types.ObjectId();
      await request(app)
        .get(`/api/products/${fakeId}`)
        .expect(404);
    });

    it("should return 400 for an invalid product ID format", async () => {
      await request(app)
        .get("/api/products/not-a-valid-id")
        .expect(400);
    });
  });

  describe("POST /api/products", () => {
    it("should create a product with translations", async () => {
      const response = await request(app)
        .post("/api/products")
        .set(adminAuthHeader())
        .send({
          sku: "DXN-NEW-001",
          slug: "new-product",
          price: 120,
          isActive: true,
          translations: {
            ar: {
              title: "منتج جديد",
              description: "وصف المنتج الجديد",
              size: "Large",
            },
            fr: {
              title: "Produit nouveau",
              description: "Description du nouveau produit",
              size: "Large",
            },
          },
        })
        .expect(201);

      expect(response.body).toHaveProperty("success", true);
      expect(response.body.data).toHaveProperty("sku", "DXN-NEW-001");
      expect(response.body.data).toHaveProperty("slug", "new-product");
      expect(response.body.data).toHaveProperty("price", 120);
    });

    it("should return 400 for missing required fields", async () => {
      await request(app)
        .post("/api/products")
        .set(adminAuthHeader())
        .send({ isActive: true })
        .expect(400);
    });

    it("should return 400 for duplicate SKU", async () => {
      await request(app)
        .post("/api/products")
        .set(adminAuthHeader())
        .send({
          sku: "DXN-DUP-001",
          slug: "dup-product",
          price: 50,
        })
        .expect(201);

      await request(app)
        .post("/api/products")
        .set(adminAuthHeader())
        .send({
          sku: "DXN-DUP-001",
          slug: "another-dup",
          price: 60,
        })
        .expect(400);
    });

    it("should return 401 without auth", async () => {
      await request(app)
        .post("/api/products")
        .send({ sku: "X", slug: "x" })
        .expect(401);
    });
  });

  describe("PUT /api/products/:id", () => {
    it("should update a product", async () => {
      const product = new Product({
        sku: "DXN-UPDATE-001",
        slug: "update-product",
        price: 50,
        isActive: true,
      });
      await product.save();

      const response = await request(app)
        .put(`/api/products/${product._id}`)
        .set(adminAuthHeader())
        .send({
          sku: "DXN-UPDATED-001",
          price: 75,
          isFeatured: true,
        })
        .expect(200);

      expect(response.body).toHaveProperty("success", true);
      expect(response.body.data).toHaveProperty("isFeatured", true);
      expect(response.body.data).toHaveProperty("price", 75);
    });
  });

  describe("DELETE /api/products/:id", () => {
    it("should soft delete a product", async () => {
      const product = new Product({
        sku: "DXN-DELETE-001",
        slug: "delete-product",
        price: 30,
        isActive: true,
      });
      await product.save();

      const response = await request(app)
        .delete(`/api/products/${product._id}`)
        .set(adminAuthHeader())
        .expect(200);

      expect(response.body).toHaveProperty("success", true);

      const deletedProduct = await Product.findById(product._id);
      expect(deletedProduct).toHaveProperty("isActive", false);
    });
  });
});
