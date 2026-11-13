/**
 * Canonical list of Algeria's 69 official wilayas (codes 01–69):
 * - Codes 01–48: historical 48 wilayas (Law n° 84-09)
 * - Codes 49–58: 10 southern wilayas established in 2019 (Law n° 19-12)
 * - Codes 59–69: 11 wilayas established by Law n° 26-06 of 4 April 2026
 *   (Journal Officiel n° 25 of 5 April 2026) with official codes and chefs-lieux
 *   promulgated by Presidential Decree n° 26-206 of 25 May 2026 (JO n° 40 of
 *   3 June 2026).
 *
 * IMPORTANT — Legal status vs. courier coverage:
 * Legal creation of a wilaya does NOT automatically establish direct courier
 * coverage. Major Algerian couriers (e.g. Yalidine, ZR Express) route parcels
 * for newly created wilayas (59–69) through their parent wilaya + commune
 * during the administrative transition period, and certain remote southern
 * wilayas require phone/courier verification or lack stop-desk offices.
 * Per-wilaya delivery coverage is therefore modelled explicitly and remains
 * configurable in MongoDB (`Wilaya.coverageStatus`, `homeDeliverySupported`,
 * `officeDeliverySupported`) without hardcoding assumptions across UI pages.
 */

export type WilayaCoverageStatus =
  | "served"
  | "via_parent_wilaya"
  | "confirm_by_phone"
  | "unserved";

export interface AlgerianWilaya {
  code: number;
  /** Canonical romanized name stored on Order/Customer records (stable across migrations). */
  name: string;
  /** Official French display name (Journal Officiel). */
  nameFr: string;
  /** Official Arabic display name (الجريدة الرسمية). */
  nameAr: string;
  /** Alternate spellings / transliterations accepted by `findCanonicalWilaya`. */
  aliases?: string[];
  /** Year of territorial reform when created after 1984. */
  reformYear?: 2019 | 2026;
  /** Parent wilaya code (for Law 26-06 wilayas 59–69 used for transitional courier routing/rate fallback). */
  parentCode?: number;
  /** Canonical name of the parent wilaya. */
  parentName?: string;
  /** Default courier coverage status used when seeding `Wilaya` documents (overridable in Admin). */
  defaultCoverageStatus: WilayaCoverageStatus;
  /** Default home-delivery availability (overridable in Admin). */
  defaultHomeDelivery: boolean;
  /** Default stop-desk / office-delivery availability (overridable in Admin). */
  defaultOfficeDelivery: boolean;
}

