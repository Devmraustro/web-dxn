import { Request, Response, NextFunction } from "express";
import { Order, Product, Pack, PackItem } from "../../Database/Models";

// Validate cart items against product stock
export const validateStock = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { items } = req.body;
    const itemList = items || req.body.cartItems;
    
    if (!itemList || !Array.isArray(itemList)) {
      return res.status(400).json({ message: "Items are required" });
    }
    
    for (const item of itemList) {
      let product;
      
      if (item.packId) {
        product = await Pack.findById(item.packId);
        if (!product || !product.isActive) {
          return res.status(400).json({ message: `Pack ${item.packId} not found or inactive` });
        }
        // Check pack components stock
        const packItems = await PackItem.find({ packId: item.packId });
        for (const packItem of packItems) {
          const componentProduct = await Product.findById(packItem.productId);
          if (componentProduct && componentProduct.stockQuantity !== undefined && componentProduct.stockQuantity < packItem.quantity) {
            return res.status(400).json({ 
              message: `Insufficient stock for component ${componentProduct.sku} in pack` 
            });
          }
        }
      } else if (item.productId) {
        product = await Product.findById(item.productId);
        if (!product || !product.isActive) {
          return res.status(400).json({ message: `Product ${item.productId} not found or inactive` });
        }
        
        if (product.stockQuantity !== undefined && product.stockQuantity < item.quantity) {
          return res.status(400).json({ 
            message: `Insufficient stock for ${product.sku}. Available: ${product.stockQuantity}, Requested: ${item.quantity}` 
          });
        }
      } else {
        return res.status(400).json({ message: "Invalid item format" });
      }
    }
    
    next();
  } catch (error) {
    console.error("Stock validation error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Use immutable order pricing - snapshot validation
export const validateOrderPricing = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { subtotal, shippingFee, discount, total } = req.body;
    const items = req.body.items || req.body.cartItems;
    
    if (!items || typeof subtotal !== "number" || typeof shippingFee !== "number" || typeof total !== "number") {
      return res.status(400).json({ message: "Missing required pricing fields" });
    }
    
    // Recalculate to ensure match
    let calculatedSubtotal = 0;
    
    for (const item of items) {
      let unitPrice;
      
      if (item.packId) {
        const pack = await Pack.findById(item.packId);
        unitPrice = pack ? pack.price : 0;
      } else if (item.productId) {
        const product = await Product.findById(item.productId);
        unitPrice = product ? product.price : 0;
      }
      
      calculatedSubtotal += unitPrice * (item.quantity || 1);
    }
    
    const calculatedTotal = calculatedSubtotal + shippingFee - (discount || 0);
    
    // Use a small tolerance for floating point
    const tolerance = 0.01;
    const totalMatch = Math.abs(calculatedTotal - total) < tolerance;
    
    if (!totalMatch) {
      return res.status(400).json({ 
        message: "Order pricing mismatch", 
        expected: calculatedTotal,
        received: total 
      });
    }
    
    // Store pricing snapshot in request for later use
    req.body.pricingSnapshot = {
      subtotal: calculatedSubtotal,
      shippingFee,
      discount: discount || 0,
      total: calculatedTotal,
      items: items.map((item: any) => ({
        ...item,
        unitPrice: item.unitPrice, // Keep client-provided snapshot
        totalPrice: item.unitPrice * (item.quantity || 1),
      }))
    };
    
    next();
  } catch (error) {
    console.error("Order pricing validation error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Idempotency key middleware - prevents duplicate order creation
export const idempotencyMiddleware = (key: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const headerValue = req.headers[(key || "Idempotency-Key").toLowerCase()];
    const idempotencyKey: string | undefined = Array.isArray(headerValue) ? headerValue[0] : headerValue;

    // The key is optional: when provided, duplicate submissions are prevented.
    if (!idempotencyKey) {
      return next();
    }
    
    // Check if order with this key already exists
    const existingOrder = await Order.findOne({ "metadata.idempotencyKey": idempotencyKey });
    
    if (existingOrder) {
      return res.json({
        success: true,
        data: existingOrder,
        message: "Order already created with this key - duplicate prevented",
      });
    }
    
    // Add key to request for later use
    req.body.metadata = req.body.metadata || {};
    req.body.metadata.idempotencyKey = idempotencyKey;
    
    next();
  };
};

export default { validateStock, validateOrderPricing, idempotencyMiddleware };