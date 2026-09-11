import bcrypt from "bcrypt";
import { User, Product, ProductTranslation, Pack, PackItem, Offer } from "../../Database/Models";
import {
  STARTER_PRODUCTS,
  STARTER_PACKS,
  STARTER_OFFERS,
} from "../data/dxnCatalog";

const BCRYPT_SALT = 12;

/* ------------------------------------------------------------------ */
/*  Admin provisioning (out-of-band)                                   */
/* ------------------------------------------------------------------ */

export interface AdminProvisionResult {
  email: string;
  created: boolean;
  roleChanged: boolean;
  previousRole?: string;
}

/**
 * Idempotently provision an owner/admin account.
 *
 * - Creates the user with `role` if the email is not already taken.
 * - Never changes the password of an existing user unless `resetPassword` is
 *   explicitly set to true (then `password` is used as the new password).
 * - Never downgrades an existing role (owner stays owner).
 * - Bcrypt-hashes every new / reset password.
 */
export async function provisionAdminUser(opts: {
  email: string;
  password: string;
  role?: string;
  resetPassword?: boolean;
}): Promise<AdminProvisionResult> {
  const email = opts.email.toLowerCase().trim();
  const requestedRole = opts.role === "admin" ? "admin" : "owner";

  if (!email) throw new Error("ADMIN_EMAIL is required");
  if (!opts.password) {
    throw new Error("ADMIN_PASSWORD is required");
  }

  const existing = await User.findOne({ email }).select("role").lean();
  if (existing) {
    // Never downgrade from owner
    const effectiveRole = existing.role === "owner" ? "owner" : requestedRole;
    const roleChanged = effectiveRole !== existing.role;

    if (roleChanged) {
      await User.updateOne({ email }, { $set: { role: effectiveRole } });
    }

    // Only reset password when explicitly requested (never silently overwrite)
    if (opts.resetPassword) {
      const hash = await bcrypt.hash(opts.password, BCRYPT_SALT);
      await User.updateOne(
        { email },
        { $set: { password: hash, isActive: true } }
      );
    }

    return {
      email,
      created: false,
      roleChanged,
      previousRole: existing.role,
    };
  }

  // New account — BCRYPT_SALT is safe at 12
  const hash = await bcrypt.hash(opts.password, BCRYPT_SALT);
  await User.create({
    email,
    password: hash,
    role: requestedRole,
    isActive: true,
    name: email.split("@")[0],
  });

  return { email, created: true, roleChanged: false };
}

/* ------------------------------------------------------------------ */
/*  Catalog seeding                                                    */
/* ------------------------------------------------------------------ */

export interface CatalogSeedResult {
  productsCreated: number;
  productsSkipped: number;
  packsCreated: number;
  packsSkipped: number;
  offersCreated: number;
  offersSkipped: number;
}

/**
 * Idempotently seed the starter DXN catalog.
 *
 * - Inserts only when the sku (product) or slug (pack/offer) does not exist.
 * - Never overwrites admin-maintained data.
 * - Safe to run any number of times.
 */
export async function seedStarterCatalog(): Promise<CatalogSeedResult> {
  const result: CatalogSeedResult = {
    productsCreated: 0,
    productsSkipped: 0,
    packsCreated: 0,
    packsSkipped: 0,
    offersCreated: 0,
    offersSkipped: 0,
  };

  // --- Products + translations ---
  const skuToId = new Map<string, unknown>();

  for (const item of STARTER_PRODUCTS) {
    const existing = await Product.findOne({
      $or: [{ sku: item.sku }, { slug: item.slug }],
    })
      .select("_id")
      .lean();

    if (existing) {
      skuToId.set(item.sku, existing._id);
      result.productsSkipped++;
      continue;
    }

    const product = await Product.create({
      sku: item.sku,
      slug: item.slug,
      price: item.price,
      compareAtPrice: item.compareAtPrice,
      stockQuantity: item.stockQuantity,
      isFeatured: item.isFeatured ?? false,
      sortOrder: item.sortOrder ?? 0,
      isActive: true,
    });

    skuToId.set(item.sku, product._id);

    // Create ar + fr translations
    for (const lang of ["ar", "fr"] as const) {
      const tr = item[lang];
      await ProductTranslation.create({
        productId: product._id,
        language: lang,
        title: tr.title,
        description: tr.description,
        size: item.size,
        metaTitle: tr.metaTitle,
        metaDescription: tr.metaDescription,
      }).catch(() => {
        // Translation may already exist from a previous partial run
      });
    }

    result.productsCreated++;
  }

  // --- Packs ---
  const slugToPackId = new Map<string, unknown>();

  for (const pack of STARTER_PACKS) {
    const existing = await Pack.findOne({ slug: pack.slug })
      .select("_id")
      .lean();

    if (existing) {
      slugToPackId.set(pack.slug, existing._id);
      result.packsSkipped++;
      continue;
    }

    const createdPack = await Pack.create({
      name: pack.name,
      slug: pack.slug,
      price: pack.price,
      compareAtPrice: pack.compareAtPrice,
      isFeatured: pack.isFeatured ?? false,
      sortOrder: pack.sortOrder ?? 0,
      isActive: true,
    });

    slugToPackId.set(pack.slug, createdPack._id);

    for (const item of pack.contents) {
      const productId = skuToId.get(item.sku);
      if (!productId) continue;
      // PackItem is defined with `_id: false`, so `create()` throws
      // "document must have an _id before saving" — use insertMany like the
      // pack controller does for the same collection.
      await PackItem.insertMany([
        {
          packId: createdPack._id,
          productId,
          quantity: item.quantity,
        },
      ]).catch((err: unknown) => {
        console.warn("PackItem.insertMany skipped:", err instanceof Error ? err.message : String(err));
      });
    }

    result.packsCreated++;
  }

  // --- Offers ---
  const slugToProductOrPackId = new Map<string, unknown>();
  for (const p of STARTER_PRODUCTS) slugToProductOrPackId.set(p.slug, skuToId.get(p.sku));
  for (const p of STARTER_PACKS) slugToProductOrPackId.set(p.slug, slugToPackId.get(p.slug));

  for (const offer of STARTER_OFFERS) {
    const existing = await Offer.findOne({ slug: offer.slug })
      .select("_id")
      .lean();
    if (existing) {
      result.offersSkipped++;
      continue;
    }

    const targetId = slugToProductOrPackId.get(offer.targetSlug ?? "");
    if (!targetId) {
      continue;
    }

    const isProduct = STARTER_PRODUCTS.some((p) => p.slug === offer.targetSlug);

    await Offer.create({
      title: offer.title,
      slug: offer.slug,
      type: offer.type,
      value: offer.value,
      isFeatured: offer.isFeatured ?? false,
      sortOrder: offer.sortOrder ?? 0,
      isActive: true,
      ...(isProduct ? { productId: targetId } : { packId: targetId }),
    });

    result.offersCreated++;
  }

  return result;
}