export const ALGERIAN_WILAYAS: AlgerianWilaya[] = [
  { code: 1, name: "Adrar", nameFr: "Adrar", nameAr: "أدرار", defaultCoverageStatus: "served", defaultHomeDelivery: true, defaultOfficeDelivery: true },
  { code: 2, name: "Chlef", nameFr: "Chlef", nameAr: "الشلف", defaultCoverageStatus: "served", defaultHomeDelivery: true, defaultOfficeDelivery: true },
  { code: 3, name: "Laghouat", nameFr: "Laghouat", nameAr: "الأغواط", defaultCoverageStatus: "served", defaultHomeDelivery: true, defaultOfficeDelivery: true },
  { code: 4, name: "Oum El Bouaghi", nameFr: "Oum El Bouaghi", nameAr: "أم البواقي", defaultCoverageStatus: "served", defaultHomeDelivery: true, defaultOfficeDelivery: true },
  { code: 5, name: "Batna", nameFr: "Batna", nameAr: "باتنة", defaultCoverageStatus: "served", defaultHomeDelivery: true, defaultOfficeDelivery: true },
  { code: 6, name: "Bejaia", nameFr: "Béjaïa", nameAr: "بجاية", aliases: ["Bgayet"], defaultCoverageStatus: "served", defaultHomeDelivery: true, defaultOfficeDelivery: true },
  { code: 7, name: "Biskra", nameFr: "Biskra", nameAr: "بسكرة", defaultCoverageStatus: "served", defaultHomeDelivery: true, defaultOfficeDelivery: true },
  { code: 8, name: "Bechar", nameFr: "Béchar", nameAr: "بشار", defaultCoverageStatus: "served", defaultHomeDelivery: true, defaultOfficeDelivery: true },
  { code: 9, name: "Blida", nameFr: "Blida", nameAr: "البليدة", defaultCoverageStatus: "served", defaultHomeDelivery: true, defaultOfficeDelivery: true },
  { code: 10, name: "Bouira", nameFr: "Bouira", nameAr: "البويرة", defaultCoverageStatus: "served", defaultHomeDelivery: true, defaultOfficeDelivery: true },
  { code: 11, name: "Tamanrasset", nameFr: "Tamanrasset", nameAr: "تمنراست", aliases: ["Tamanghasset"], defaultCoverageStatus: "served", defaultHomeDelivery: true, defaultOfficeDelivery: true },
  { code: 12, name: "Tebessa", nameFr: "Tébessa", nameAr: "تبسة", defaultCoverageStatus: "served", defaultHomeDelivery: true, defaultOfficeDelivery: true },
  { code: 13, name: "Tlemcen", nameFr: "Tlemcen", nameAr: "تلمسان", defaultCoverageStatus: "served", defaultHomeDelivery: true, defaultOfficeDelivery: true },
  { code: 14, name: "Tiaret", nameFr: "Tiaret", nameAr: "تيارت", defaultCoverageStatus: "served", defaultHomeDelivery: true, defaultOfficeDelivery: true },
  { code: 15, name: "Tizi Ouzou", nameFr: "Tizi Ouzou", nameAr: "تيزي وزو", defaultCoverageStatus: "served", defaultHomeDelivery: true, defaultOfficeDelivery: true },
  { code: 16, name: "Algiers", nameFr: "Alger", nameAr: "الجزائر", aliases: ["El Djazair"], defaultCoverageStatus: "served", defaultHomeDelivery: true, defaultOfficeDelivery: true },
  { code: 17, name: "Djelfa", nameFr: "Djelfa", nameAr: "الجلفة", defaultCoverageStatus: "served", defaultHomeDelivery: true, defaultOfficeDelivery: true },
  { code: 18, name: "Jijel", nameFr: "Jijel", nameAr: "جيجل", defaultCoverageStatus: "served", defaultHomeDelivery: true, defaultOfficeDelivery: true },
  { code: 19, name: "Setif", nameFr: "Sétif", nameAr: "سطيف", defaultCoverageStatus: "served", defaultHomeDelivery: true, defaultOfficeDelivery: true },
  { code: 20, name: "Saida", nameFr: "Saïda", nameAr: "سعيدة", defaultCoverageStatus: "served", defaultHomeDelivery: true, defaultOfficeDelivery: true },
  { code: 21, name: "Skikda", nameFr: "Skikda", nameAr: "سكيكدة", defaultCoverageStatus: "served", defaultHomeDelivery: true, defaultOfficeDelivery: true },
  { code: 22, name: "Sidi Bel Abbes", nameFr: "Sidi Bel Abbès", nameAr: "سيدي بلعباس", defaultCoverageStatus: "served", defaultHomeDelivery: true, defaultOfficeDelivery: true },
  { code: 23, name: "Annaba", nameFr: "Annaba", nameAr: "عنابة", defaultCoverageStatus: "served", defaultHomeDelivery: true, defaultOfficeDelivery: true },
  { code: 24, name: "Guelma", nameFr: "Guelma", nameAr: "قالمة", defaultCoverageStatus: "served", defaultHomeDelivery: true, defaultOfficeDelivery: true },
  { code: 25, name: "Constantine", nameFr: "Constantine", nameAr: "قسنطينة", defaultCoverageStatus: "served", defaultHomeDelivery: true, defaultOfficeDelivery: true },
  { code: 26, name: "Medea", nameFr: "Médéa", nameAr: "المدية", defaultCoverageStatus: "served", defaultHomeDelivery: true, defaultOfficeDelivery: true },
  { code: 27, name: "Mostaganem", nameFr: "Mostaganem", nameAr: "مستغانم", defaultCoverageStatus: "served", defaultHomeDelivery: true, defaultOfficeDelivery: true },
  { code: 28, name: "M'Sila", nameFr: "M'Sila", nameAr: "المسيلة", aliases: ["Msila", "M Sila"], defaultCoverageStatus: "served", defaultHomeDelivery: true, defaultOfficeDelivery: true },
  { code: 29, name: "Mascara", nameFr: "Mascara", nameAr: "معسكر", defaultCoverageStatus: "served", defaultHomeDelivery: true, defaultOfficeDelivery: true },
  { code: 30, name: "Ouargla", nameFr: "Ouargla", nameAr: "ورقلة", defaultCoverageStatus: "served", defaultHomeDelivery: true, defaultOfficeDelivery: true },
  { code: 31, name: "Oran", nameFr: "Oran", nameAr: "وهران", defaultCoverageStatus: "served", defaultHomeDelivery: true, defaultOfficeDelivery: true },
  { code: 32, name: "El Bayadh", nameFr: "El Bayadh", nameAr: "البيض", defaultCoverageStatus: "served", defaultHomeDelivery: true, defaultOfficeDelivery: true },
  { code: 33, name: "Illizi", nameFr: "Illizi", nameAr: "إليزي", defaultCoverageStatus: "served", defaultHomeDelivery: true, defaultOfficeDelivery: true },
  { code: 34, name: "Bordj Bou Arreridj", nameFr: "Bordj Bou Arréridj", nameAr: "برج بوعريريج", defaultCoverageStatus: "served", defaultHomeDelivery: true, defaultOfficeDelivery: true },
  { code: 35, name: "Boumerdes", nameFr: "Boumerdès", nameAr: "بومرداس", defaultCoverageStatus: "served", defaultHomeDelivery: true, defaultOfficeDelivery: true },
  { code: 36, name: "El Tarf", nameFr: "El Tarf", nameAr: "الطارف", defaultCoverageStatus: "served", defaultHomeDelivery: true, defaultOfficeDelivery: true },
  { code: 37, name: "Tindouf", nameFr: "Tindouf", nameAr: "تندوف", defaultCoverageStatus: "served", defaultHomeDelivery: true, defaultOfficeDelivery: true },
  { code: 38, name: "Tissemsilt", nameFr: "Tissemsilt", nameAr: "تيسمسيلت", defaultCoverageStatus: "served", defaultHomeDelivery: true, defaultOfficeDelivery: true },
  { code: 39, name: "El Oued", nameFr: "El Oued", nameAr: "الوادي", defaultCoverageStatus: "served", defaultHomeDelivery: true, defaultOfficeDelivery: true },
  { code: 40, name: "Khenchela", nameFr: "Khenchela", nameAr: "خنشلة", defaultCoverageStatus: "served", defaultHomeDelivery: true, defaultOfficeDelivery: true },
  { code: 41, name: "Souk Ahras", nameFr: "Souk Ahras", nameAr: "سوق أهراس", defaultCoverageStatus: "served", defaultHomeDelivery: true, defaultOfficeDelivery: true },
  { code: 42, name: "Tipaza", nameFr: "Tipaza", nameAr: "تيبازة", defaultCoverageStatus: "served", defaultHomeDelivery: true, defaultOfficeDelivery: true },
  { code: 43, name: "Mila", nameFr: "Mila", nameAr: "ميلة", defaultCoverageStatus: "served", defaultHomeDelivery: true, defaultOfficeDelivery: true },
  { code: 44, name: "Ain Defla", nameFr: "Aïn Defla", nameAr: "عين الدفلى", defaultCoverageStatus: "served", defaultHomeDelivery: true, defaultOfficeDelivery: true },
  { code: 45, name: "Naama", nameFr: "Naâma", nameAr: "النعامة", defaultCoverageStatus: "served", defaultHomeDelivery: true, defaultOfficeDelivery: true },
  { code: 46, name: "Ain Temouchent", nameFr: "Aïn Témouchent", nameAr: "عين تموشنت", defaultCoverageStatus: "served", defaultHomeDelivery: true, defaultOfficeDelivery: true },
  { code: 47, name: "Ghardaia", nameFr: "Ghardaïa", nameAr: "غرداية", defaultCoverageStatus: "served", defaultHomeDelivery: true, defaultOfficeDelivery: true },
  { code: 48, name: "Relizane", nameFr: "Relizane", nameAr: "غليزان", defaultCoverageStatus: "served", defaultHomeDelivery: true, defaultOfficeDelivery: true },
  // 2019 territorial reform (Law n° 19-12) — codes 49–58
  { code: 49, name: "Timimoun", nameFr: "Timimoun", nameAr: "تيميمون", reformYear: 2019, defaultCoverageStatus: "served", defaultHomeDelivery: true, defaultOfficeDelivery: true },
  { code: 50, name: "Bordj Badji Mokhtar", nameFr: "Bordj Badji Mokhtar", nameAr: "برج باجي مختار", reformYear: 2019, defaultCoverageStatus: "confirm_by_phone", defaultHomeDelivery: true, defaultOfficeDelivery: true },
  { code: 51, name: "Ouled Djellal", nameFr: "Ouled Djellal", nameAr: "أولاد جلال", reformYear: 2019, defaultCoverageStatus: "served", defaultHomeDelivery: true, defaultOfficeDelivery: true },
  { code: 52, name: "Beni Abbes", nameFr: "Béni Abbès", nameAr: "بني عباس", reformYear: 2019, defaultCoverageStatus: "served", defaultHomeDelivery: true, defaultOfficeDelivery: true },
  { code: 53, name: "In Salah", nameFr: "In Salah", nameAr: "عين صالح", aliases: ["Ain Salah", "Aïn Salah"], reformYear: 2019, defaultCoverageStatus: "served", defaultHomeDelivery: true, defaultOfficeDelivery: true },
  { code: 54, name: "In Guezzam", nameFr: "In Guezzam", nameAr: "عين قزام", aliases: ["Ain Guezzam", "Aïn Guezzam"], reformYear: 2019, defaultCoverageStatus: "confirm_by_phone", defaultHomeDelivery: true, defaultOfficeDelivery: true },
  { code: 55, name: "Touggourt", nameFr: "Touggourt", nameAr: "تقرت", reformYear: 2019, defaultCoverageStatus: "served", defaultHomeDelivery: true, defaultOfficeDelivery: true },
  { code: 56, name: "Djanet", nameFr: "Djanet", nameAr: "جانت", reformYear: 2019, defaultCoverageStatus: "confirm_by_phone", defaultHomeDelivery: true, defaultOfficeDelivery: true },
  { code: 57, name: "El M'Ghair", nameFr: "El M'Ghair", nameAr: "المغير", aliases: ["El Meghaier", "El Mghair"], reformYear: 2019, defaultCoverageStatus: "served", defaultHomeDelivery: true, defaultOfficeDelivery: true },
  { code: 58, name: "El Meniaa", nameFr: "El Meniaa", nameAr: "المنيعة", aliases: ["El Goléa", "El Golea"], reformYear: 2019, defaultCoverageStatus: "served", defaultHomeDelivery: true, defaultOfficeDelivery: true },
  // 2026 territorial reform (Law n° 26-06 of 4 April 2026 & Presidential Decree n° 26-206 of 25 May 2026) — codes 59–69
  {
    code: 59,
    name: "Aflou",
    nameFr: "Aflou",
    nameAr: "أفلو",
    reformYear: 2026,
    parentCode: 3,
    parentName: "Laghouat",
    defaultCoverageStatus: "via_parent_wilaya",
    defaultHomeDelivery: true,
    defaultOfficeDelivery: true,
  },
  {
    code: 60,
    name: "Barika",
    nameFr: "Barika",
    nameAr: "بريكة",
    reformYear: 2026,
    parentCode: 5,
    parentName: "Batna",
    defaultCoverageStatus: "via_parent_wilaya",
    defaultHomeDelivery: true,
    defaultOfficeDelivery: true,
  },
  {
    code: 61,
    name: "El Kantara",
    nameFr: "El Kantara",
    nameAr: "القنطرة",
    aliases: ["El-Qantara", "El Qantara"],
    reformYear: 2026,
    parentCode: 7,
    parentName: "Biskra",
    defaultCoverageStatus: "via_parent_wilaya",
    defaultHomeDelivery: true,
    defaultOfficeDelivery: true,
  },
  {
    code: 62,
    name: "Bir El Ater",
    nameFr: "Bir El Ater",
    nameAr: "بئر العاتر",
    aliases: ["Bir-El-Ater", "Bir El-Ater"],
    reformYear: 2026,
    parentCode: 12,
    parentName: "Tebessa",
    defaultCoverageStatus: "via_parent_wilaya",
    defaultHomeDelivery: true,
    defaultOfficeDelivery: true,
  },
  {
    code: 63,
    name: "El Aricha",
    nameFr: "El Aricha",
    nameAr: "العريشة",
    aliases: ["El-Aricha"],
    reformYear: 2026,
    parentCode: 13,
    parentName: "Tlemcen",
    defaultCoverageStatus: "via_parent_wilaya",
    defaultHomeDelivery: true,
    defaultOfficeDelivery: true,
  },
  {
    code: 64,
    name: "Ksar Chellala",
    nameFr: "Ksar Chellala",
    nameAr: "قصر الشلالة",
    aliases: ["Ksar Chelala", "Ksar-Chellala"],
    reformYear: 2026,
    parentCode: 14,
    parentName: "Tiaret",
    defaultCoverageStatus: "via_parent_wilaya",
    defaultHomeDelivery: true,
    defaultOfficeDelivery: true,
  },
  {
    code: 65,
    name: "Ain Ouessara",
    nameFr: "Aïn Ouessara",
    nameAr: "عين وسارة",
    aliases: ["Ain Oussara", "Aïn Oussara", "Ain Oussera", "Aïn Oussera"],
    reformYear: 2026,
    parentCode: 17,
    parentName: "Djelfa",
    defaultCoverageStatus: "via_parent_wilaya",
    defaultHomeDelivery: true,
    defaultOfficeDelivery: true,
  },
  {
    code: 66,
    name: "Messaad",
    nameFr: "Messaad",
    nameAr: "مسعد",
    aliases: ["Msaad", "M'saâd", "Messaâd"],
    reformYear: 2026,
    parentCode: 17,
    parentName: "Djelfa",
    defaultCoverageStatus: "via_parent_wilaya",
    defaultHomeDelivery: true,
    defaultOfficeDelivery: true,
  },
  {
    code: 67,
    name: "Ksar El Boukhari",
    nameFr: "Ksar El Boukhari",
    nameAr: "قصر البخاري",
    aliases: ["Ksar-El-Boukhari"],
    reformYear: 2026,
    parentCode: 26,
    parentName: "Medea",
    defaultCoverageStatus: "via_parent_wilaya",
    defaultHomeDelivery: true,
    defaultOfficeDelivery: true,
  },
  {
    code: 68,
    name: "Bou Saada",
    nameFr: "Bou Saâda",
    nameAr: "بوسعادة",
    aliases: ["Bousaada", "Boussaada", "Boussaâda", "Bou-Saada"],
    reformYear: 2026,
    parentCode: 28,
    parentName: "M'Sila",
    defaultCoverageStatus: "via_parent_wilaya",
    defaultHomeDelivery: true,
    defaultOfficeDelivery: true,
  },
  {
    code: 69,
    name: "El Abiodh Sidi Cheikh",
    nameFr: "El Abiodh Sidi Cheikh",
    nameAr: "الأبيض سيدي الشيخ",
    aliases: ["El Abiod Sidi Cheikh", "Labiodh Sidi Cheikh"],
    reformYear: 2026,
    parentCode: 32,
    parentName: "El Bayadh",
    defaultCoverageStatus: "via_parent_wilaya",
    defaultHomeDelivery: true,
    defaultOfficeDelivery: true,
  },
];

