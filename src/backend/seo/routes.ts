import { Router, Request, Response } from "express";
import {
  generateSitemap,
  generateRobotsTxt,
  getProductMetaTags,
  getProductSchema,
  getArabicMetaTags,
  getFrenchMetaTags,
  getCategorySchema,
  getBreadcrumbSchema,
} from "./utils";
import { Product } from "../../Database/Models";

const router = Router();

/** Absolute sitemap URL advertised to crawlers (env-driven, domain-aware). */
const publicSitemapUrl = (): string =>
  `${(process.env.BASE_URL || "https://dxn.dz").replace(/\/+$/, "")}/sitemap.xml`;

/** GET sitemap.xml (queries active products; needs the DB). */
export const serveSitemap = async (_req: Request, res: Response): Promise<void> => {
  try {
    const products = await Product.find({ isActive: true })
      .select("slug updatedAt")
      .lean();

    const sitemap = generateSitemap(products);

    res.type("application/xml").send(sitemap);
  } catch (error) {
    console.error("Generate sitemap error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/** GET robots.txt (no DB access). */
export const serveRobots = (_req: Request, res: Response): void => {
  try {
    res.type("text/plain").send(generateRobotsTxt(publicSitemapUrl()));
  } catch (error) {
    console.error("Generate robots.txt error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// GET /api/seo/sitemap (legacy alias) and /api/seo/robots.txt
router.get("/sitemap", serveSitemap);
router.get("/sitemap.xml", serveSitemap);
router.get("/robots.txt", serveRobots);

const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;
const isArOrFr = (v: unknown): v is "ar" | "fr" => v === "ar" || v === "fr";

/** Shared product lookup for SEO endpoints (validates the id first). */
async function findSeoProduct(productId: unknown, res: Response) {
  if (productId && (typeof productId !== "string" || !OBJECT_ID_RE.test(productId))) {
    res.status(400).json({ message: "Invalid product ID format" });
    return null;
  }
  if (!productId) {
    res.status(400).json({ message: "productId query parameter is required" });
    return null;
  }
  return Product.findById(productId).lean();
}

// GET /api/seo/meta - Get product meta tags
router.get("/meta", async (req: Request, res: Response) => {
  try {
    const { productId, language } = req.query;
    const lang = isArOrFr(language) ? language : "ar";

    const product = await findSeoProduct(productId, res);
    if (!product) return;

    const metaTags = getProductMetaTags(product, lang);

    res.json({
      success: true,
      data: metaTags,
    });
  } catch (error) {
    console.error("Get meta tags error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/seo/schema/product - Get product structured data
router.get("/schema/product", async (req: Request, res: Response) => {
  try {
    const { productId, language } = req.query;
    const lang = isArOrFr(language) ? language : "ar";

    const product = await findSeoProduct(productId, res);
    if (!product) return;

    const schema = getProductSchema(product, lang);

    res.json({
      success: true,
      data: schema,
    });
  } catch (error) {
    console.error("Get product schema error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/seo/schema/category - Get category structured data
router.get("/schema/category", async (req: Request, res: Response) => {
  try {
    const { categoryName, productCount } = req.query;
    
    const schema = getCategorySchema(
      categoryName as string,
      parseInt(productCount as string) || 0
    );
    
    res.json({
      success: true,
      data: schema,
    });
  } catch (error) {
    console.error("Get category schema error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/seo/schema/breadcrumb - Get breadcrumb structured data
router.get("/schema/breadcrumb", async (req: Request, res: Response) => {
  try {
    const { path } = req.query;
    const pathArray = (path as string).split("/").filter(Boolean);
    
    const schema = getBreadcrumbSchema(pathArray);
    
    res.json({
      success: true,
      data: schema,
    });
  } catch (error) {
    console.error("Get breadcrumb schema error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/seo/ar-meta - Get Arabic meta tags (for head component)
router.get("/ar-meta", (req: Request, res: Response) => {
  const sampleText = "منتج DXN";
  const metaTags = getArabicMetaTags(sampleText);
  res.json({
    success: true,
    data: metaTags,
  });
});

// GET /api/seo/fr-meta - Get French meta tags (for head component)
router.get("/fr-meta", (req: Request, res: Response) => {
  const sampleText = "Produit DXN";
  const metaTags = getFrenchMetaTags(sampleText);
  res.json({
    success: true,
    data: metaTags,
  });
});

export default router;