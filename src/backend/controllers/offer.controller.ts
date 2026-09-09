import { Request, Response } from "express";
import { Offer, Product, Pack } from "../../Database/Models";

// GET /api/offers - Get all active offers
export const getOffers = async (req: Request, res: Response) => {
  try {
    const { active, featured, type } = req.query;
    const query: any = { isActive: active !== "false" };
    
    if (featured) query.isFeatured = featured === "true";
    if (type) query.type = type;
    
    const offers = await Offer.find(query)
      .sort({ sortOrder: 1, createdAt: -1 })
      .lean();
    
    // Populate product/pack info
    const enrichedOffers = await Promise.all(
      offers.map(async (offer: any) => {
        let relatedEntity = null;
        
        if (offer.productId) {
          const product = await Product.findById(offer.productId).select("sku price isActive").lean();
          if (product) {
            relatedEntity = { type: "product", ...product };
          }
        } else if (offer.packId) {
          const pack = await Pack.findById(offer.packId).select("price isActive name").lean();
          if (pack) {
            relatedEntity = { type: "pack", ...pack };
          }
        }
        
        return {
          ...offer,
          relatedEntity,
        };
      })
    );
    
    res.json({
      success: true,
      data: enrichedOffers,
    });
  } catch (error) {
    console.error("Get offers error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// GET /api/offers/:id - Get single offer
export const getOfferById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const offer = await Offer.findById(id).lean();
    if (!offer) {
      return res.status(404).json({ message: "Offer not found" });
    }
    
    let relatedEntity = null;
    
    if (offer.productId) {
      const product = await Product.findById(offer.productId).select("sku price name descriptions").lean();
      if (product) {
        relatedEntity = { type: "product", ...product };
      }
    } else if (offer.packId) {
      const pack = await Pack.findById(offer.packId).select("price name description").lean();
      if (pack) {
        relatedEntity = { type: "pack", ...pack };
      }
    }
    
    res.json({
      success: true,
      data: {
        ...offer,
        relatedEntity,
      },
    });
  } catch (error) {
    console.error("Get offer by ID error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// POST /api/offers - Create offer (admin)
export const createOffer = async (req: Request, res: Response) => {
  try {
    const { title, slug, type, value, productId, packId, startDate, endDate } = req.body;
    
    // Validate: either productId or packId must be provided
    if (!productId && !packId) {
      return res.status(400).json({ message: "Either productId or packId is required" });
    }
    
    // Check for duplicate
    const existingOffer = await Offer.findOne({ slug });
    if (existingOffer) {
      return res.status(400).json({ message: "Offer slug already exists" });
    }
    
    // Validate product/pack exists
    if (productId) {
      const product = await Product.findById(productId);
      if (!product || !product.isActive) {
        return res.status(400).json({ message: "Product not found or inactive" });
      }
    }
    
    if (packId) {
      const pack = await Pack.findById(packId);
      if (!pack || !pack.isActive) {
        return res.status(400).json({ message: "Pack not found or inactive" });
      }
    }
    
    const offer = new Offer({
      title,
      slug,
      type,
      value,
      productId,
      packId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });
    
    await offer.save();
    
    res.status(201).json({
      success: true,
      data: offer,
    });
  } catch (error) {
    console.error("Create offer error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// PUT /api/offers/:id - Update offer
export const updateOffer = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, slug, type, value, productId, packId, startDate, endDate } = req.body;
    
    // Check for duplicate slug (excluding current offer)
    if (slug) {
      const existingOffer = await Offer.findOne({ slug, _id: { $ne: id } });
      if (existingOffer) {
        return res.status(400).json({ message: "Offer slug already exists" });
      }
    }
    
    // Validate product/pack if being changed
    if (productId) {
      const product = await Product.findById(productId);
      if (!product || !product.isActive) {
        return res.status(400).json({ message: "Product not found or inactive" });
      }
    }
    
    if (packId) {
      const pack = await Pack.findById(packId);
      if (!pack || !pack.isActive) {
        return res.status(400).json({ message: "Pack not found or inactive" });
      }
    }
    
    const update: Record<string, unknown> = {};
    if (title !== undefined) update.title = title;
    if (slug !== undefined) update.slug = slug;
    if (type !== undefined) update.type = type;
    if (value !== undefined) update.value = value;
    if (productId !== undefined) update.productId = productId;
    if (packId !== undefined) update.packId = packId;
    if (startDate !== undefined) update.startDate = startDate ? new Date(startDate) : null;
    if (endDate !== undefined) update.endDate = endDate ? new Date(endDate) : null;

    const offer = await Offer.findByIdAndUpdate(id, update, { new: true, runValidators: true });
    
    if (!offer) {
      return res.status(404).json({ message: "Offer not found" });
    }
    
    res.json({
      success: true,
      data: offer,
    });
  } catch (error) {
    console.error("Update offer error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// DELETE /api/offers/:id - Soft delete
export const deleteOffer = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const offer = await Offer.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    );
    
    if (!offer) {
      return res.status(404).json({ message: "Offer not found" });
    }
    
    res.json({
      success: true,
      data: offer,
    });
  } catch (error) {
    console.error("Delete offer error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// PATCH /api/offers/:id/toggle-featured
export const toggleOfferFeatured = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const offer = await Offer.findById(id);
    if (!offer) {
      return res.status(404).json({ message: "Offer not found" });
    }
    
    offer.isFeatured = !offer.isFeatured;
    await offer.save();
    
    res.json({
      success: true,
      data: offer,
    });
  } catch (error) {
    console.error("Toggle offer featured error:", error);
    res.status(500).json({ message: "Server error" });
  }
};