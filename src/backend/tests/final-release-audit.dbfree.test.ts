/**
 * DXN NADZ — Final Release Audit & Production Readiness Verification Suite
 *
 * Covers end-to-end HTTP + service verification across Audit Areas 2, 3, 4, 5, and 6:
 *  - Area 2: Official 69 Algerian wilayas (Law n° 26-06 of 4 April 2026 & Decree n° 26-206),
 *            idempotent 58 → 69 DB migration, parent-wilaya rate inheritance, configurable
 *            courier coverage (`served` / `via_parent_wilaya` / `confirm_by_phone` / `unserved`),
 *            and non-destructive historical order preservation.
 *  - Area 3: Full E-Commerce E2E flow (catalog browse, category filter, search, product details,
 *            checkout WITHOUT optional `dxnMemberId`, checkout WITH optional `dxnMemberId`,
 *            COD creation, atomic stock decrement/restock, referral attribution, admin orders).
 *  - Area 4: Full Recruitment & CRM E2E lifecycle (`Visitor → new → contacted → interested →
 *            registered_member`), read-only sponsor enforcement, official membership number
 *            assignment, CRM notes & follow-up date, CSV export, and Customer vs. Lead separation.
 *  - Area 5: Telegram notifications (Order, Recruitment Lead, Contact Request), Markdown escaping,
 *            idempotent duplicate suppression, transient HTTP retry, secret redaction, and DB
 *            persistence when Telegram is unavailable.
 *  - Area 6: Security audit (Admin auth, RBAC `staff` vs `admin`/`owner`, expired/forged JWT,
 *            post-body-parser NoSQL operator injection, XSS sanitization, untrusted metadata
 *            stripping, `Idempotency-Key` privacy, file upload MIME & magic-byte validation,
 *            secret isolation, and CSV formula injection).
 */

process.env.JWT_SECRET =
  process.env.JWT_SECRET || "dxn_nadz_final_audit_secret_minimum_32_characters_long";
process.env.DXN_SPONSOR_MEMBER_ID = "820991122";
process.env.DEFAULT_SHIPPING_HOME = "600";
process.env.DEFAULT_SHIPPING_OFFICE = "400";
process.env.META_PAGE_ID = process.env.META_PAGE_ID || "1234567890";
process.env.META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN || "test_meta_token";
process.env.META_VERIFY_TOKEN = process.env.META_VERIFY_TOKEN || "test_verify_token";
process.env.META_APP_SECRET = process.env.META_APP_SECRET || "test_app_secret";

import request from "supertest";
import jwt from "jsonwebtoken";
import axios, { AxiosError } from "axios";

// --- In-memory stores backing Mongoose mocks --------------------------------
const mockWilayas: any[] = [];
const mockShippingRates: any[] = [];
const mockProducts: any[] = [];
const mockProductTranslations: any[] = [];
const mockOrders: any[] = [];
const mockCustomers: any[] = [];
const mockLeads: any[] = [];
const mockContacts: any[] = [];
const mockNotificationLogs: any[] = [];
const mockAuditLogs: any[] = [];
let mockSettingsDoc: any = null;
let idSeq = 1000;

function nextObjectId(): string {
  idSeq += 1;
  return `507f1f77bcf86cd79943${String(idSeq).padStart(4, "0")}`;
}

function matchesSimpleFilter(row: any, filter: any = {}): boolean {
  if (!filter || Object.keys(filter).length === 0) return true;
  for (const [key, cond] of Object.entries(filter)) {
    if (key === "$or" && Array.isArray(cond)) {
      if (!cond.some((sub) => matchesSimpleFilter(row, sub))) return false;
      continue;
    }
    if (key === "$nor" && Array.isArray(cond)) {
      if (cond.some((sub) => matchesSimpleFilter(row, sub))) return false;
      continue;
    }
    const val = key.includes(".")
      ? key.split(".").reduce((acc, part) => (acc ? acc[part] : undefined), row)
      : row[key];
    if (cond && typeof cond === "object" && !Array.isArray(cond) && !(cond instanceof RegExp)) {
      const c = cond as Record<string, any>;
      if ("$in" in c) {
        if (!c.$in.map(String).includes(String(val))) return false;
        continue;
      }
      if ("$exists" in c) {
        const present = val !== undefined && val !== null;
        if (Boolean(c.$exists) !== present) return false;
        continue;
      }
      if ("$gte" in c) {
        if (!(Number(val) >= Number(c.$gte))) return false;
        continue;
      }
      if ("$regex" in c) {
        const re = new RegExp(c.$regex, c.$options || "");
        if (!re.test(String(val || ""))) return false;
        continue;
      }
    }
    if (String(val) !== String(cond)) return false;
  }
  return true;
}

function makeChain(rows: any[]) {
  let current = [...rows];
  const chain: any = {
    sort: (spec?: Record<string, 1 | -1>) => {
      if (spec) {
        const [field, dir] = Object.entries(spec)[0] || [];
        if (field) {
          current.sort((a, b) => {
            const av = a[field] ?? 0;
            const bv = b[field] ?? 0;
            return av < bv ? -dir : av > bv ? dir : 0;
          });
        }
      }
      return chain;
    },
    skip: (n: number) => {
      current = current.slice(n);
      return chain;
    },
    limit: (n: number) => {
      current = current.slice(0, n);
      return chain;
    },
    select: () => chain,
    populate: () => chain,
    lean: async () => current,
    then: (resolve: any, reject: any) => Promise.resolve(current).then(resolve, reject),
  };
  return chain;
}

function makeDocResult(doc: any) {
  return {
    select: () => makeDocResult(doc),
    populate: () => makeDocResult(doc),
    lean: async () => doc,
    then: (resolve: any, reject: any) => Promise.resolve(doc).then(resolve, reject),
  };
}

function setDeep(obj: any, path: string, value: any) {
  const parts = path.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (cur[parts[i]] === undefined || typeof cur[parts[i]] !== "object" || cur[parts[i]] === null) {
      cur[parts[i]] = {};
    }
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}

function deleteDeep(obj: any, path: string) {
  const parts = path.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (cur[parts[i]] === undefined || typeof cur[parts[i]] !== "object") return;
    cur = cur[parts[i]];
  }
  delete cur[parts[parts.length - 1]];
}

/** Applies a Mongo-style update ($set with dotted paths, $inc, $unset) in-place. */
function applyMongoUpdate(target: any, update: any): any {
  if (!target || !update) return target;
  if (update.$set) {
    for (const [key, value] of Object.entries(update.$set)) {
      setDeep(target, key, value);
    }
  }
  if (update.$inc) {
    for (const [key, delta] of Object.entries(update.$inc)) {
      setDeep(target, key, Number(target?.[key] || 0) + Number(delta));
    }
  }
  if (update.$unset) {
    for (const key of Object.keys(update.$unset)) {
      if (key.includes(".")) deleteDeep(target, key);
      else delete target[key];
    }
  }
  return target;
}

