import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { User, Product, ProductTranslation, Pack, PackItem, Offer } from "../../Database/Models";
import { provisionAdminUser, seedStarterCatalog } from "../services/bootstrap.service";
import { STARTER_PRODUCTS, STARTER_PACKS, STARTER_OFFERS } from "../data/dxnCatalog";

// Ensure the DB-gated test setup has a chance to connect (via shared setup.ts)
beforeEach(async () => {
  // Clean the collections this suite touches
  await Promise.all([
    User.deleteMany({}),
    Product.deleteMany({}),
    ProductTranslation.deleteMany({}),
    Pack.deleteMany({}),
    PackItem.deleteMany({}),
    Offer.deleteMany({}),
  ]);
});

/* ------------------------------------------------------------------ */
/*  provisionAdminUser                                                 */
/* ------------------------------------------------------------------ */

describe("provisionAdminUser", () => {
  const admin = { email: "test-admin@example.com", password: "TestP@ssw0rd1" };

  it("creates a new owner account", async () => {
    const res = await provisionAdminUser(admin);
    expect(res.created).toBe(true);
    expect(res.roleChanged).toBe(false);
    expect(res.email).toBe(admin.email);

    const user = await User.findOne({ email: admin.email }).lean();
    expect(user).toBeTruthy();
    expect(user!.role).toBe("owner");
    expect(user!.isActive).toBe(true);
    // Password must be bcrypt-hashed (not plaintext)
    expect(user!.password).toMatch(/^\$2[aby]?\$/);
  });

  it("returns created: false on second run (idempotent)", async () => {
    await provisionAdminUser(admin);
    const res = await provisionAdminUser(admin);
    expect(res.created).toBe(false);
    expect(res.roleChanged).toBe(false);
  });

  it("does not downgrade an existing owner to admin", async () => {
    await provisionAdminUser(admin);
    const res = await provisionAdminUser({ ...admin, role: "admin" });
    expect(res.created).toBe(false);
    expect(res.roleChanged).toBe(false);
    expect(res.previousRole).toBe("owner");

    const user = await User.findOne({ email: admin.email }).lean();
    expect(user!.role).toBe("owner");
  });

  it("upgrades a staff user to admin/owner", async () => {
    // Create a staff user via public-style insert
    const hash = await bcrypt.hash("originalpass", 12);
    await User.create({ email: admin.email, password: hash, role: "staff", isActive: true });

    const res = await provisionAdminUser(admin);
    expect(res.created).toBe(false);
    expect(res.roleChanged).toBe(true);

    const user = await User.findOne({ email: admin.email }).lean();
    expect(user!.role).toBe("owner");
  });

  it("resets password only when resetPassword is true", async () => {
    const originalHash = await bcrypt.hash("oldpass", 12);
    await User.create({ email: admin.email, password: originalHash, role: "owner", isActive: true });

    // Without resetPassword — password unchanged
    await provisionAdminUser(admin);
    const same = await User.findOne({ email: admin.email }).lean();
    expect(same!.password).toBe(originalHash);

    // With resetPassword — password updated
    const res = await provisionAdminUser({ ...admin, password: "NewP@ssw0rd1", resetPassword: true });
    expect(res.created).toBe(false);

    const updated = await User.findOne({ email: admin.email }).lean();
    expect(updated!.password).not.toBe(originalHash);
    expect(await bcrypt.compare("NewP@ssw0rd1", updated!.password)).toBe(true);
  });

  it("creates admin role when ADMIN_ROLE=admin", async () => {
    const res = await provisionAdminUser({ ...admin, role: "admin" });
    expect(res.created).toBe(true);
    const user = await User.findOne({ email: admin.email }).lean();
    expect(user!.role).toBe("admin");
  });
});

/* ------------------------------------------------------------------ */
/*  seedStarterCatalog                                                 */
/* ------------------------------------------------------------------ */

describe("seedStarterCatalog", () => {
  it("creates products, translations, packs, and offers", async () => {
    const res = await seedStarterCatalog();

    expect(res.productsCreated).toBe(STARTER_PRODUCTS.length);
    expect(res.productsSkipped).toBe(0);
    expect(res.packsCreated).toBe(STARTER_PACKS.length);
    expect(res.packsSkipped).toBe(0);
    expect(res.offersCreated).toBe(STARTER_OFFERS.length);
    expect(res.offersSkipped).toBe(0);

    // Verify a product exists with translations
    const product = await Product.findOne({ sku: STARTER_PRODUCTS[0].sku }).lean();
    expect(product).toBeTruthy();
    expect(product!.price).toBe(STARTER_PRODUCTS[0].price);

    const arTr = await ProductTranslation.findOne({
      productId: product!._id,
      language: "ar",
    }).lean();
    expect(arTr).toBeTruthy();
    expect(arTr!.title).toBe(STARTER_PRODUCTS[0].ar.title);

    const frTr = await ProductTranslation.findOne({
      productId: product!._id,
      language: "fr",
    }).lean();
    expect(frTr).toBeTruthy();
    expect(frTr!.title).toBe(STARTER_PRODUCTS[0].fr.title);

    // Verify a pack exists with items
    const pack = await Pack.findOne({ slug: STARTER_PACKS[0].slug }).lean();
    expect(pack).toBeTruthy();
    expect(pack!.price).toBe(STARTER_PACKS[0].price);

    const packItems = await PackItem.find({ packId: pack!._id }).lean();
    expect(packItems.length).toBe(STARTER_PACKS[0].contents.length);

    // Verify an offer exists
    const offer = await Offer.findOne({ slug: STARTER_OFFERS[0].slug }).lean();
    expect(offer).toBeTruthy();
    expect(offer!.type).toBe(STARTER_OFFERS[0].type);
  });

  it("is fully idempotent on second run (no duplicates)", async () => {
    await seedStarterCatalog();
    const res2 = await seedStarterCatalog();

    expect(res2.productsCreated).toBe(0);
    expect(res2.productsSkipped).toBe(STARTER_PRODUCTS.length);
    expect(res2.packsCreated).toBe(0);
    expect(res2.packsSkipped).toBe(STARTER_PACKS.length);
    expect(res2.offersCreated).toBe(0);
    expect(res2.offersSkipped).toBe(STARTER_OFFERS.length);

    // Counts unchanged
    const productCount = await Product.countDocuments({});
    const packCount = await Pack.countDocuments({});
    const offerCount = await Offer.countDocuments({});
    expect(productCount).toBe(STARTER_PRODUCTS.length);
    expect(packCount).toBe(STARTER_PACKS.length);
    expect(offerCount).toBe(STARTER_OFFERS.length);
  });

  it("does not overwrite an admin-modified product price", async () => {
    await seedStarterCatalog();

    // Admin modifies the price
    const product = await Product.findOne({ sku: STARTER_PRODUCTS[0].sku });
    expect(product).toBeTruthy();
    product!.price = 9999;
    await product!.save();

    const res2 = await seedStarterCatalog();
    expect(res2.productsSkipped).toBe(STARTER_PRODUCTS.length);

    // Price was NOT overwritten by the second seed
    const reloaded = await Product.findOne({ sku: STARTER_PRODUCTS[0].sku }).lean();
    expect(reloaded!.price).toBe(9999);
  });
});
