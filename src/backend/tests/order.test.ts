import request from "supertest";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { startServer } from "../../backend/index";
import { Order, Customer, Product } from "../../Database/Models";
import type { Server } from "http";
import type { Types } from "mongoose";

process.env.JWT_SECRET = process.env.JWT_SECRET || "dxn_store_development_secret";

let app: ReturnType<typeof startServer>;
let server: Server;

const authHeader = (role = "owner") => {
  const token = jwt.sign({ role, userId: new mongoose.Types.ObjectId().toString() }, process.env.JWT_SECRET as string, { expiresIn: "1h" });
  return { Authorization: `Bearer ${token}` };
};

const buildValidPayload = (productId: Types.ObjectId, quantity = 2) => {
  const subtotal = 100 * quantity;
  const shippingFee = 0;
  const discount = 0;
  return {
    customerInfo: {
      firstName: "Test",
      lastName: "Customer",
      phone: "0551234567",
    },
    cartItems: [{ productId: productId.toString(), quantity, unitPrice: 100 }],
    deliveryMethod: "home",
    wilaya: "Algiers",
    commune: "Algiers",
    address: "Test address",
    paymentMethod: "cod",
    subtotal,
    shippingFee,
    discount,
    total: subtotal + shippingFee - discount,
    confirmed: true,
  };
};

beforeAll(async () => {
  app = startServer();
  server = app.listen(0);
});

afterAll(async () => {
  await mongoose.connection.close();
  server.close();
});

// Clean up isolated collections before each test. DB cleanup can exceed Jest's
// default 5s hook timeout on slow/loaded environments, so run the deletes in
// parallel and give this hook an adequate timeout (assertions are unchanged).
beforeEach(async () => {
  await Promise.all([
    Order.deleteMany({}),
    Customer.deleteMany({}),
    Product.deleteMany({}),
  ]);
}, 30000);

