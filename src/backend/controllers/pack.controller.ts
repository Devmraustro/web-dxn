import { Request, Response } from "express";
import { Pack, PackItem, Product } from "../../Database/Models";

// GET /api/packs - Get all packs
export const getPacks = async (req: Request, res: Response) => {
  try {
    const { featured, active } = req.query;
    const query: any = {};
    
    if (featured) query.isFeatured = featured === "true";
    if (active !== undefined) query.isActive = active === "true";
    
    const packs = await Pack.find(query)
      .sort({ sortOrder: 1, createdAt: -1 })
      .lean();
    
    res.json({
      success: true,
      data: packs,
    });
  } catch (error) {
    console.error("Get packs error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// GET /api/packs/:id - Get single pack with items
export const getPackById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const pack = await Pack.findById(id).lean();
    if (!pack) {
      return res.status(404).json({ message: "Pack not found" });
    }
    
    // Get pack items
    const items = await PackItem.find({ packId: pack._id })
      .populate("productId", "sku slug isActive price translations")
      .lean();
    
    res.json({
      success: true,
      data: {
        ...pack,
        items,
      },
    });
  } catch (error) {
    console.error("Get pack by ID error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// POST /api/packs - Create pack (admin)
export const createPack = async (req: Request, res: Response) => {
  try {
    const { name, slug, price, compareAtPrice, contents, ...packData } = req.body;
    
    // Check if pack with same name/slug exists
    const existingPack = await Pack.findOne({ $or: [{ name }, { slug }] });
    if (existingPack) {
      return res.status(400).json({ message: "Pack name or slug already exists" });
    }
    
    const pack = new Pack({
      name,
      slug,
      price,
      compareAtPrice,
      ...packData,
    });
    
    await pack.save();
    
    // Add pack items if provided
    if (contents && Array.isArray(contents)) {
      for (const content of contents) {
        const { productId, quantity } = content;
        
        // Verify product exists and is active
        const product = await Product.findById(productId);
        if (!product || !product.isActive) {
          return res.status(400).json({ 
            message: `Product ${productId} not found or inactive` 
          });
        }
        
        await PackItem.create({
          packId: pack._id,
          productId,
          quantity,
        });
      }
    }
    
    res.status(201).json({
      success: true,
      data: pack,
    });
  } catch (error) {
    console.error("Create pack error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// PUT /api/packs/:id - Update pack
export const updatePack = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, slug, price, compareAtPrice, contents, ...updateData } = req.body;
    
    // Check if new name/slug conflicts
    if (name) {
      const existingPack = await Pack.findOne({ name, _id: { $ne: id } });
      if (existingPack) {
        return res.status(400).json({ message: "Pack name already exists" });
      }
    }
    
    if (slug) {
      const existingPack = await Pack.findOne({ slug, _id: { $ne: id } });
      if (existingPack) {
        return res.status(400).json({ message: "Pack slug already exists" });
      }
    }
    
    const pack = await Pack.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });
    
    if (!pack) {
      return res.status(404).json({ message: "Pack not found" });
    }
    
    // Update pack items if contents provided
    if (contents && Array.isArray(contents)) {
      // This is simplified - in production we'd handle add/remove/replace
      // For now, clear and recreate
      await PackItem.deleteMany({ packId: id });
      
      for (const content of contents) {
        const { productId, quantity } = content;
        
        const product = await Product.findById(productId);
        if (!product || !product.isActive) {
          return res.status(400).json({ 
            message: `Product ${productId} not found or inactive` 
          });
        }
        
        await PackItem.create({
          packId: pack._id,
          productId,
          quantity,
        });
      }
    }
    
    res.json({
      success: true,
      data: pack,
    });
  } catch (error) {
    console.error("Update pack error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// DELETE /api/packs/:id - Soft delete
export const deletePack = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const pack = await Pack.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    );
    
    if (!pack) {
      return res.status(404).json({ message: "Pack not found" });
    }
    
    res.json({
      success: true,
      data: pack,
    });
  } catch (error) {
    console.error("Delete pack error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// PATCH /api/packs/:id/toggle-featured
export const togglePackFeatured = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const pack = await Pack.findById(id);
    if (!pack) {
      return res.status(404).json({ message: "Pack not found" });
    }
    
    pack.isFeatured = !pack.isFeatured;
    await pack.save();
    
    res.json({
      success: true,
      data: pack,
    });
  } catch (error) {
    console.error("Toggle pack featured error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// GET /api/packs/:id/items - Get pack contents
export const getPackItems = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const items = await PackItem.find({ packId: id })
      .populate("productId", "sku slug price translations active")
      .lean();
    
    res.json({
      success: true,
      data: items,
    });
  } catch (error) {
    console.error("Get pack items error:", error);
    res.status(500).json({ message: "Server error" });
  }
};