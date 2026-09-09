import { Request, Response } from "express";
import { Order, Customer, Product, Pack, Offer, ShippingRate, Wilaya } from "../../Database/Models";
import { generateOrderNumber } from "../../utils/orderNumber";
import { sendNewOrderNotification, sendOrderStatusUpdate } from "../services/telegram.service";

// GET /api/orders - Get orders with filtering (admin)
export const getOrders = async (req: Request, res: Response) => {
  try {
    const { status, paymentMethod, wilaya, page = 1, limit = 20 } = req.query;
    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 20;
    
    // Build filter
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
      data: orders,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: count,
        pages: Math.ceil(count / limitNum),
      },
    });
  } catch (error) {
    console.error("Get orders error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// GET /api/orders/:id - Get single order
export const getOrderById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const order = await Order.findById(id)
      .populate("customerId", "firstName lastName phone")
      .lean();
    
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }
    
    res.json({
      success: true,
      data: order,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("Cast to ObjectId")) {
      return res.status(400).json({ message: "Invalid order ID format" });
    }
    console.error("Get order by ID error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// POST /api/orders - Create new order (checkout)
export const createOrder = async (req: Request, res: Response) => {
  try {
    const {
      customerInfo,
      cartItems,
      deliveryMethod,
      wilaya,
      commune,
      address,
      paymentMethod,
    } = req.body;
    
    // Validate required fields
    if (!customerInfo || !customerInfo.firstName || !customerInfo.lastName || !customerInfo.phone) {
      return res.status(400).json({ message: "Customer information is required" });
    }
    
    if (!cartItems || cartItems.length === 0) {
      return res.status(400).json({ message: "Cart is empty" });
    }
    
    if (!wilaya) {
      return res.status(400).json({ message: "Wilaya is required" });
    }
    
    if (deliveryMethod !== "home" && deliveryMethod !== "office") {
      return res.status(400).json({ message: "Invalid delivery method" });
    }
    
    // Calculate shipping fee
    // The client may send a wilaya ObjectId or a wilaya name; resolve either so
    // the ShippingRate lookup does not throw a CastError for a name string.
    const getShippingFee = async (method: "home" | "office"): Promise<number> => {
      const isObjectId = /^[0-9a-fA-F]{24}$/.test(String(wilaya || ""));
      const lookupWilayaId = isObjectId ? wilaya : await Wilaya.findOne({ name: wilaya }).lean();
      if (!lookupWilayaId) return 0;
      const rate = await ShippingRate.findOne({
        wilayaId: isObjectId ? wilaya : lookupWilayaId._id,
        deliveryMethod: method,
      }).lean();
      return rate ? rate.price : 0;
    };

    let shippingFee = 0;
    if (deliveryMethod === "home") {
      shippingFee = await getShippingFee("home");
    } else {
      shippingFee = await getShippingFee("office");
    }
    
    // Calculate subtotal and validate stock
    let subtotal = 0;
    const itemDetails = [];
    
    for (const item of cartItems) {
      const product = await Product.findById(item.productId).lean();
      const pack = await Pack.findById(item.packId).lean();
      
      let unitPrice;
      let effectiveProduct = null;
      
      if (pack && pack.isActive) {
        // Use pack price
        unitPrice = pack.price;
        effectiveProduct = pack;
      } else if (product && product.isActive) {
        // Check stock
        if (product.stockQuantity !== undefined && product.stockQuantity <= 0) {
          return res.status(400).json({ message: `Product ${product.sku} is out of stock` });
        }
        unitPrice = product.price;
        effectiveProduct = product;
      } else {
        return res.status(400).json({ message: "Product or pack not found or inactive" });
      }
      
      subtotal += unitPrice * item.quantity;
      itemDetails.push({
        productId: item.productId,
        packId: item.packId,
        productName: effectiveProduct?.name || effectiveProduct?.translations?.title || "Product",
        packName: pack?.name,
        quantity: item.quantity,
        unitPrice,
        totalPrice: unitPrice * item.quantity,
      });
    }
    
    // Calculate discount from active offers
    let discount = 0;
    const now = new Date();
    const productIds = cartItems.map((i: any) => i.productId).filter(Boolean);
    const packIds = cartItems.map((i: any) => i.packId).filter(Boolean);

    if (productIds.length > 0 || packIds.length > 0) {
      const activeOffers = await Offer.find({
        isActive: true,
        $or: [
          ...(productIds.length > 0 ? [{ productId: { $in: productIds } }] : []),
          ...(packIds.length > 0 ? [{ packId: { $in: packIds } }] : []),
        ],
        $expr: {
          $and: [
            { $or: [{ startDate: null }, { $lte: ["$startDate", now] }] },
            { $or: [{ endDate: null }, { $gte: ["$endDate", now] }] },
          ],
        },
      }).lean();

      for (const offer of activeOffers) {
        const item = cartItems.find((i: any) =>
          (offer.productId && i.productId?.toString() === offer.productId.toString()) ||
          (offer.packId && i.packId?.toString() === offer.packId.toString())
        );
        if (!item) continue;
        const itemPrice = item.unitPrice * item.quantity;
        if (offer.type === "percentage") {
          discount += Math.round(itemPrice * (Number(offer.value) / 100) * 100) / 100;
        } else if (offer.type === "fixed") {
          discount += Number(offer.value);
        }
      }
    }
    
    const total = subtotal + shippingFee - discount;
    
    // Get or create customer
    let customer = await Customer.findOne({
      phone: customerInfo.phone,
    });
    
    if (!customer) {
      customer = new Customer({
        firstName: customerInfo.firstName,
        lastName: customerInfo.lastName,
        phone: customerInfo.phone,
        secondPhone: customerInfo.secondPhone || "",
        wilaya,
        commune,
        address: deliveryMethod === "home" ? address : "",
      });
      await customer.save();
    } else {
      // Update customer info if changed
      customer.firstName = customerInfo.firstName;
      customer.lastName = customerInfo.lastName;
      customer.wilaya = wilaya;
      customer.commune = commune;
      customer.address = deliveryMethod === "home" ? address : "";
      await customer.save();
    }
    
    // Generate order number
    const orderNumber = generateOrderNumber();
    
    // Create order with immutable pricing snapshots
    const order = new Order({
      orderNumber,
      customerId: customer._id,
      customerInfo: {
        firstName: customerInfo.firstName,
        lastName: customerInfo.lastName,
        phone: customerInfo.phone,
        secondPhone: customerInfo.secondPhone || "",
        wilaya,
        commune,
        address: deliveryMethod === "home" ? address : "",
      },
      deliveryMethod,
      wilaya,
      commune,
      address: deliveryMethod === "home" ? address : "",
      paymentMethod,
      paymentStatus: paymentMethod === "baridimob" ? "pending" : "verified",
      status: "new",
      subtotal,
      shippingFee,
      discount,
      total,
      items: itemDetails,
    });
    
    await order.save();
    
    // Send Telegram notification
    await sendNewOrderNotification(order);
    
    res.status(201).json({
      success: true,
      data: order,
      message: "Order created successfully",
    });
  } catch (error) {
    console.error("Create order error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// PUT /api/orders/:id/status - Update order status (admin)
export const updateOrderStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const validTransitions: any = {
      new: ["pending_payment", "confirmed"],
      pending_payment: ["confirmed", "rejected"],
      confirmed: ["processing"],
      processing: ["shipped"],
      shipped: ["delivered"],
      delivered: [],
      cancelled: [],
      rejected: [],
    };
    
    // Check valid transition
    const currentOrder = await Order.findById(id);
    if (!currentOrder) {
      return res.status(404).json({ message: "Order not found" });
    }
    
    if (!validTransitions[currentOrder.status] || !validTransitions[currentOrder.status].includes(status)) {
      return res.status(400).json({ 
        message: `Invalid state transition from ${currentOrder.status} to ${status}` 
      });
    }
    
    const order = await Order.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );
    
    // Send Telegram status update
    await sendOrderStatusUpdate(order, status);
    
    res.json({
      success: true,
      data: order,
    });
  } catch (error) {
    console.error("Update order status error:", error);
    res.status(500).json({ message: "Server error" });
  }
};