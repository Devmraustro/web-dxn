import { Request, Response } from "express";
import { Order, Customer, Product, ProductTranslation, Pack, PackItem, Offer } from "../../Database/Models";
import { generateOrderNumber } from "../../utils/orderNumber";
import {
  lineTotal,
  offerDiscountForLine,
  finalTotal,
  normalizeQuantity,
  roundMoney,
} from "../services/commerce";
import { resolveShippingFee } from "../services/shipping.service";
import { sendNewOrderNotification, sendOrderStatusUpdate, sendBaridiMobVerificationNotice } from "../services/telegram.service";
import type { AuthRequest } from "../middleware/auth.middleware";

const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;

function cleanCustomerInfo(body: any) {
  const ci = body?.customerInfo || {};
  return {
    firstName: String(ci.firstName || "").trim().slice(0, 100),
    lastName: String(ci.lastName || "").trim().slice(0, 100),
    phone: String(ci.phone || "").trim(),
    secondPhone: String(ci.secondPhone || "").trim().slice(0, 20),
  };
}

/** Order payload for API responses — strips internal metadata (e.g. the stock
 * claims snapshot used for cancellation restock) from what clients see. */
function publicOrderPayload(order: any): any {
  const doc = order && typeof order.toObject === "function" ? order.toObject() : order;
  if (doc && doc.metadata && typeof doc.metadata === "object") {
    doc.metadata = { ...doc.metadata };
    delete doc.metadata.stockClaims;
    delete doc.metadata.stockClaimsRestoredAt;
  }
  return doc;
}

