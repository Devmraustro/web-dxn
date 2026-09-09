import { Request, Response } from "express";
import { Wilaya, ShippingRate } from "../../Database/Models";

// Initialize default wilayas if none exist
export const initializeDefaultWilayas = async () => {
  const wilayaCount = await Wilaya.countDocuments({});
  
  if (wilayaCount === 0) {
    const defaultWilayas = [
      { name: "Algiers", nameFr: "Alger", arName: "algiers" },
      { name: "Oran", nameFr: "Oran", arName: "oran" },
      { name: "Constantine", nameFr: "Constantine", arName: "constantine" },
      { name: "Annaba", nameFr: "Annaba", arName: "annaba" },
      { name: "Setif", nameFr: "Sétif", arName: "setif" },
      { name: "Medea", nameFr: "Médéa", arName: "medea" },
      { name: "Blida", nameFr: "Blida", arName: "blida" },
      { name: "Biskra", nameFr: "Biskra", arName: "biskra" },
      { name: "Tlemcen", nameFr: "Tlemcen", arName: "tlemcen" },
      { name: "Skikda", nameFr: "Skikda", arName: "skikda" },
      { name: "Sidi Bel Abbès", nameFr: "Sidi Bel Abbès", arName: "sidi-bel-abbès" },
      { name: "Mila", nameFr: "Mila", arName: "mila" },
      { name: "Adrar", nameFr: "Adrar", arName: "adrar" },
      { name: "In Salah", nameFr: "In Salah", arName: "in-salah" },
      { name: "Tamanrasset", nameFr: "Tamanrasset", arName: "tamanrasset" },
      { name: "Ghardaïa", nameFr: "Ghardaïa", arName: "ghardaïa" },
      { name: "Relizane", nameFr: "Relizane", arName: "relizane" },
      { name: "El Oued", nameFr: "El Oued", arName: "el-oued" },
      { name: "Timra", nameFr: "Timra", arName: "timra" },
      { name: "Touggourt", nameFr: "Touggourt", arName: "touggourt" },
      { name: "Djanet", nameFr: "Djanet", arName: "djanet" },
      { name: "Naama", nameFr: "Naâma", arName: "naama" },
      { name: "Guelma", nameFr: "Guelma", arName: "guelma" },
      { name: "MSila", nameFr: "M'Sila", arName: "msila" }
    ];
    
    for (const wilaya of defaultWilayas) {
      await Wilaya.create(wilaya);
    }
    console.log("Default wilayas initialized");
  }
};

// GET /api/shipping/wilayas - Get all wilayas
export const getWilayas = async (req: Request, res: Response) => {
  try {
    const wilayas = await Wilaya.find({ isActive: true })
      .sort({ sortOrder: 1, name: 1 })
      .lean();
    
    res.json({
      success: true,
      data: wilayas,
    });
  } catch (error) {
    console.error("Get wilayas error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// GET /api/shipping/rate - Get shipping rate for wilaya + delivery method
export const getShippingRate = async (req: Request, res: Response) => {
  try {
    const { wilayaId, deliveryMethod } = req.query;
    
    const rate = await ShippingRate.findOne({
      wilayaId: wilayaId as string,
      deliveryMethod: deliveryMethod as "home" | "office",
      isActive: true,
    }).lean();
    
    res.json({
      success: true,
      data: rate || { price: 0, wilayaId: wilayaId as string, deliveryMethod: deliveryMethod as string },
    });
  } catch (error) {
    console.error("Get shipping rate error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// POST /api/shipping/calculate - Calculate shipping for order
export const calculateShipping = async (req: Request, res: Response) => {
  try {
    const { wilayaId, deliveryMethod, items } = req.body;
    
    let shippingFee = 0;
    
    if (deliveryMethod === "home" || deliveryMethod === "office") {
      const rate = await ShippingRate.findOne({
        wilayaId,
        deliveryMethod,
        isActive: true,
      });
      
      if (rate) {
        shippingFee = rate.price;
      } else {
        // Default shipping rates - should be configured by admin
        const defaultRates: any = {
          home: 500, // 500 DA default
          office: 300, // 300 DA default
        };
        shippingFee = defaultRates[deliveryMethod] || 0;
      }
    }
    
    res.json({
      success: true,
      data: {
        shippingFee,
        deliveryMethod,
        wilayaId,
      },
    });
  } catch (error) {
    console.error("Calculate shipping error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// GET /api/shipping/zones - Get shipping zones configuration
export const getShippingZones = async (req: Request, res: Response) => {
  try {
    const wilayas = await Wilaya.find({ isActive: true })
      .sort({ sortOrder: 1, name: 1 })
      .lean();
    
    // Map wilayas to zones with default rates
    const zones = wilayas.map((wilaya: any) => ({
      id: wilaya._id,
      name: wilaya.name,
      home: 500, // Default - should be configured per wilaya
      office: 300, // Default - should be configured per wilaya
    }));
    
    res.json({
      success: true,
      data: zones,
    });
  } catch (error) {
    console.error("Get shipping zones error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// POST /api/shipping/setup - Setup shipping rates (admin)
export const setupShippingRate = async (req: Request, res: Response) => {
  try {
    const { wilayaId, deliveryMethod, price } = req.body;
    
    if (!wilayaId || !deliveryMethod || price === undefined) {
      return res.status(400).json({ message: "wilayaId, deliveryMethod, and price are required" });
    }
    
    const shippingRate = await ShippingRate.findOneAndUpdate(
      { wilayaId, deliveryMethod },
      { price, isActive: true },
      { upsert: true, new: true }
    );
    
    res.json({
      success: true,
      data: shippingRate,
    });
  } catch (error) {
    console.error("Setup shipping rate error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// DELETE /api/shipping/rate - Delete shipping rate
export const deleteShippingRate = async (req: Request, res: Response) => {
  try {
    const { wilayaId, deliveryMethod } = req.params;
    
    const result = await ShippingRate.findOneAndDelete({
      wilayaId,
      deliveryMethod,
    });
    
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Delete shipping rate error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export default {
  initializeDefaultWilayas,
  getWilayas,
  getShippingRate,
  calculateShipping,
  getShippingZones,
  setupShippingRate,
  deleteShippingRate,
};