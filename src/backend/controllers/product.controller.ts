import { Request, Response } from "express";
import { Product, ProductTranslation } from "../../Database/Models";

// GET /api/products - Get all active products (sold-out products REMAIN VISIBLE so
// customers can see them and be notified when back in stock). Only inactive products
// are excluded. The frontend can display stock status using stockQuantity.
export const getProducts = async (req: Request, res: Response) => {
  try {
    const { language, featured, search } = req.query;
    const lang = language as "ar" | "fr" | undefined;

    // Build query - ACTIVE products only, sold-out IS included
    const query: any = { isActive: true };
    
    if (featured) query.isFeatured = featured === "true";
    if (search) {
      const raw = String(search);
      if (raw.length > 64) {
        return res.status(400).json({ message: "Search query too long" });
      }
      // Escape regex metacharacters so user input is treated as a literal string.
      // Without this, an attacker can craft ReDoS payloads (e.g. (a+)+$ ) or
      // alter the match semantics. 64-char cap also bounds regex cost.
      const escaped = raw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      query.$or = [
        { "translations.title": { $regex: escaped, $options: "i" } },
        { "translations.description": { $regex: escaped, $options: "i" } },
      ];
    }
    
    // Populate translations
    const products = await Product.find(query)
      .sort({ sortOrder: 1, createdAt: -1 })
      .lean();
    
    // Enrich with translation data
    const enrichedProducts = await Promise.all(
      products.map(async (product: any) => {
        const translations = await ProductTranslation.find({
          productId: product._id,
          language: lang,
        });
        
        return {
          ...product,
          ...(lang && translations.length > 0 ? translations[0] : {}),
          // Fallback to first available language
          ...(lang && translations.length === 0
            ? await ProductTranslation.findOne({
                productId: product._id,
              })
              .lean()
            : {}),
        };
      })
    );
    
    res.json({
      success: true,
      count: enrichedProducts.length,
      data: enrichedProducts,
    });
  } catch (error) {
    console.error("Get products error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// GET /api/products/:id - Get single product with translations
export const getProductById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { language } = req.query;
    const lang = language as "ar" | "fr" | undefined;
    
    const product = await Product.findById(id).lean();
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    
    // Get translations for requested language
    const translations = await ProductTranslation.find({
      productId: product._id,
      language: lang,
    });
    
    // Fallback: get first available translation
    const translation = 
      translations.length > 0 
        ? translations[0] 
        : await ProductTranslation.findOne({ productId: product._id })
            .sort({ language: 1 })
            .lean();
    
    const enrichedProduct = {
      ...product,
      ...(translation || {}),
    };
    
    res.json({
      success: true,
      data: enrichedProduct,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("Cast to ObjectId")) {
      return res.status(400).json({ message: "Invalid product ID format" });
    }
    console.error("Get product by ID error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// POST /api/products - Create product (admin)
export const createProduct = async (req: Request, res: Response) => {
  try {
    const { sku, slug, ...productData } = req.body;
    
    // Check if SKU or slug already exists
    const existingSku = await Product.findOne({ sku });
    if (existingSku) {
      return res.status(400).json({ message: "SKU already exists" });
    }
    
    const existingSlug = await Product.findOne({ slug });
    if (existingSlug) {
      return res.status(400).json({ message: "Slug already exists" });
    }
    
    // Create product
    const product = new Product({
      sku,
      slug,
      ...productData,
    });
    
    await product.save();
    
    // Create default translations if provided
    const { translations } = req.body;
    if (translations && translations.ar && translations.fr) {
      await ProductTranslation.create({
        productId: product._id,
        language: "ar",
        title: translations.ar.title,
        description: translations.ar.description,
        size: translations.ar.size,
      });
      
      await ProductTranslation.create({
        productId: product._id,
        language: "fr",
        title: translations.fr.title,
        description: translations.fr.description,
        size: translations.fr.size,
      });
    }
    
    res.status(201).json({
      success: true,
      data: product,
    });
  } catch (error) {
    console.error("Create product error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// PUT /api/products/:id - Update product
export const updateProduct = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { sku, slug, ...updateData } = req.body;
    
    // Check if new SKU/slug conflicts with existing products
    if (sku) {
      const existingSku = await Product.findOne({ sku, _id: { $ne: id } });
      if (existingSku) {
        return res.status(400).json({ message: "SKU already exists" });
      }
    }
    
    if (slug) {
      const existingSlug = await Product.findOne({ slug, _id: { $ne: id } });
      if (existingSlug) {
        return res.status(400).json({ message: "Slug already exists" });
      }
    }
    
    const product = await Product.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });
    
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    
    // Update translations if provided
    const { translations } = req.body;
    if (translations) {
      // Update Arabic translation
      if (translations.ar) {
        await ProductTranslation.findOneAndUpdate(
          { productId: id, language: "ar" },
          { title: translations.ar.title, description: translations.ar.description, size: translations.ar.size },
          { upsert: true }
        );
      }
      
      // Update French translation
      if (translations.fr) {
        await ProductTranslation.findOneAndUpdate(
          { productId: id, language: "fr" },
          { title: translations.fr.title, description: translations.fr.description, size: translations.fr.size },
          { upsert: true }
        );
      }
    }
    
    res.json({
      success: true,
      data: product,
    });
  } catch (error) {
    console.error("Update product error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// DELETE /api/products/:id - Soft delete
export const deleteProduct = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const product = await Product.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    );
    
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    
    res.json({
      success: true,
      data: product,
    });
  } catch (error) {
    console.error("Delete product error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// PATCH /api/products/:id/toggle-featured
export const toggleFeatured = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    
    product.isFeatured = !product.isFeatured;
    await product.save();
    
    res.json({
      success: true,
      data: product,
    });
  } catch (error) {
    console.error("Toggle featured error:", error);
    res.status(500).json({ message: "Server error" });
  }
};