import { Request, Response, NextFunction } from "express";
import { Order, Product, Pack, PackItem } from "../../Database/Models";
import { normalizeQuantity } from "../services/commerce";

const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;

/**
 * Ensure a cart item references exactly one purchasable entity.
 * Items with both or neither identifiers are rejected before any DB work.
 */
export function normalizeCartLine(item: any): { kind: "product" | "pack"; id: string; quantity: number } {
  if (!item || typeof item !== "object") {
    throw new Error("Invalid item format");
  }
  const hasProduct = typeof item.productId === "string" && OBJECT_ID_RE.test(item.productId);
  const hasPack = typeof item.packId === "string" && OBJECT_ID_RE.test(item.packId);
  if (hasProduct === hasPack) {
    throw new Error(hasProduct && hasPack ? "Item must reference a product OR a pack, not both" : "Invalid item identifier");
  }
  const quantity = normalizeQuantity(item.quantity);
  return { kind: hasPack ? "pack" : "product", id: hasPack ? item.packId : item.productId, quantity };
}

interface ProductStockDoc {
  _id: unknown;
  isActive?: boolean;
  stockQuantity?: number;
  sku?: string;
}

/**
 * Pre-flight stock validation (read-only; the authoritative atomic check +
 * decrement happens inside createOrder, so a concurrent oversell between this
 * check and the save is still impossible).
 *
 * Demand is aggregated across the whole cart: when the same product appears in
 * multiple lines (directly or through several packs), only the total demand is
 * compared against stock.
 */
export const validateStock = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const itemList = req.body?.cartItems || req.body?.items;
    if (!Array.isArray(itemList) || itemList.length === 0) {
      return res.status(400).json({ message: "Items are required" });
    }

    const lines: { kind: "product" | "pack"; id: string; quantity: number }[] = [];
    for (const rawItem of itemList) {
      try {
        lines.push(normalizeCartLine(rawItem));
      } catch (err) {
        return res.status(400).json({
          message: err instanceof Error ? err.message : "Invalid item format",
        });
      }
    }

    const productDemand = new Map<string, number>();
    const activePack = new Map<string, boolean>();
    const packComponents = new Map<string, { productId: string; quantity: number }[]>();

    // Aggregate direct product demand.
    for (const line of lines) {
      if (line.kind === "product") {
        productDemand.set(line.id, (productDemand.get(line.id) || 0) + line.quantity);
      }
    }

    // Resolve pack components (cached per pack id) and aggregate their demand.
    const packIds = [...new Set(lines.filter((l) => l.kind === "pack").map((l) => l.id))];
    for (const packId of packIds) {
      const pack = await Pack.findById(packId).lean();
      if (!pack || !pack.isActive) {
        return res.status(400).json({ message: `Pack ${packId} not found or inactive` });
      }
      activePack.set(packId, true);
      const items = await PackItem.find({ packId }).lean();
      if (!items.length) {
        return res.status(400).json({ message: `Pack ${packId} has no contents` });
      }
      packComponents.set(packId, items.map((i: any) => ({ productId: String(i.productId), quantity: Number(i.quantity) || 1 })));
    }

    for (const line of lines) {
      if (line.kind !== "pack") continue;
      const components = packComponents.get(line.id) || [];
      for (const comp of components) {
        productDemand.set(comp.productId, (productDemand.get(comp.productId) || 0) + comp.quantity * line.quantity);
      }
    }

    // Verify every demanded product exists, is active, and has enough stock.
    const productIds = [...productDemand.keys()];
    for (const productId of productIds) {
      const product: ProductStockDoc | null = await Product.findById(productId).select("sku isActive stockQuantity").lean();
      if (!product || !product.isActive) {
        return res.status(400).json({ message: `Product ${productId} not found or inactive` });
      }
      const demanded = productDemand.get(productId) || 0;
      if (product.stockQuantity !== undefined && product.stockQuantity < demanded) {
        return res.status(400).json({
          message: `Insufficient stock for ${product.sku || productId}. Available: ${product.stockQuantity}, Requested: ${demanded}`,
        });
      }
    }

    next();
  } catch (error) {
    console.error("Stock validation error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * Idempotency middleware — prevents duplicate order creation when the client
 * retries the same checkout (network hiccup, double-tap) with the same key.
 * Detection is backed by a unique sparse index on `metadata.idempotencyKey`,
 * so duplicate prevention works across restarts and replicas.
 */
export const idempotencyMiddleware = (key: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const headerValue = req.headers[(key || "Idempotency-Key").toLowerCase()];
    const idempotencyKey: string | undefined = Array.isArray(headerValue) ? headerValue[0] : headerValue;

    if (!idempotencyKey) {
      return next();
    }
    if (typeof idempotencyKey !== "string" || idempotencyKey.length > 200) {
      return res.status(400).json({ message: "Invalid Idempotency-Key header" });
    }

    const existingOrder = await Order.findOne({ "metadata.idempotencyKey": idempotencyKey });
    if (existingOrder) {
      return res.json({
        success: true,
        data: existingOrder,
        message: "Order already created with this key - duplicate prevented",
      });
    }

    req.body.metadata = req.body.metadata || {};
    req.body.metadata.idempotencyKey = idempotencyKey;

    next();
  };
};

export default { validateStock, idempotencyMiddleware };
