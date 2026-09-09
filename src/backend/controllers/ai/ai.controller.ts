import { Request, Response } from "express";
import { AIKnowledge } from "../../../Database/Models";
import { escapeRegex } from "../../../utils/regex";

// Initialize default AI knowledge base
export const initializeAIMiddleware = async () => {
  const knowledgeCount = await AIKnowledge.countDocuments({});
  
  if (knowledgeCount === 0) {
    // Seed with basic FAQ and product information
    const defaultKnowledge = [
      // Product questions
      {
        key: "product_skin_care",
        category: "product",
        question: "product skin care",
        answer: "DXN products are natural health supplements. Consult the product description for specific usage instructions.",
        language: "ar",
      },
      {
        key: "product_skin_care",
        category: "product",
        question: "produits de soin de la peau",
        answer: "Les produits DXN sont des suppléments de santé naturels. Consultez la description du produit pour les instructions d'utilisation spécifiques.",
        language: "fr",
      },
      {
        key: "pack_sport",
        category: "pack",
        question: "pack sport",
        answer: "Pack Sport contains products suitable for athletic activity and fitness support.",
        language: "ar",
      },
      {
        key: "pack_sport",
        category: "pack",
        question: "pack sport",
        answer: "Le Pack Sport contient des produits adaptés à l'activité athlétique et le soutien sportif.",
        language: "fr",
      },
      // Shipping questions
      {
        key: "shipping_algeria",
        category: "shipping",
        question: "shipping algeria",
        answer: "Shipping available to all Algerian wilayas. Rates vary by wilaya and delivery method (home/office).",
        language: "ar",
      },
      {
        key: "shipping_algeria",
        category: "shipping",
        question: "expédition Algérie",
        answer: "L'expédition est disponible dans toutes les wilayas algériennes. Les tarifs varient selon la wilaya et la méthode de livraison (domicile/bureau).",
        language: "fr",
      },
      // Payment questions
      {
        key: "payment_cod",
        category: "payment",
        question: "payment cod",
        answer: "Cash on Delivery is available. Customer pays when receiving the order.",
        language: "ar",
      },
      {
        key: "payment_cod",
        category: "payment",
        question: "paiement en espèces",
        answer: "Le paiement à la livraison est disponible. Le client paie en recevant la commande.",
        language: "fr",
      },
      {
        key: "payment_baridimob",
        category: "payment",
        question: "payment baridimob",
        answer: "BaridiMob payment requires owner verification. The order will be created with pending payment status.",
        language: "ar",
      },
      {
        key: "payment_baridimob",
        category: "payment",
        question: "paiement BaridiMob",
        answer: "Le paiement BaridiMob nécessite une vérification par le propriétaire. La commande sera créée avec un statut en attente de paiement.",
        language: "fr",
      },
      // Delivery questions
      {
        key: "delivery_home",
        category: "delivery",
        question: "delivery home",
        answer: "Home delivery requires wilaya, commune, and full address. Additional fees may apply based on location.",
        language: "ar",
      },
      {
        key: "delivery_home",
        category: "delivery",
        question: "livraison domicile",
        answer: "La livraison à domicile nécessite la wilaya, la commune et une adresse complète. Des frais supplémentaires peuvent s'appliquer selon l'emplacement.",
        language: "fr",
      },
      {
        key: "delivery_office",
        category: "delivery",
        question: "delivery office",
        answer: "Office delivery is available to any post office. The owner will contact you to determine the specific office.",
        language: "ar",
      },
      {
        key: "delivery_office",
        category: "delivery",
        question: "livraison bureau",
        answer: "La livraison en bureau est disponible dans n'importe quel bureau de poste. Le propriétaire vous contactera pour déterminer le bureau spécifique.",
        language: "fr",
      },
      // Medical safety - absolutely prohibited claims
      {
        key: "medical_safety",
        category: "safety",
        question: "medical claims",
        answer: "DXN products are dietary supplements. Do not use as medical treatment. Consult a healthcare professional for health concerns. AI will not make medical claims, diagnose, prescribe, or guarantee cures.",
        language: "ar",
      },
      {
        key: "medical_safety",
        category: "safety",
        question: "allégations médicales",
        answer: "Les produits DXN sont des suppléments alimentaires. N'utilisez pas comme traitement médical. Consultez un professionnel de santé pour vos préoccupations de santé. L'IA ne fera pas d'allégations médicales, de diagnostic, de prescription ou de garanties de guérison.",
        language: "fr",
      },
    ];
    
    for (const item of defaultKnowledge) {
      await AIKnowledge.create(item);
    }
    console.log("AI knowledge base initialized");
  }
};

// GET /api/ai/knowledge - Get all AI knowledge entries
export const getAIKnowledge = async (req: Request, res: Response) => {
  try {
    const { category, language } = req.query;
    const filter: any = {};
    
    if (category) filter.category = category;
    if (language) filter.language = language;
    
    const knowledge = await AIKnowledge.find(filter).lean();
    
    res.json({
      success: true,
      data: knowledge,
    });
  } catch (error) {
    console.error("Get AI knowledge error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// GET /api/ai/knowledge/search - Search AI knowledge
export const searchAIKnowledge = async (req: Request, res: Response) => {
  try {
    const { query, language } = req.query;

    if (!query) {
      return res.status(400).json({ message: "Search query is required" });
    }

    // ReDoS hardening: cap length and escape regex metacharacters so the
    // untrusted search term is treated as a literal substring instead of a
    // regex source. Without this, a payload like "(a+)+$" causes catastrophic
    // backtracking.
    const raw = String(query);
    if (raw.length > 64) {
      return res.status(400).json({ message: "Search query too long" });
    }
    const regex = new RegExp(escapeRegex(raw), "i");

    const results = await AIKnowledge.find({
      $or: [
        { question: regex },
        { answer: regex },
      ],
      ...(language ? { language } : {}),
    }).lean();

    res.json({
      success: true,
      data: results,
    });
  } catch (error) {
    console.error("Search AI knowledge error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export default {
  initializeAIMiddleware,
  getAIKnowledge,
  searchAIKnowledge,
};