export const NEW_2026_WILAYAS: AlgerianWilaya[] = ALGERIAN_WILAYAS.filter(
  (w) => w.reformYear === 2026
);

const fold = (s: string): string =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’`-]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

/** Match a wilaya by numeric code (1–69 or "01"–"69"), canonical name, French/Arabic name, or alias. */
export function findCanonicalWilaya(input: string | number | undefined | null): AlgerianWilaya | undefined {
  if (input === undefined || input === null) return undefined;
  if (typeof input === "number") {
    return ALGERIAN_WILAYAS.find((w) => w.code === input);
  }
  const raw = String(input).trim();
  if (!raw) return undefined;
  const asCode = /^\d{1,2}$/.test(raw) ? parseInt(raw, 10) : NaN;
  if (!Number.isNaN(asCode)) {
    return ALGERIAN_WILAYAS.find((w) => w.code === asCode);
  }
  const folded = fold(raw);
  return ALGERIAN_WILAYAS.find(
    (w) =>
      fold(w.name) === folded ||
      fold(w.nameFr) === folded ||
      w.nameAr === raw ||
      (Array.isArray(w.aliases) && w.aliases.some((alias) => fold(alias) === folded))
  );
}

/** Resolve the parent wilaya for newly created wilayas (59–69) when courier routing/rates fall back to the parent. */
export function findParentWilaya(wilaya: AlgerianWilaya | undefined | null): AlgerianWilaya | undefined {
  if (!wilaya?.parentCode) return undefined;
  return ALGERIAN_WILAYAS.find((w) => w.code === wilaya.parentCode);
}
