import { Request, Response } from "express";
import { Review, Product } from "../../Database/Models";

// POST /api/reviews - Create review (admin upload)
export const createReview = async (req: Request, res: Response) => {
  try {
    const {
      productId,
      customerName,
      rating,
      title,
      content,
      images,
    } = req.body;

    if (!productId) {
      return res.status(400).json({ message: "Product ID is required" });
    }

    // Verify product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    const review = new Review({
      productId,
      customerName: customerName || "Admin-uploaded",
      rating: rating || 5,
      title: title || "",
      content: content || "",
      images: images || [],
      isPublished: true,
    });

    await review.save();

    // Add review to product's reviews array (if exists)
    // In a real implementation, we'd have a reviews array on the Product model

    res.status(201).json({
      success: true,
      data: review,
    });
  } catch (error) {
    console.error("Create review error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// GET /api/reviews/product/:productId - Get reviews for a product
export const getProductReviews = async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const { limit = 10 } = req.query;

    const reviews = await Review.find({ productId, isPublished: true })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit as string))
      .lean();

    res.json({
      success: true,
      data: reviews,
    });
  } catch (error) {
    console.error("Get product reviews error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// GET /api/reviews - Get all published reviews
export const getAllReviews = async (req: Request, res: Response) => {
  try {
    const { productId, rating, language } = req.query;

    const filter: any = { isPublished: true };

    if (productId) filter.productId = productId;
    if (rating) filter.rating = parseInt(rating as string);
    // Language filtering would be on translations in a full implementation

    const reviews = await Review.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      data: reviews,
    });
  } catch (error) {
    console.error("Get all reviews error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const updateReview = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { customerName, rating, title, content, images, isPublished } = req.body;

    if (!id) {
      res.status(400).json({ message: "Review ID is required" });
      return;
    }

    const review = await Review.findById(id);
    if (!review) {
      res.status(404).json({ message: "Review not found" });
      return;
    }

    if (customerName !== undefined) review.customerName = customerName;
    if (rating !== undefined) review.rating = rating;
    if (title !== undefined) review.title = title;
    if (content !== undefined) review.content = content;
    if (images !== undefined) review.images = images;
    if (isPublished !== undefined) review.isPublished = isPublished;

    await review.save();

    res.json({ success: true, data: review });
  } catch (error) {
    console.error("Update review error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const deleteReview = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({ message: "Review ID is required" });
      return;
    }

    const review = await Review.findByIdAndDelete(id);
    if (!review) {
      res.status(404).json({ message: "Review not found" });
      return;
    }

    res.json({ success: true, message: "Review deleted" });
  } catch (error) {
    console.error("Delete review error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export default {
  createReview,
  getProductReviews,
  getAllReviews,
  updateReview,
  deleteReview,
};