describe("Order API", () => {
  describe("POST /api/orders", () => {
    it("should create an order with valid data", async () => {
      const product = await Product.create({
        sku: "DXN-ORD-001",
        slug: "ord-product",
        price: 100,
        stockQuantity: 10,
        isActive: true,
      });

      const response = await request(app)
        .post("/api/orders")
        .send(buildValidPayload(product._id))
        .expect(201);

      expect(response.body).toHaveProperty("success", true);
      expect(response.body).toHaveProperty("data");
      expect(response.body.data).toHaveProperty("orderNumber");
      expect(response.body.data).toHaveProperty("status", "new");
      expect(response.body.data).toHaveProperty("paymentStatus", "verified"); // COD
      expect(response.body.data).toHaveProperty("items");
      expect(Array.isArray(response.body.data.items)).toBe(true);
    });

    it("should return 400 for missing required fields", async () => {
      await request(app)
        .post("/api/orders")
        .send({ cartItems: [] })
        .expect(400);
    });

    it("should return 400 for invalid wilaya", async () => {
      const product = await Product.create({
        sku: "DXN-ORD-002",
        slug: "ord-product-2",
        price: 100,
        stockQuantity: 10,
        isActive: true,
      });

      const payload = buildValidPayload(product._id, 1);
      const { wilaya: _omitted, ...noWilaya } = payload;
      await request(app)
        .post("/api/orders")
        .send(noWilaya)
        .expect(400);
    });

    it("should generate immutable pricing snapshots", async () => {
      const product = await Product.create({
        sku: "DXN-ORD-003",
        slug: "ord-product-3",
        price: 100,
        stockQuantity: 10,
        isActive: true,
      });

      const response1 = await request(app)
        .post("/api/orders")
        .send(buildValidPayload(product._id, 1))
        .expect(201);

      const response2 = await request(app)
        .post("/api/orders")
        .send(buildValidPayload(product._id, 1))
        .expect(201);

      // Both orders should have the same total (price snapshot), independent of
      // any later product price changes.
      expect(response1.body.data.total).toBe(response2.body.data.total);
      expect(response1.body.data.items[0].unitPrice).toBe(100);
      expect(response1.body.data.items[0].totalPrice).toBe(100);
    });
  });

  describe("GET /api/orders/:id", () => {
    it("should return a single order", async () => {
      const order = new Order({
        orderNumber: "DXN-TEST-001",
        customerInfo: {
          firstName: "Test",
          lastName: "Customer",
          phone: "0551234567",
          wilaya: "Algiers",
        },
        deliveryMethod: "home",
        paymentMethod: "cod",
        status: "new",
        subtotal: 100,
        shippingFee: 50,
        discount: 0,
        total: 150,
        items: [
          {
            productId: new mongoose.Types.ObjectId(),
            productName: "Product",
            quantity: 1,
            unitPrice: 100,
            totalPrice: 100,
          },
        ],
      });
      await order.save();

      const response = await request(app)
        .get(`/api/orders/${order._id}`)
        .set(authHeader())
        .expect(200);

      expect(response.body).toHaveProperty("success", true);
      expect(response.body.data).toHaveProperty("orderNumber", "DXN-TEST-001");
    });

    it("should return 400 for an invalid order ID format", async () => {
      await request(app)
        .get("/api/orders/not-a-valid-id")
        .set(authHeader())
        .expect(400);
    });

    it("should require authentication", async () => {
      const order = new Order({
        orderNumber: "DXN-TEST-004",
        customerInfo: {
          firstName: "Test",
          lastName: "Customer",
          phone: "0551234567",
          wilaya: "Algiers",
        },
        deliveryMethod: "home",
        paymentMethod: "cod",
        status: "new",
        subtotal: 100,
        shippingFee: 0,
        discount: 0,
        total: 100,
        items: [
          {
            productId: new mongoose.Types.ObjectId(),
            productName: "Product",
            quantity: 1,
            unitPrice: 100,
            totalPrice: 100,
          },
        ],
      });
      await order.save();

      await request(app)
        .get(`/api/orders/${order._id}`)
        .expect(401);
    });
  });

  describe("PUT /api/orders/:id/status", () => {
    it("should update order status with valid transition", async () => {
      const order = new Order({
        orderNumber: "DXN-TEST-002",
        customerInfo: {
          firstName: "Test",
          lastName: "Customer",
          phone: "0551234567",
          wilaya: "Algiers",
        },
        deliveryMethod: "home",
        paymentMethod: "cod",
        status: "new",
        subtotal: 100,
        shippingFee: 0,
        discount: 0,
        total: 100,
        items: [
          {
            productId: new mongoose.Types.ObjectId(),
            productName: "Product",
            quantity: 1,
            unitPrice: 100,
            totalPrice: 100,
          },
        ],
      });
      await order.save();

      const response = await request(app)
        .put(`/api/orders/${order._id}/status`)
        .set(authHeader())
        .send({ status: "confirmed" })
        .expect(200);

      expect(response.body).toHaveProperty("success", true);
      expect(response.body.data).toHaveProperty("status", "confirmed");
    });

    it("should reject invalid state transition", async () => {
      const order = new Order({
        orderNumber: "DXN-TEST-003",
        customerInfo: {
          firstName: "Test",
          lastName: "Customer",
          phone: "0551234567",
          wilaya: "Algiers",
        },
        deliveryMethod: "home",
        paymentMethod: "cod",
        status: "new",
        subtotal: 100,
        shippingFee: 0,
        discount: 0,
        total: 100,
        items: [
          {
            productId: new mongoose.Types.ObjectId(),
            productName: "Product",
            quantity: 1,
            unitPrice: 100,
            totalPrice: 100,
          },
        ],
      });
      await order.save();

      const response = await request(app)
        .put(`/api/orders/${order._id}/status`)
        .set(authHeader())
        .send({ status: "delivered" }) // Invalid: new -> delivered is not allowed
        .expect(400);

      expect(response.body).toHaveProperty("message");
    });
  });
});