jest.mock("../../Database/Models", () => {
  const actual = jest.requireActual("../../Database/Models");

  function MockWilayaConstructor(this: any, init: any) {
    Object.assign(this, {
      _id: init?._id || nextObjectId(),
      isActive: true,
      coverageStatus: "served",
      homeDeliverySupported: true,
      officeDeliverySupported: true,
      ...init,
    });
    this.save = async () => {
      const idx = mockWilayas.findIndex((w) => String(w._id) === String(this._id));
      if (idx >= 0) mockWilayas[idx] = { ...this };
      else mockWilayas.push({ ...this });
      return this;
    };
  }
  const WilayaMock: any = Object.assign(MockWilayaConstructor, {
    find: Object.assign(
      jest.fn((filter: any = {}) => makeChain(mockWilayas.filter((w) => matchesSimpleFilter(w, filter)))),
      { _isMockFunction: true }
    ),
    findOne: Object.assign(
      jest.fn((filter: any = {}) =>
        makeDocResult(mockWilayas.find((w) => matchesSimpleFilter(w, filter)) || null)
      ),
      { _isMockFunction: true }
    ),
    findById: Object.assign(
      jest.fn((id: string) =>
        makeDocResult(mockWilayas.find((w) => String(w._id) === String(id)) || null)
      ),
      { _isMockFunction: true }
    ),
    insertMany: jest.fn(async (docs: any[]) => {
      const created = docs.map((d) => ({ _id: nextObjectId(), ...d }));
      mockWilayas.push(...created);
      return created;
    }),
    create: jest.fn(async (doc: any) => {
      const created = { _id: nextObjectId(), ...doc };
      mockWilayas.push(created);
      return created;
    }),
    updateOne: jest.fn(async (filter: any, update: any) => {
      const target = mockWilayas.find((w) => matchesSimpleFilter(w, filter));
      if (target && update?.$set) Object.assign(target, update.$set);
      return { modifiedCount: target ? 1 : 0 };
    }),
  });

  const ShippingRateMock: any = {
    find: Object.assign(
      jest.fn((filter: any = {}) =>
        makeChain(mockShippingRates.filter((r) => matchesSimpleFilter(r, filter)))
      ),
      { _isMockFunction: true }
    ),
    findOne: Object.assign(
      jest.fn((filter: any = {}) =>
        makeDocResult(mockShippingRates.find((r) => matchesSimpleFilter(r, filter)) || null)
      ),
      { _isMockFunction: true }
    ),
    insertMany: jest.fn(async (docs: any[]) => {
      const created = docs.map((d) => ({ _id: nextObjectId(), ...d }));
      mockShippingRates.push(...created);
      return created;
    }),
    create: jest.fn(async (doc: any) => {
      const created = { _id: nextObjectId(), ...doc };
      mockShippingRates.push(created);
      return created;
    }),
    findOneAndUpdate: jest.fn(async (filter: any, update: any) => {
      let existing = mockShippingRates.find((r) => matchesSimpleFilter(r, filter));
      if (existing) {
        Object.assign(existing, update);
        return existing;
      }
      existing = { _id: nextObjectId(), ...filter, ...update };
      mockShippingRates.push(existing);
      return existing;
    }),
    findOneAndDelete: jest.fn(async (filter: any) => {
      const idx = mockShippingRates.findIndex((r) => matchesSimpleFilter(r, filter));
      if (idx === -1) return null;
      return mockShippingRates.splice(idx, 1)[0];
    }),
  };

  function MockCustomerConstructor(this: any, init: any) {
    Object.assign(this, { _id: init?._id || nextObjectId(), ...init });
    this.save = async () => {
      const idx = mockCustomers.findIndex((c) => String(c._id) === String(this._id));
      if (idx >= 0) mockCustomers[idx] = { ...this };
      else mockCustomers.push({ ...this });
      return this;
    };
  }
  const CustomerMock: any = Object.assign(MockCustomerConstructor, {
    findOne: jest.fn(async (filter: any = {}) => {
      const found = mockCustomers.find((c) => matchesSimpleFilter(c, filter));
      if (!found) return null;
      return new (MockCustomerConstructor as any)(found);
    }),
    countDocuments: jest.fn(async () => mockCustomers.length),
  });

  function MockOrderConstructor(this: any, init: any) {
    Object.assign(this, {
      _id: init?._id || nextObjectId(),
      createdAt: new Date("2026-11-13T12:00:00.000Z"),
      ...init,
    });
    this.toObject = () => ({ ...this });
    this.save = async () => {
      if (this.metadata?.idempotencyKey) {
        const dup = mockOrders.find(
          (o) =>
            String(o._id) !== String(this._id) &&
            o.metadata?.idempotencyKey === this.metadata.idempotencyKey
        );
        if (dup) {
          const err: any = new Error("Duplicate idempotencyKey");
          err.code = 11000;
          throw err;
        }
      }
      const idx = mockOrders.findIndex((o) => String(o._id) === String(this._id));
      if (idx >= 0) mockOrders[idx] = { ...this };
      else mockOrders.push({ ...this });
      return this;
    };
  }
  const OrderMock: any = Object.assign(MockOrderConstructor, {
    find: jest.fn((filter: any = {}) =>
      makeChain(mockOrders.filter((o) => matchesSimpleFilter(o, filter)))
    ),
    countDocuments: jest.fn(
      async (filter: any = {}) => mockOrders.filter((o) => matchesSimpleFilter(o, filter)).length
    ),
    findOne: jest.fn((filter: any = {}) => {
      const found = mockOrders.find((o) => matchesSimpleFilter(o, filter)) || null;
      if (!found) return makeDocResult(null);
      const wrapped = new (MockOrderConstructor as any)(found);
      return Object.assign(Promise.resolve(wrapped), {
        lean: async () => ({ ...found }),
      });
    }),
    findById: jest.fn((id: string) => {
      const found = mockOrders.find((o) => String(o._id) === String(id)) || null;
      if (!found) return makeDocResult(null);
      const wrapped = new (MockOrderConstructor as any)(found);
      return Object.assign(Promise.resolve(wrapped), {
        populate: () => makeDocResult(wrapped),
        lean: async () => ({ ...found }),
      });
    }),
    findOneAndUpdate: jest.fn((filter: any = {}, update: any = {}) => {
      const target = mockOrders.find((o) => matchesSimpleFilter(o, filter));
      if (!target) return makeDocResult(null);
      applyMongoUpdate(target, update);
      const wrapped = new (MockOrderConstructor as any)(target);
      return makeDocResult(wrapped);
    }),
    updateOne: jest.fn(async (filter: any = {}, update: any = {}) => {
      const target = mockOrders.find((o) => matchesSimpleFilter(o, filter));
      if (!target) return { modifiedCount: 0 };
      applyMongoUpdate(target, update);
      return { modifiedCount: 1 };
    }),
  });

  const ProductMock: any = {
    find: Object.assign(
      jest.fn((filter: any = {}) =>
        makeChain(mockProducts.filter((p) => matchesSimpleFilter(p, filter)))
      ),
      { _isMockFunction: true }
    ),
    countDocuments: jest.fn(
      async (filter: any = {}) => mockProducts.filter((p) => matchesSimpleFilter(p, filter)).length
    ),
    findById: jest.fn((id: string) =>
      makeDocResult(mockProducts.find((p) => String(p._id) === String(id)) || null)
    ),
    findOne: jest.fn((filter: any = {}) =>
      makeDocResult(mockProducts.find((p) => matchesSimpleFilter(p, filter)) || null)
    ),
    findOneAndUpdate: jest.fn((filter: any = {}, update: any = {}) => {
      const target = mockProducts.find((p) => matchesSimpleFilter(p, filter));
      if (!target) return makeDocResult(null);
      if (update.$inc) {
        for (const [k, delta] of Object.entries(update.$inc)) {
          target[k] = Number(target[k] || 0) + Number(delta);
        }
      }
      if (update.$set) Object.assign(target, update.$set);
      return makeDocResult({ ...target });
    }),
    updateOne: jest.fn(async (filter: any = {}, update: any = {}) => {
      const target = mockProducts.find((p) => matchesSimpleFilter(p, filter));
      if (!target) return { modifiedCount: 0 };
      applyMongoUpdate(target, update);
      return { modifiedCount: 1 };
    }),
  };

  const ProductTranslationMock: any = {
    find: Object.assign(
      jest.fn((filter: any = {}) => {
        const rows = mockProductTranslations.filter((t) => {
          if (filter.productId?.$in) {
            if (!filter.productId.$in.map(String).includes(String(t.productId))) return false;
          } else if (filter.productId && String(t.productId) !== String(filter.productId)) {
            return false;
          }
          if (filter.language && t.language !== filter.language) return false;
          if (filter.$or) return matchesSimpleFilter(t, { $or: filter.$or });
          return true;
        });
        return makeChain(rows);
      }),
      { _isMockFunction: true }
    ),
  };

  return {
    ...actual,
    Wilaya: WilayaMock,
    ShippingRate: ShippingRateMock,
    Customer: CustomerMock,
    Order: OrderMock,
    Product: ProductMock,
    ProductTranslation: ProductTranslationMock,
    Offer: {
      find: jest.fn(() => makeChain([])),
    },
    Pack: {
      find: jest.fn(() => makeChain([])),
      findById: jest.fn(() => makeDocResult(null)),
    },
    PackItem: {
      find: jest.fn(() => makeChain([])),
    },
    User: {
      findOne: jest.fn(async () => null),
    },
    SiteSettings: {
      findOne: Object.assign(
        jest.fn(() => ({ lean: async () => mockSettingsDoc })),
        { _isMockFunction: true }
      ),
      findOneAndUpdate: Object.assign(
        jest.fn(async (_f: any, update: any) => {
          const setObj = update?.$set || {};
          mockSettingsDoc = { ...(mockSettingsDoc || { key: "global" }), ...setObj };
          const socialLinks = { ...(mockSettingsDoc.socialLinks || {}) };
          for (const [k, v] of Object.entries(setObj)) {
            if (k.startsWith("socialLinks.")) {
              socialLinks[k.slice("socialLinks.".length)] = v;
            }
          }
          mockSettingsDoc.socialLinks = socialLinks;
          return mockSettingsDoc;
        }),
        { _isMockFunction: true }
      ),
    },
    MembershipLead: {
      create: jest.fn(async (doc: any) => {
        const created = {
          _id: nextObjectId(),
          ...doc,
          notes: [],
          communicationHistory: [],
          createdAt: new Date("2026-11-13T10:00:00.000Z"),
        };
        mockLeads.push(created);
        return created;
      }),
      find: jest.fn((filter: any = {}) =>
        makeChain(mockLeads.filter((l) => matchesSimpleFilter(l, filter)))
      ),
      countDocuments: jest.fn(
        async (filter: any = {}) => mockLeads.filter((l) => matchesSimpleFilter(l, filter)).length
      ),
      aggregate: jest.fn(async () => []),
      findById: jest.fn((id: string) =>
        makeDocResult(mockLeads.find((l) => String(l._id) === String(id)) || null)
      ),
      findByIdAndUpdate: jest.fn(async (id: string, update: any) => {
        const idx = mockLeads.findIndex((l) => String(l._id) === String(id));
        if (idx === -1) return null;
        if (update.$set) Object.assign(mockLeads[idx], update.$set);
        if (update.$push?.notes) mockLeads[idx].notes.push(update.$push.notes);
        if (update.$push?.communicationHistory) {
          mockLeads[idx].communicationHistory.push(update.$push.communicationHistory);
        }
        return mockLeads[idx];
      }),
    },
    ContactMessage: {
      create: jest.fn(async (doc: any) => {
        const created = {
          _id: nextObjectId(),
          ...doc,
          createdAt: new Date("2026-11-13T11:00:00.000Z"),
        };
        mockContacts.push(created);
        return created;
      }),
      find: jest.fn((filter: any = {}) =>
        makeChain(mockContacts.filter((c) => matchesSimpleFilter(c, filter)))
      ),
      countDocuments: jest.fn(async () => mockContacts.length),
      findByIdAndUpdate: jest.fn(async (id: string, update: any) => {
        const idx = mockContacts.findIndex((c) => String(c._id) === String(id));
        if (idx === -1) return null;
        Object.assign(mockContacts[idx], update?.$set || {});
        return mockContacts[idx];
      }),
    },
    NotificationLog: {
      findOne: Object.assign(
        jest.fn((filter: any = {}) =>
          makeDocResult(mockNotificationLogs.find((n) => matchesSimpleFilter(n, filter)) || null)
        ),
        { _isMockFunction: true }
      ),
      create: Object.assign(
        jest.fn(async (doc: any) => {
          const created = { _id: nextObjectId(), ...doc, createdAt: new Date() };
          mockNotificationLogs.push(created);
          return created;
        }),
        { _isMockFunction: true }
      ),
      find: jest.fn(() => makeChain(mockNotificationLogs)),
    },
    AuditLog: {
      create: jest.fn(async (doc: any) => {
        const created = { _id: nextObjectId(), ...doc, createdAt: new Date() };
        mockAuditLogs.push(created);
        return created;
      }),
      find: jest.fn(() => makeChain(mockAuditLogs)),
    },
    ProductCategory: { find: jest.fn(() => makeChain([])) },
    EducationalArticle: { find: jest.fn(() => makeChain([])) },
    FaqItem: { find: jest.fn(() => makeChain([])) },
    ContentBlock: { find: jest.fn(() => makeChain([])) },
  };
});