/** GET /api/orders - List orders with filtering (admin) */
export const getOrders = async (req: Request, res: Response) => {
  try {
    const { status, paymentMethod, wilaya, page = 1, limit = 20 } = req.query;
    const pageNum = Math.min(Math.max(parseInt(page as string) || 1, 1), 1000);
    const limitNum = Math.min(Math.max(parseInt(limit as string) || 20, 1), 100);

    const filter: any = {};
    if (status) filter.status = status;
    if (paymentMethod) filter.paymentMethod = paymentMethod;
    if (wilaya) filter["customerInfo.wilaya"] = wilaya;

    const orders = await Order.find(filter)
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .populate("customerId", "firstName lastName phone")
      .lean();

    const count = await Order.countDocuments(filter);

    res.json({
      success: true,
      data: orders.map((o: any) => publicOrderPayload(o)),
      pagination: { page: pageNum, limit: limitNum, total: count, pages: Math.ceil(count / limitNum) },
    });
  } catch (error) {
    console.error("Get orders error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * GET /api/orders/:id — order owner or admin only (IDOR protection).
 * Owners/admins may view any order. A regular (staff) user may only view an
 * order linked to their own Customer profile. Guest orders are only visible to
 * admins, which is why the order confirmation screen never exposes PII through
 * this endpoint.
 */
export const getOrderById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const role = req.user?.role || "";
    const userId = String(req.user?.userId || req.user?.id || "");

    const order = await Order.findById(id)
      .populate("customerId", "firstName lastName phone")
      .lean();

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    const isAdmin = role === "owner" || role === "admin";
    if (!isAdmin) {
      // Find the caller's customer profile and compare with the order owner.
      let authorized = false;
      if (userId && order.customerId) {
        const customer = await Customer.findOne({ userId }).select("_id").lean();
        if (customer && String(customer._id) === String(order.customerId)) {
          authorized = true;
        }
      }
      if (!authorized) {
        return res.status(403).json({ message: "You do not have access to this order" });
      }
    }

    res.json({ success: true, data: publicOrderPayload(order) });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("Cast to ObjectId")) {
      return res.status(400).json({ message: "Invalid order ID format" });
    }
    console.error("Get order by ID error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * POST /api/orders — create an order. Everything is computed server-side:
 * unit prices come from the Product/Pack collection, shipping from the
 * ShippingRate collection (or the DEFAULT_SHIPPING_* env fallback), discounts
 * from active offers, and stock is decremented atomically. Client-supplied
 * subtotal/total/discount values are ignored.
 */
export const createOrder = async (req: Request, res: Response) => {
  // Track stock we have decremented so we can compensate on failure.
  let decremented: { productId: string; quantity: number }[] = [];

  const compensateStock = async () => {
    for (const d of decremented) {
      await Product.updateOne({ _id: d.productId }, { $inc: { stockQuantity: d.quantity } }).catch(() => undefined);
    }
    decremented = [];
  };

  try {
    const body = req.body || {};
    const customerInfo = cleanCustomerInfo(body);
    const cartItems: any[] = Array.isArray(body.cartItems) ? body.cartItems : [];
    const deliveryMethod: string = body.deliveryMethod;
    const wilayaInput: string = body.wilaya || "";
    const commune: string = String(body.commune || "").trim().slice(0, 100);
    const rawAddress: string = String(body.address || "").trim().slice(0, 500);
    const paymentMethod: string = body.paymentMethod;

    if (!customerInfo.firstName || !customerInfo.lastName || !customerInfo.phone) {
      return res.status(400).json({ message: "Customer information is required" });
    }
    if (cartItems.length === 0) {
      return res.status(400).json({ message: "Cart is empty" });
    }
    if (deliveryMethod !== "home" && deliveryMethod !== "office") {
      return res.status(400).json({ message: "Invalid delivery method" });
    }
    if (paymentMethod !== "cod" && paymentMethod !== "baridimob") {
      return res.status(400).json({ message: "Invalid payment method" });
    }
    if (!wilayaInput) {
      return res.status(400).json({ message: "Wilaya is required" });
    }

    const address = deliveryMethod === "home" ? rawAddress : "";

    // --- Resolve lines + aggregate stock demand ----------------------------
    const resolvedItems: any[] = [];
    const demand = new Map<string, number>(); // productId -> total units needed
    const packsById = new Map<string, any>();
    const packComponents = new Map<string, any[]>();

    for (const rawItem of cartItems) {
      let kind: "product" | "pack";
      let id: string;
      const hasProduct = typeof rawItem?.productId === "string" && OBJECT_ID_RE.test(rawItem.productId);
      const hasPack = typeof rawItem?.packId === "string" && OBJECT_ID_RE.test(rawItem.packId);
      if (hasProduct === hasPack) {
        return res.status(400).json({ message: hasProduct && hasPack ? "Item must be a product OR a pack" : "Invalid item identifier" });
      }
      kind = hasPack ? "pack" : "product";
      id = hasPack ? rawItem.packId : rawItem.productId;

      let quantity: number;
      try {
        quantity = normalizeQuantity(rawItem.quantity);
      } catch {
        return res.status(400).json({ message: "Invalid item quantity" });
      }

      if (kind === "product") {
        const product = await Product.findById(id).lean();
        if (!product || !product.isActive) {
          return res.status(400).json({ message: "Product not found or inactive" });
        }
        const snap = lineTotal(Number(product.price), quantity);
        resolvedItems.push({
          productId: product._id,
          packId: undefined,
          productName: (product as any).title || (product as any).name || product.sku || "Product",
          packName: undefined,
          quantity: snap.quantity,
          unitPrice: snap.unitPrice,
          totalPrice: snap.totalPrice,
          _titleRef: String(product._id),
        });
        demand.set(String(product._id), (demand.get(String(product._id)) || 0) + snap.quantity);
      } else {
        let pack = packsById.get(id);
        if (!pack) {
          pack = await Pack.findById(id).lean();
          packsById.set(id, pack || null);
        }
        if (!pack || !pack.isActive) {
          return res.status(400).json({ message: "Pack not found or inactive" });
        }
        let components = packComponents.get(id);
        if (!components) {
          components = await PackItem.find({ packId: pack._id }).lean();
          packComponents.set(id, components || []);
        }
        if (!components || components.length === 0) {
          return res.status(400).json({ message: "Pack has no contents" });
        }
        const snap = lineTotal(Number(pack.price), quantity);
        resolvedItems.push({
          productId: undefined,
          packId: pack._id,
          productName: pack.name || "Pack",
          packName: pack.name,
          quantity: snap.quantity,
          unitPrice: snap.unitPrice,
          totalPrice: snap.totalPrice,
        });
        for (const comp of components) {
          const pid = String(comp.productId);
          demand.set(pid, (demand.get(pid) || 0) + (Number(comp.quantity) || 1) * snap.quantity);
        }
      }
    }

    // --- Shipping (server-authoritative) ------------------------------------
    const shippingFee = await resolveShippingFee(wilayaInput, deliveryMethod as "home" | "office");

    // --- Subtotal (server prices) + active offers discount ------------------
    const subtotal = roundMoney(resolvedItems.reduce((s, it) => s + it.totalPrice, 0));

    // --- Enrich product names from translations (bilingual snapshot) ---------
    const titleRefs = [...new Set(resolvedItems.filter((i) => i._titleRef).map((i) => i._titleRef))];
    if (titleRefs.length) {
      const translations = await ProductTranslation.find({ productId: { $in: titleRefs } })
        .select("productId language title")
        .lean();
      const bestTitle = new Map<string, string>();
      for (const t of translations) {
        const pid = String(t.productId);
        if (t.language === "ar" && t.title) bestTitle.set(pid, t.title);
        else if (t.language === "fr" && t.title && !bestTitle.has(pid)) bestTitle.set(pid, t.title);
      }
      for (const item of resolvedItems) {
        if (item._titleRef) {
          item.productName = bestTitle.get(item._titleRef) || item.productName || "Product";
          delete item._titleRef;
        }
      }
    }

    const now = new Date();
    const productIds = resolvedItems.filter((i) => i.productId).map((i) => String(i.productId));
    const packIds = resolvedItems.filter((i) => i.packId).map((i) => String(i.packId));

    let discount = 0;
    if (productIds.length > 0 || packIds.length > 0) {
      const activeOffers = await Offer.find({
        isActive: true,
        $or: [
          ...(productIds.length ? [{ productId: { $in: productIds } }] : []),
          ...(packIds.length ? [{ packId: { $in: packIds } }] : []),
        ],
        $expr: {
          $and: [
            { $or: [{ startDate: null }, { $lte: ["$startDate", now] }] },
            { $or: [{ endDate: null }, { $gte: ["$endDate", now] }] },
          ],
        },
      }).lean();

      for (const offer of activeOffers) {
        const matched = resolvedItems.find((item: any) =>
          (offer.productId && item.productId && String(item.productId) === String(offer.productId)) ||
          (offer.packId && item.packId && String(item.packId) === String(offer.packId))
        );
        if (!matched) continue;
        discount += offerDiscountForLine(
          matched.totalPrice,
          offer.type === "percentage" ? "percentage" : "fixed",
          Number(offer.value)
        );
      }
    }
    discount = roundMoney(Math.min(discount, subtotal));
    const total = finalTotal(subtotal, shippingFee, discount);

    // --- Atomic stock decrement ---------------------------------------------
    // Order is created only after every required unit has been claimed. Any
    // failure (concurrent oversell / deactivated product) rolls back the units
    // claimed so far and returns a clean 409/400.
    const demandEntries = [...demand.entries()];
    for (const [productId, qty] of demandEntries) {
      const updated = await Product.findOneAndUpdate(
        { _id: productId, stockQuantity: { $gte: qty }, isActive: true },
        { $inc: { stockQuantity: -qty } },
        { new: true }
      ).lean();
      if (!updated) {
        await compensateStock();
        const existing = await Product.findById(productId).select("sku isActive stockQuantity").lean();
        if (!existing || !existing.isActive) {
          return res.status(400).json({ message: "A product in the cart is no longer available" });
        }
        return res.status(409).json({
          message: `Insufficient stock for ${(existing as any).sku || productId}. Available: ${(existing as any).stockQuantity}`,
        });
      }
      decremented.push({ productId, quantity: qty });
    }

    // --- Customer profile (linked by phone) ---------------------------------
    let customer = await Customer.findOne({ phone: customerInfo.phone });
    if (!customer) {
      customer = new Customer({
        firstName: customerInfo.firstName,
        lastName: customerInfo.lastName,
        phone: customerInfo.phone,
        secondPhone: customerInfo.secondPhone || "",
        wilaya: wilayaInput,
        commune,
        address,
      });
      await customer.save();
    } else {
      customer.firstName = customerInfo.firstName;
      customer.lastName = customerInfo.lastName;
      customer.wilaya = wilayaInput;
      customer.commune = commune;
      customer.address = address;
      await customer.save();
    }

    // --- Create order (with retry on order-number collision) ----------------
    // Server-computed stock claims snapshot (productId -> units). Used later to
    // restore inventory exactly when an order is cancelled/rejected. It is
    // ALWAYS overwritten from this server-side map — client-supplied metadata
    // can never influence what is restored.
    const orderMetadata: Record<string, unknown> =
      body.metadata && typeof body.metadata === "object" ? { ...body.metadata } : {};
    orderMetadata.stockClaims = demandEntries.map(([productId, quantity]) => ({
      productId,
      quantity,
    }));

    let order: any = null;
    let duplicate = false;
    for (let attempt = 0; attempt < 3 && !order; attempt++) {
      const candidate = new Order({
        orderNumber: generateOrderNumber(),
        customerId: customer._id,
        customerInfo: {
          firstName: customerInfo.firstName,
          lastName: customerInfo.lastName,
          phone: customerInfo.phone,
          secondPhone: customerInfo.secondPhone || "",
          wilaya: wilayaInput,
          commune,
          address,
        },
        deliveryMethod,
        wilaya: wilayaInput,
        commune,
        address,
        paymentMethod,
        paymentStatus: paymentMethod === "baridimob" ? "pending" : "verified",
        status: "new",
        subtotal,
        shippingFee,
        discount,
        total,
        items: resolvedItems,
        metadata: orderMetadata,
      });
      try {
        await candidate.save();
        order = candidate;
      } catch (err: any) {
        if (err?.code !== 11000) throw err;
        // Unique-key collision: either a duplicate checkout with the same
        // Idempotency-Key (concurrent retry — return the existing order) or a
        // (rare) order-number collision (regenerate and retry).
        if (candidate.metadata?.idempotencyKey) {
          const dup = await Order.findOne({ "metadata.idempotencyKey": candidate.metadata.idempotencyKey }).lean();
          if (dup) {
            order = dup;
            duplicate = true;
            break;
          }
        }
      }
    }
    if (!order) {
      await compensateStock();
      return res.status(500).json({ message: "Could not place order, please retry" });
    }
    if (duplicate) {
      // The other request won the race and already claimed the stock for this
      // checkout — give back the units this attempt decremented.
      await compensateStock();
      return res.json({
        success: true,
        data: publicOrderPayload(order),
        message: "Order already created with this key - duplicate prevented",
      });
    }

    // Notifications are best-effort and must never fail the checkout.
    try {
      await sendNewOrderNotification(order);
      if (paymentMethod === "baridimob") {
        await sendBaridiMobVerificationNotice(order);
      }
    } catch {
      /* notification failures are non-fatal */
    }

    res.status(201).json({ success: true, data: publicOrderPayload(order), message: "Order created successfully" });
  } catch (error) {
    console.error("Create order error:", error);
    await compensateStock();
    res.status(500).json({ message: "Server error" });
  }
};

const VALID_TRANSITIONS: Record<string, string[]> = {
  new: ["pending_payment", "confirmed", "cancelled"],
  pending_payment: ["confirmed", "rejected", "cancelled"],
  confirmed: ["processing", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
  rejected: [],
};

/** Terminal statuses that free the reserved inventory again. */
const RESTOCK_ON_STATUS = new Set(["cancelled", "rejected"]);

/**
 * Build the exact per-product claim list to restore from the order doc.
 * Prefers the server-side snapshot (metadata.stockClaims) written at creation;
 * falls back to direct product lines only for orders placed before snapshots
 * existed (pack component claims cannot be reconstructed in that case).
 */
function claimsToRestore(order: any): Array<{ productId: any; quantity: number }> {
  const claims: Array<{ productId: string; quantity: number }> = Array.isArray(order?.metadata?.stockClaims)
    ? order.metadata.stockClaims
    : [];
  if (claims.length > 0) return claims;
  return (order?.items || [])
    .filter((i: any) => i && i.productId && Number(i.quantity) > 0)
    .map((i: any) => ({ productId: i.productId, quantity: Number(i.quantity) }));
}

/**
 * Restore reserved inventory after an order reaches a terminal status.
 * Idempotent callers only: the guard flag must already be owned by the caller
 * (see updateOrderStatus). Compensates partial writes so a mid-loop failure
 * cannot double-restock on retry.
 */
async function applyRestock(order: any): Promise<{ ok: true } | { ok: false; message: string }> {
  const claims = claimsToRestore(order);
  const applied: Array<{ productId: any; quantity: number }> = [];
  try {
    for (const claim of claims) {
      const qty = Number(claim.quantity);
      if (!claim.productId || !Number.isFinite(qty) || qty <= 0) continue;
      // Restore regardless of the product's current isActive flag: the stock
      // figure is inventory, not sellability, and the quantity comes from the
      // server-side snapshot taken when the order was placed.
      await Product.updateOne({ _id: claim.productId }, { $inc: { stockQuantity: qty } });
      applied.push({ productId: claim.productId, quantity: qty });
    }
    return { ok: true };
  } catch (error) {
    console.error("Restock order inventory error:", error);
    // Roll back the units already restored so a retry cannot double-restock.
    for (const a of applied) {
      await Product.updateOne({ _id: a.productId }, { $inc: { stockQuantity: -a.quantity } }).catch(() => undefined);
    }
    return { ok: false, message: "Server error while restoring stock" };
  }
}

/** PUT /api/orders/:id/status — admin status transition */
export const updateOrderStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const currentOrder = await Order.findById(id);
    if (!currentOrder) {
      return res.status(404).json({ message: "Order not found" });
    }
    const fromStatus = currentOrder.status;

    if (!VALID_TRANSITIONS[fromStatus] || !VALID_TRANSITIONS[fromStatus].includes(status)) {
      return res.status(400).json({ message: `Invalid state transition from ${fromStatus} to ${status}` });
    }

    // Atomic compare-and-set transition: only the request that flips the order
    // away from `fromStatus` wins. Concurrent admins (cancel vs ship) resolve
    // here instead of racing two blind writes.
    const isTerminal = RESTOCK_ON_STATUS.has(status);
    const updated = await Order.findOneAndUpdate(
      {
        _id: id,
        status: fromStatus,
        ...(isTerminal ? { "metadata.stockClaimsRestoredAt": { $exists: false } } : {}),
      },
      {
        $set: {
          status,
          adminId: req.user?.userId || req.user?.id,
          ...(isTerminal ? { "metadata.stockClaimsRestoredAt": new Date() } : {}),
        },
      },
      { new: true }
    );
    if (!updated) {
      return res.status(409).json({
        message: isTerminal
          ? "Order stock has already been restored"
          : "Order was already transitioned by another request",
      });
    }

    // Terminal statuses free the reserved inventory. If the restore fails we
    // revert the status + guard flag so the order is retryable and the stock
    // claim is not lost.
    if (isTerminal) {
      const restored = await applyRestock(updated);
      if (!restored.ok) {
        await Order.updateOne(
          { _id: id, "metadata.stockClaimsRestoredAt": { $exists: true } },
          {
            $set: { status: fromStatus },
            $unset: { "metadata.stockClaimsRestoredAt": 1 },
          }
        ).catch(() => undefined);
        return res.status(500).json({ message: restored.message });
      }
    }

    // Telegram notification is best-effort.
    try {
      await sendOrderStatusUpdate(updated, status);
    } catch {
      /* non-fatal */
    }

    res.json({ success: true, data: publicOrderPayload(updated) });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("Cast to ObjectId")) {
      return res.status(400).json({ message: "Invalid order ID format" });
    }
    console.error("Update order status error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export default { getOrders, getOrderById, createOrder, updateOrderStatus };