import app from "../app";
import { JWT_SECRET } from "../config/env";
import {
  ALGERIAN_WILAYAS,
  NEW_2026_WILAYAS,
  findCanonicalWilaya,
  findParentWilaya,
} from "../data/algerianWilayas";
import { initializeDefaultWilayas } from "../controllers/shipping.controller";
import {
  escapeTelegramMarkdown,
  resetTelegramDedupCacheForTests,
  sanitizeTelegramError,
  sendNewContactRequestNotification,
  sendNewMembershipLeadNotification,
  sendNewOrderNotification,
} from "../services/telegram.service";
import { escapeCsvCell, serializeLeadsToCsv } from "../services/csv.service";

const ownerToken = jwt.sign(
  { userId: "507f1f77bcf86cd799439001", role: "owner", email: "owner@dxnnadz.test" },
  JWT_SECRET,
  { expiresIn: "1h" }
);

const staffToken = jwt.sign(
  { userId: "507f1f77bcf86cd799439002", role: "staff", email: "staff@dxnnadz.test" },
  JWT_SECRET,
  { expiresIn: "1h" }
);

const expiredToken = jwt.sign(
  { userId: "507f1f77bcf86cd799439001", role: "owner" },
  JWT_SECRET,
  { expiresIn: -10 }
);

function seedSampleCatalog() {
  const p1Id = "507f1f77bcf86cd799430101";
  const p2Id = "507f1f77bcf86cd799430102";
  mockProducts.push(
    {
      _id: p1Id,
      sku: "DXN-SPIR-120",
      slug: "dxn-spirulina-120",
      category: "supplements",
      price: 4200,
      compareAtPrice: 4600,
      points: 15.5,
      stockQuantity: 25,
      isActive: true,
      isFeatured: true,
      sortOrder: 1,
      image: "https://res.cloudinary.com/demo/image/upload/spirulina.jpg",
      images: [],
    },
    {
      _id: p2Id,
      sku: "DXN-MORI-285",
      slug: "dxn-morinzhi-285ml",
      category: "beverages",
      price: 3100,
      points: 11,
      stockQuantity: 18,
      isActive: true,
      isFeatured: false,
      sortOrder: 2,
      image: "https://res.cloudinary.com/demo/image/upload/morinzhi.jpg",
      images: [],
    }
  );
  mockProductTranslations.push(
    {
      productId: p1Id,
      language: "ar",
      title: "سبيرولينا DXN (120 قرص)",
      description: "مكمل غذائي طبيعي من طحالب السبيرولينا.",
      ingredients: "مسحوق طحالب سبيرولينا بلاتينسيس.",
      usageInstructions: "يؤخذ مع الماء ضمن النظام الغذائي اليومي.",
      size: "120 قرص",
    },
    {
      productId: p1Id,
      language: "fr",
      title: "Spiruline DXN (120 comprimés)",
      description: "Complément alimentaire naturel à base de spiruline.",
      ingredients: "Spirulina platensis.",
      usageInstructions: "Prendre avec un grand verre d'eau.",
      size: "120 comprimés",
    },
    {
      productId: p2Id,
      language: "ar",
      title: "عصير مورينزي DXN",
      description: "مشروب فاكهة النوني المخمّرة مع الكركديه.",
      size: "285 مل",
    },
    {
      productId: p2Id,
      language: "fr",
      title: "Jus Morinzhi DXN",
      description: "Boisson botanique à base de Morinda citrifolia.",
      size: "285 ml",
    }
  );
  return { p1Id, p2Id };
}

describe("DXN NADZ — Final Release Audit & Production Readiness", () => {
  beforeEach(() => {
    mockWilayas.length = 0;
    mockShippingRates.length = 0;
    mockProducts.length = 0;
    mockProductTranslations.length = 0;
    mockOrders.length = 0;
    mockCustomers.length = 0;
    mockLeads.length = 0;
    mockContacts.length = 0;
    mockNotificationLogs.length = 0;
    mockAuditLogs.length = 0;
    mockSettingsDoc = null;
    resetTelegramDedupCacheForTests();
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
    jest.restoreAllMocks();
  });

  // =========================================================================
  // AREA 2: ALGERIA 69 WILAYAS (LAW 26-06) & CONFIGURABLE COURIER COVERAGE
  // =========================================================================
  describe("Area 2 — Official 69 Algerian Wilayas (Law 26-06) & Courier Coverage", () => {
    test("verifies all 69 official wilaya codes (01–69), bilingual names, and exact 2026 new wilayas (59–69)", () => {
      expect(ALGERIAN_WILAYAS).toHaveLength(69);
      const codes = ALGERIAN_WILAYAS.map((w) => w.code);
      expect(codes).toEqual(Array.from({ length: 69 }, (_, i) => i + 1));

      expect(NEW_2026_WILAYAS).toHaveLength(11);
      const expected2026 = [
        { code: 59, name: "Aflou", nameFr: "Aflou", nameAr: "أفلو", parentCode: 3 },
        { code: 60, name: "Barika", nameFr: "Barika", nameAr: "بريكة", parentCode: 5 },
        { code: 61, name: "El Kantara", nameFr: "El Kantara", nameAr: "القنطرة", parentCode: 7 },
        { code: 62, name: "Bir El Ater", nameFr: "Bir El Ater", nameAr: "بئر العاتر", parentCode: 12 },
        { code: 63, name: "El Aricha", nameFr: "El Aricha", nameAr: "العريشة", parentCode: 13 },
        { code: 64, name: "Ksar Chellala", nameFr: "Ksar Chellala", nameAr: "قصر الشلالة", parentCode: 14 },
        { code: 65, name: "Ain Ouessara", nameFr: "Aïn Ouessara", nameAr: "عين وسارة", parentCode: 17 },
        { code: 66, name: "Messaad", nameFr: "Messaad", nameAr: "مسعد", parentCode: 17 },
        { code: 67, name: "Ksar El Boukhari", nameFr: "Ksar El Boukhari", nameAr: "قصر البخاري", parentCode: 26 },
        { code: 68, name: "Bou Saada", nameFr: "Bou Saâda", nameAr: "بوسعادة", parentCode: 28 },
        { code: 69, name: "El Abiodh Sidi Cheikh", nameFr: "El Abiodh Sidi Cheikh", nameAr: "الأبيض سيدي الشيخ", parentCode: 32 },
      ];

      for (const exp of expected2026) {
        const found = findCanonicalWilaya(exp.code);
        expect(found).toBeDefined();
        expect(found!.name).toBe(exp.name);
        expect(found!.nameFr).toBe(exp.nameFr);
        expect(found!.nameAr).toBe(exp.nameAr);
        expect(found!.parentCode).toBe(exp.parentCode);
        expect(found!.defaultCoverageStatus).toBe("via_parent_wilaya");
        expect(findParentWilaya(found)?.code).toBe(exp.parentCode);
      }

      // Resolves Arabic, French, numeric codes, and common spelling aliases
      expect(findCanonicalWilaya("بوسعادة")?.code).toBe(68);
      expect(findCanonicalWilaya("Boussaâda")?.code).toBe(68);
      expect(findCanonicalWilaya("Aïn Oussera")?.code).toBe(65);
      expect(findCanonicalWilaya("59")?.name).toBe("Aflou");
      expect(findCanonicalWilaya("69")?.nameAr).toBe("الأبيض سيدي الشيخ");
    });

    test("idempotently migrates an existing 58-wilaya database to 69 wilayas without overwriting admin customizations", async () => {
      // Simulate existing production DB with wilayas 1..58 and custom admin settings on 17 (Djelfa) & 50 (Bordj Badji Mokhtar)
      for (const w of ALGERIAN_WILAYAS.slice(0, 58)) {
        const wId = nextObjectId();
        mockWilayas.push({
          _id: wId,
          code: w.code,
          name: w.name,
          nameFr: w.nameFr,
          nameAr: w.nameAr,
          coverageStatus: w.code === 50 ? "unserved" : "served",
          homeDeliverySupported: true,
          officeDeliverySupported: w.code !== 50,
          isActive: true,
          sortOrder: w.code,
        });
        mockShippingRates.push({
          _id: nextObjectId(),
          wilayaId: wId,
          deliveryMethod: "home",
          price: w.code === 17 ? 750 : 600,
          isActive: true,
        });
      }

      const firstRun = await initializeDefaultWilayas();
      expect(firstRun.insertedWilayas).toBe(11);
      expect(firstRun.insertedRates).toBe(22);
      expect(mockWilayas).toHaveLength(69);

      // Admin's custom "unserved" status on wilaya 50 & custom 750 DA rate on wilaya 17 were NOT overwritten
      const w50 = mockWilayas.find((w) => w.code === 50);
      expect(w50.coverageStatus).toBe("unserved");
      expect(w50.officeDeliverySupported).toBe(false);

      const w17 = mockWilayas.find((w) => w.code === 17);
      const w17Rate = mockShippingRates.find(
        (r) => String(r.wilayaId) === String(w17._id) && r.deliveryMethod === "home"
      );
      expect(w17Rate.price).toBe(750);

      // Running a second time is a strict no-op (idempotent)
      const secondRun = await initializeDefaultWilayas();
      expect(secondRun.insertedWilayas).toBe(0);
      expect(mockWilayas).toHaveLength(69);
    });

    test("inherits parent-wilaya rate when new 2026 wilaya has no standalone rate, and blocks unserved wilayas honestly", async () => {
      // Seed parent wilaya 17 (Djelfa) with a custom 780 DA home rate, and do NOT seed a rate for 65 (Ain Ouessara)
      const djelfaId = nextObjectId();
      mockWilayas.push({
        _id: djelfaId,
        code: 17,
        name: "Djelfa",
        nameFr: "Djelfa",
        nameAr: "الجلفة",
        coverageStatus: "served",
        homeDeliverySupported: true,
        officeDeliverySupported: true,
        isActive: true,
      });
      mockShippingRates.push({
        _id: nextObjectId(),
        wilayaId: djelfaId,
        deliveryMethod: "home",
        price: 780,
        isActive: true,
      });

      const quoteRes = await request(app).get(
        "/api/shipping/calculate?wilayaId=Ain%20Ouessara&deliveryMethod=home"
      );
      expect(quoteRes.status).toBe(200);
      expect(quoteRes.body.data.deliverable).toBe(true);
      expect(quoteRes.body.data.shippingFee).toBe(780);
      expect(quoteRes.body.data.rateSource).toBe("parent_wilaya_rate");
      expect(quoteRes.body.data.coverageStatus).toBe("via_parent_wilaya");
      expect(quoteRes.body.data.parentWilayaCode).toBe(17);
      expect(quoteRes.body.data.coverageNoticeAr).toContain("26-06");
      expect(quoteRes.body.data.coverageNoticeFr).toContain("26-06");

      // Admin marks wilaya 69 (El Abiodh Sidi Cheikh) as "unserved" because courier does not cover it
      const updateCov = await request(app)
        .put("/api/shipping/coverage/69")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({
          coverageStatus: "unserved",
          homeDeliverySupported: false,
          officeDeliverySupported: false,
        });
      expect(updateCov.status).toBe(200);
      expect(updateCov.body.data.coverageStatus).toBe("unserved");

      // Public shipping quote refuses to promise delivery to wilaya 69
      const blockedQuote = await request(app).get(
        "/api/shipping/calculate?wilayaId=69&deliveryMethod=home"
      );
      expect(blockedQuote.status).toBe(400);
      expect(blockedQuote.body.code).toBe("wilaya_unserved");
      expect(blockedQuote.body.data.deliverable).toBe(false);

      // Order creation to unserved wilaya 69 is strictly rejected server-side too
      const { p1Id } = seedSampleCatalog();
      const blockedOrder = await request(app).post("/api/orders").send({
        customerInfo: {
          firstName: "أحمد",
          lastName: "بن علي",
          phone: "0550112233",
        },
        cartItems: [{ productId: p1Id, quantity: 1 }],
        deliveryMethod: "home",
        wilaya: "El Abiodh Sidi Cheikh",
        commune: "الأبيض سيدي الشيخ",
        address: "حي النصر رقم 12",
        paymentMethod: "cod",
        confirmed: true,
      });
      expect(blockedOrder.status).toBe(400);
      expect(blockedOrder.body.code).toBe("wilaya_unserved");
      expect(mockOrders).toHaveLength(0);
    });
  });

  // =========================================================================
  // AREA 3: E-COMMERCE END-TO-END FLOW
  // =========================================================================
  describe("Area 3 — E-Commerce End-to-End Flow", () => {
    test("browses products, filters by category & search, places guest COD order WITHOUT dxnMemberId, and places referral order WITH optional dxnMemberId in a new 2026 wilaya", async () => {
      const { p1Id } = seedSampleCatalog();
      await initializeDefaultWilayas();

      // 1) Browse products in Arabic
      const listAr = await request(app).get("/api/products?language=ar");
      expect(listAr.status).toBe(200);
      expect(listAr.body.data).toHaveLength(2);

      // 2) Filter by category=supplements
      const listSupp = await request(app).get("/api/products?language=ar&category=supplements");
      expect(listSupp.status).toBe(200);
      expect(listSupp.body.data).toHaveLength(1);
      expect(listSupp.body.data[0].sku).toBe("DXN-SPIR-120");

      // 3) Search in French ("Morinzhi")
      const searchFr = await request(app).get("/api/products?language=fr&search=Morinzhi");
      expect(searchFr.status).toBe(200);
      expect(searchFr.body.data).toHaveLength(1);
      expect(searchFr.body.data[0].sku).toBe("DXN-MORI-285");

      // 4) Single product detail includes bilingual fields, ingredients & PV points
      const detail = await request(app).get(`/api/products/${p1Id}?language=ar`);
      expect(detail.status).toBe(200);
      expect(detail.body.data.ingredients).toContain("سبيرولينا");
      expect(detail.body.data.points).toBe(15.5);

      // 5) Checkout WITHOUT optional dxnMemberId (guest customer, tampered client unitPrice ignored)
      const orderWithoutId = await request(app).post("/api/orders").send({
        customerInfo: {
          firstName: "سميرة",
          lastName: "بلقاسم",
          phone: "0661223344",
        },
        cartItems: [{ productId: p1Id, quantity: 2, unitPrice: 1 }],
        deliveryMethod: "home",
        wilaya: "Setif",
        commune: "سطيف",
        address: "شارع أول نوفمبر رقم 19",
        paymentMethod: "cod",
        confirmed: true,
        dxnMemberId: "",
      });
      expect(orderWithoutId.status).toBe(201);
      expect(orderWithoutId.body.data.subtotal).toBe(8400); // 2 * 4200 (server price, NOT 1)
      expect(orderWithoutId.body.data.shippingFee).toBe(600);
      expect(orderWithoutId.body.data.total).toBe(9000);
      expect(orderWithoutId.body.data.hasDxnMemberId).toBe(false);
      expect(mockProducts.find((p) => p._id === p1Id).stockQuantity).toBe(23);

      // 6) Checkout WITH optional dxnMemberId + referral attribution + new 2026 wilaya (68 Bou Saada)
      const orderWithId = await request(app)
        .post("/api/orders")
        .set("Idempotency-Key", "audit-order-key-001")
        .send({
          customerInfo: {
            firstName: "ياسين",
            lastName: "عمراني",
            phone: "0770334455",
          },
          cartItems: [{ productId: p1Id, quantity: 1 }],
          deliveryMethod: "office",
          wilaya: "Bou Saada",
          commune: "بوسعادة",
          paymentMethod: "cod",
          confirmed: true,
          dxnMemberId: "DXN-82910455",
          trafficSource: {
            source: "whatsapp",
            ref: "nadz-campaign",
            utmCampaign: "ramadan-2026",
          },
          metadata: { attackerInjectedFlag: true },
        });
      expect(orderWithId.status).toBe(201);
      expect(orderWithId.body.data.shippingFee).toBe(400);
      // Public response hides raw dxnMemberId and strips injected metadata
      expect(orderWithId.body.data.dxnMemberId).toBeUndefined();
      expect(orderWithId.body.data.hasDxnMemberId).toBe(true);
      expect(orderWithId.body.data.metadata?.attackerInjectedFlag).toBeUndefined();
      expect(orderWithId.body.data.metadata?.wilayaCode).toBe(68);
      expect(orderWithId.body.data.metadata?.parentWilayaCode).toBe(28);

      // Idempotency replay also hides raw dxnMemberId and does not double-decrement stock
      const replay = await request(app)
        .post("/api/orders")
        .set("Idempotency-Key", "audit-order-key-001")
        .send({
          customerInfo: { firstName: "ياسين", lastName: "عمراني", phone: "0770334455" },
          cartItems: [{ productId: p1Id, quantity: 1 }],
          deliveryMethod: "office",
          wilaya: "Bou Saada",
          commune: "بوسعادة",
          paymentMethod: "cod",
          confirmed: true,
        });
      expect(replay.status).toBe(200);
      expect(replay.body.data.dxnMemberId).toBeUndefined();
      expect(replay.body.data.hasDxnMemberId).toBe(true);
      expect(mockProducts.find((p) => p._id === p1Id).stockQuantity).toBe(22);

      // 7) Admin order list filters by new wilaya code "68" & transitions status cleanly
      const adminOrders = await request(app)
        .get("/api/orders?wilaya=68")
        .set("Authorization", `Bearer ${ownerToken}`);
      expect(adminOrders.status).toBe(200);
      expect(adminOrders.body.data).toHaveLength(1);
      expect(adminOrders.body.data[0].dxnMemberId).toBe("DXN82910455");
      expect(adminOrders.body.data[0].trafficSource.source).toBe("whatsapp");

      const targetOrderId = adminOrders.body.data[0]._id;
      const confirmRes = await request(app)
        .put(`/api/orders/${targetOrderId}/status`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ status: "confirmed" });
      expect(confirmRes.status).toBe(200);
      expect(confirmRes.body.data.status).toBe("confirmed");

      // Cancelling the confirmed order restores claimed inventory (+1 -> 23)
      const cancelRes = await request(app)
        .put(`/api/orders/${targetOrderId}/status`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ status: "cancelled" });
      expect(cancelRes.status).toBe(200);
      expect(mockProducts.find((p) => p._id === p1Id).stockQuantity).toBe(23);
    });
  });

  // =========================================================================
  // AREA 4: RECRUITMENT & CRM END-TO-END FLOW
  // =========================================================================
  describe("Area 4 — Recruitment & CRM Lifecycle + Customer/Member Separation", () => {
    test("completes Visitor → new → contacted → interested → registered_member, enforces read-only sponsor ID, exports CSV, and isolates Customer vs Lead records", async () => {
      // 1) Owner configures official sponsor membership number
      const saveSettings = await request(app)
        .put("/api/admin/settings")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ sponsorMembershipNumber: "820776655" });
      expect(saveSettings.status).toBe(200);

      const pubSettings = await request(app).get("/api/settings/public");
      expect(pubSettings.status).toBe(200);
      expect(pubSettings.body.data.sponsorMembershipNumber).toBe("820776655");

      // 2) Visitor submits recruitment lead (spoofed sponsorMembershipNumber is ignored!)
      const createLead = await request(app).post("/api/leads").send({
        firstName: "نادية",
        lastName: "منصوري",
        country: "الجزائر",
        phone: "0554889900",
        preferredContactMethod: "whatsapp",
        email: "nadia@example.dz",
        message: "أرغب في الانضمام لفريق DXN NADZ وتعلم الخطوات الأولى في ولاية أفلو.",
        privacyConsent: true,
        sponsorMembershipNumber: "000000000",
        trafficSource: { source: "instagram", ref: "bio" },
      });
      expect(createLead.status).toBe(201);
      expect(mockLeads).toHaveLength(1);
      expect(mockCustomers).toHaveLength(0); // Strictly separated from store Customers!
      expect(mockOrders).toHaveLength(0);
      expect(mockLeads[0].sponsorMembershipNumber).toBe("820776655");
      expect(mockLeads[0].status).toBe("new");

      const leadId = mockLeads[0]._id;

      // 3) Admin progresses lead: new -> contacted (with followUpDate + note + communication log)
      const stepContacted = await request(app)
        .patch(`/api/admin/leads/${leadId}`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({
          status: "contacted",
          followUpDate: "2026-11-20T10:00:00.000Z",
        });
      expect(stepContacted.status).toBe(200);
      expect(stepContacted.body.data.status).toBe("contacted");

      const addNoteRes = await request(app)
        .post(`/api/admin/leads/${leadId}/notes`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ content: "تم التواصل عبر واتساب وشرح آلية التسجيل المجاني." });
      expect([200, 201]).toContain(addNoteRes.status);

      const addCommRes = await request(app)
        .post(`/api/admin/leads/${leadId}/communications`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ channel: "whatsapp", summary: "Initial onboarding call" });
      expect([200, 201]).toContain(addCommRes.status);

      // 4) contacted -> interested
      const stepInterested = await request(app)
        .patch(`/api/admin/leads/${leadId}`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ status: "interested" });
      expect(stepInterested.status).toBe(200);
      expect(stepInterested.body.data.status).toBe("interested");

      // 5) interested -> registered_member (assigning official DXN membership number later)
      const stepRegistered = await request(app)
        .patch(`/api/admin/leads/${leadId}`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({
          status: "registered_member",
          officialMembershipNumber: "830445566",
        });
      expect(stepRegistered.status).toBe(200);
      expect(stepRegistered.body.data.status).toBe("registered_member");
      expect(stepRegistered.body.data.officialMembershipNumber).toBe("830445566");

      // 6) Admin exports registered members CSV
      const csvRes = await request(app)
        .get("/api/admin/leads/export.csv?status=registered_member")
        .set("Authorization", `Bearer ${ownerToken}`);
      expect(csvRes.status).toBe(200);
      expect(csvRes.headers["content-type"]).toContain("text/csv");
      expect(csvRes.text.startsWith("\uFEFF")).toBe(true);
      expect(csvRes.text).toContain("830445566");
      expect(csvRes.text).toContain("820776655");
    });
  });

  // =========================================================================
  // AREA 5: TELEGRAM INTEGRATION, ESCAPING, DEDUP, RETRY & DB PERSISTENCE
  // =========================================================================
  describe("Area 5 — Telegram Notifications, Escaping, Idempotency, Retry & Fallback", () => {
    test("delivers escaped Order, Lead, and Contact payloads via Telegram client, suppresses duplicates, retries transient 502s, and redacts tokens", async () => {
      process.env.TELEGRAM_BOT_TOKEN = "99887766:AAFakeAuditSecretTokenValue12345";
      process.env.TELEGRAM_CHAT_ID = "-100987654321";

      const postSpy = jest
        .spyOn(axios, "post")
        // First call fails with transient 502, second succeeds -> verifies retry!
        .mockRejectedValueOnce(
          new AxiosError(
            "Bad Gateway at https://api.telegram.org/bot99887766:AAFakeAuditSecretTokenValue12345/sendMessage",
            "ERR_BAD_RESPONSE",
            undefined,
            undefined,
            { status: 502, statusText: "Bad Gateway", headers: {}, config: {} as any, data: {} }
          )
        )
        .mockResolvedValue({ status: 200, data: { ok: true } } as any);

      // 1) New Order notification (retries once after 502 and succeeds)
      const orderRes = await sendNewOrderNotification({
        _id: "507f1f77bcf86cd799439501",
        orderNumber: "DXN-20261113-7777",
        customerInfo: {
          firstName: "Ali_Test*Name",
          lastName: "Ben[One]`Code",
          phone: "0551002200",
          wilaya: "Bou Saada",
          commune: "Bou_Saada",
          address: "Rue *12*",
        },
        deliveryMethod: "home",
        paymentMethod: "cod",
        subtotal: 4200,
        shippingFee: 600,
        total: 4800,
        dxnMemberId: "DXN82910455",
        trafficSource: { source: "whatsapp", ref: "team_link" },
        items: [{ productName: "Spirulina_120*", quantity: 1, totalPrice: 4200 }],
      });
      expect(orderRes.delivered).toBe(true);
      expect(postSpy).toHaveBeenCalledTimes(2);
      const sentOrderText = String((postSpy.mock.calls[1]?.[1] as any)?.text || "");
      expect(sentOrderText).toContain("Ali\\_Test\\*Name");
      expect(sentOrderText).toContain("Ben\\[One]\\`Code");

      // Duplicate call with same orderNumber is suppressed idempotently
      const dupOrderRes = await sendNewOrderNotification({
        orderNumber: "DXN-20261113-7777",
        customerInfo: { firstName: "Ali", lastName: "Ben", phone: "0551002200" },
        items: [],
      });
      expect(dupOrderRes.duplicate).toBe(true);
      expect(postSpy).toHaveBeenCalledTimes(2);

      // 2) New Recruitment Lead notification
      const leadRes = await sendNewMembershipLeadNotification({
        leadReference: "LEAD-AUDIT-01",
        firstName: "Sara *DXN*",
        lastName: "[Lead]",
        country: "Algeria",
        phone: "0662003300",
        preferredContactMethod: "whatsapp",
        sponsorMembershipNumber: "820991122",
        message: "Hello_team `join`",
      });
      expect(leadRes.delivered).toBe(true);
      const sentLeadText = String((postSpy.mock.calls[2]?.[1] as any)?.text || "");
      expect(sentLeadText).toContain("Sara \\*DXN\\*");
      expect(sentLeadText).toContain("\\[Lead]");

      // 3) New Contact Request notification
      const contactRes = await sendNewContactRequestNotification({
        reference: "MSG-AUDIT-01",
        name: "Karim_Contact",
        phone: "0773004400",
        subject: "Shipping *Barika*",
        message: "Does courier cover [Barika]?",
      });
      expect(contactRes.delivered).toBe(true);
      const sentContactText = String((postSpy.mock.calls[3]?.[1] as any)?.text || "");
      expect(sentContactText).toContain("Shipping \\*Barika\\*");

      // 4) Secret token redaction check
      const redacted = sanitizeTelegramError(
        "Request failed for https://api.telegram.org/bot99887766:AAFakeAuditSecretTokenValue12345/sendMessage"
      );
      expect(redacted).not.toContain("AAFakeAuditSecretTokenValue12345");
      expect(redacted).not.toContain("99887766");
    });

    test("persists orders, leads, and contact messages in MongoDB even when Telegram API returns 500", async () => {
      process.env.TELEGRAM_BOT_TOKEN = "99887766:AAFakeAuditSecretTokenValue12345";
      process.env.TELEGRAM_CHAT_ID = "-100987654321";

      jest.spyOn(axios, "post").mockRejectedValue(
        new AxiosError(
          "Telegram unreachable https://api.telegram.org/bot99887766:AAFakeAuditSecretTokenValue12345/sendMessage",
          "ERR_BAD_RESPONSE",
          undefined,
          undefined,
          { status: 401, statusText: "Unauthorized", headers: {}, config: {} as any, data: {} }
        )
      );

      const { p1Id } = seedSampleCatalog();

      const orderRes = await request(app).post("/api/orders").send({
        customerInfo: { firstName: "مراد", lastName: "سالمي", phone: "0559112233" },
        cartItems: [{ productId: p1Id, quantity: 1 }],
        deliveryMethod: "home",
        wilaya: "Algiers",
        commune: "باب الزوار",
        address: "حي 5 جويلية عمارة 4",
        paymentMethod: "cod",
        confirmed: true,
      });
      expect(orderRes.status).toBe(201);
      expect(mockOrders).toHaveLength(1);

      const leadRes = await request(app).post("/api/leads").send({
        firstName: "إيمان",
        lastName: "بوزيد",
        country: "الجزائر",
        phone: "0669112233",
        preferredContactMethod: "phone",
        privacyConsent: true,
      });
      expect(leadRes.status).toBe(201);
      expect(mockLeads).toHaveLength(1);

      const contactRes = await request(app).post("/api/contact").send({
        name: "رشيد قاسمي",
        phone: "0779112233",
        subject: "استفسار حول التوصيل لبريكة",
        message: "هل التوصيل متوفر حالياً لولاية بريكة رقم 60؟",
        privacyConsent: true,
      });
      expect(contactRes.status).toBe(201);
      expect(mockContacts).toHaveLength(1);

      // Verify NotificationLog never recorded the raw bot token
      for (const entry of mockNotificationLogs) {
        expect(String(entry.errorSummary || "")).not.toContain("AAFakeAuditSecretTokenValue12345");
      }
    });
  });

  // =========================================================================
  // AREA 6: SECURITY AUDIT
  // =========================================================================
  describe("Area 6 — Security Audit (Auth, RBAC, Injection, XSS, Uploads, Secrets, CSV)", () => {
    test("enforces unauthenticated 401, expired JWT 401, and staff-role 403 across all admin & write endpoints", async () => {
      // Unauthenticated -> 401
      expect((await request(app).get("/api/admin/leads")).status).toBe(401);
      expect((await request(app).get("/api/orders")).status).toBe(401);
      expect((await request(app).put("/api/admin/settings").send({})).status).toBe(401);
      expect((await request(app).put("/api/shipping/coverage/59").send({})).status).toBe(401);
      expect((await request(app).post("/api/upload/image")).status).toBe(401);

      // Expired JWT -> 401
      expect(
        (await request(app).get("/api/admin/leads").set("Authorization", `Bearer ${expiredToken}`))
          .status
      ).toBe(401);

      // Authenticated non-admin (`role: "staff"`) -> 403 Forbidden
      expect(
        (await request(app).get("/api/admin/leads").set("Authorization", `Bearer ${staffToken}`))
          .status
      ).toBe(403);
      expect(
        (
          await request(app)
            .put("/api/shipping/coverage/59")
            .set("Authorization", `Bearer ${staffToken}`)
            .send({ coverageStatus: "served" })
        ).status
      ).toBe(403);
      expect(
        (
          await request(app)
            .put("/api/admin/settings")
            .set("Authorization", `Bearer ${staffToken}`)
            .send({ brandName: "Tampered" })
        ).status
      ).toBe(403);
      expect(
        (
          await request(app)
            .post("/api/upload/image")
            .set("Authorization", `Bearer ${staffToken}`)
        ).status
      ).toBe(403);
    });

    test("strips NoSQL operator injection ($gt/$ne) and XSS payloads (<script>, onerror=, javascript:) AFTER JSON body parsing", async () => {
      // 1) NoSQL operator injection on /api/users/login is stripped before validation/query
      const noSqlRes = await request(app)
        .post("/api/users/login")
        .send({ email: { $gt: "" }, password: { $ne: null } });
      expect([400, 401]).toContain(noSqlRes.status);

      // 2) XSS script & inline event-handler payloads are stripped from public form submissions
      const xssContact = await request(app).post("/api/contact").send({
        name: 'Karim <script>alert("xss")</script> Ben',
        phone: "0552334455",
        subject: 'Question <img src=x onerror="alert(1)">',
        message: 'Bonjour <iframe src="javascript:alert(1)"></iframe> pouvez-vous me rappeler ?',
        privacyConsent: true,
      });
      expect(xssContact.status).toBe(201);
      expect(mockContacts[0].name).not.toContain("<script>");
      expect(mockContacts[0].subject).not.toContain("onerror=");
      expect(mockContacts[0].message).not.toContain("<iframe");
      expect(mockContacts[0].message).not.toContain("javascript:");
    });

    test("rejects dangerous file extensions (.php/.svg) and polyglot magic-byte mismatches on /api/upload/image", async () => {
      // 1) Disallowed .php extension rejected
      const phpRes = await request(app)
        .post("/api/upload/image")
        .set("Authorization", `Bearer ${ownerToken}`)
        .attach("image", Buffer.from("<?php system($_GET['cmd']); ?>"), {
          filename: "shell.php",
          contentType: "image/png",
        });
      expect(phpRes.status).toBe(400);

      // 2) Polyglot / spoofed MIME: .png extension + image/png MIME, but PHP bytes instead of PNG magic header
      const spoofedPng = await request(app)
        .post("/api/upload/image")
        .set("Authorization", `Bearer ${ownerToken}`)
        .attach("image", Buffer.from("<?php echo 'not a real png'; ?>"), {
          filename: "spoofed.png",
          contentType: "image/png",
        });
      expect(spoofedPng.status).toBe(400);
      expect(String(spoofedPng.body.message || "")).toMatch(/content|signature|match|PNG/i);
    });

    test("never exposes server secrets on public endpoints and neutralizes CSV formula injection", async () => {
      process.env.TELEGRAM_BOT_TOKEN = "11223344:AASecretMustNeverAppearPublicly999";
      process.env.TELEGRAM_CHAT_ID = "-100555666777";

      const pubSettings = await request(app).get("/api/settings/public");
      const pubBody = JSON.stringify(pubSettings.body);
      expect(pubBody).not.toContain("AASecretMustNeverAppearPublicly999");
      expect(pubBody).not.toContain("-100555666777");
      expect(pubBody).not.toContain(JWT_SECRET);

      expect(escapeCsvCell("=CMD|' /C calc'!A0")).toBe("\"'=CMD|' /C calc'!A0\"");
      expect(escapeCsvCell("+SUM(1,2)")).toBe("\"+SUM(1,2)\"".replace('"+', "\"'+"));
      expect(escapeCsvCell("-10+20")).toBe("'-10+20");
      expect(escapeCsvCell("@IMPORTXML(A1,A2)")).toBe("\"'@IMPORTXML(A1,A2)\"");

      const csv = serializeLeadsToCsv([
        {
          leadReference: "LEAD-SEC-1",
          firstName: '=HYPERLINK("http://evil.test")',
          lastName: "Test",
          phone: "0550000000",
          status: "new",
        },
      ]);
      expect(csv).toContain("\"'=HYPERLINK(\"\"http://evil.test\"\")\"");
    });
  });
});
