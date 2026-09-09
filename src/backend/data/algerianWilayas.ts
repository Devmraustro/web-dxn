/**
 * Canonical Algerian wilaya dataset — the single source of truth for the
 * 58 official wilayas (codes 01–58, including the ten created in 2019).
 *
 * Consumers:
 *  - `shipping.controller.ts` seeds/upgrades the Wilaya collection from here
 *    (fresh DB → insert all rows; legacy code-less DB → reconcile in place).
 *  - `shipping.service.ts` / `resolveShippingFee` matches wilaya input by
 *    name/nameFr/nameAr (case-insensitive, accent-tolerant via normalization).
 *  - `seo/utils.ts` exports the canonical `name` list for future page sets
 *    (regression-tested: must contain "Algiers" / "Tamanrasset").
 *  - `CheckoutPage.tsx` builds the wilaya dropdown (value = canonical `name`,
 *    label = `nameAr` in Arabic, otherwise `nameFr`).
 *
 * `name` is the canonical English romanization, `nameFr` the official French
 * spelling and `nameAr` the Arabic name. `name` is what the checkout submits
 * and the DB stores, so rate setup and fee resolution always agree.
 */
export interface AlgerianWilaya {
  code: number;
  name: string;
  nameFr: string;
  nameAr: string;
}

export const ALGERIAN_WILAYAS: AlgerianWilaya[] = [
  { code: 1, name: "Adrar", nameFr: "Adrar", nameAr: "أدرار" },
  { code: 2, name: "Chlef", nameFr: "Chlef", nameAr: "الشلف" },
  { code: 3, name: "Laghouat", nameFr: "Laghouat", nameAr: "الأغواط" },
  { code: 4, name: "Oum El Bouaghi", nameFr: "Oum El Bouaghi", nameAr: "أم البواقي" },
  { code: 5, name: "Batna", nameFr: "Batna", nameAr: "باتنة" },
  { code: 6, name: "Bejaia", nameFr: "Béjaïa", nameAr: "بجاية" },
  { code: 7, name: "Biskra", nameFr: "Biskra", nameAr: "بسكرة" },
  { code: 8, name: "Bechar", nameFr: "Béchar", nameAr: "بشار" },
  { code: 9, name: "Blida", nameFr: "Blida", nameAr: "البليدة" },
  { code: 10, name: "Bouira", nameFr: "Bouira", nameAr: "البويرة" },
  { code: 11, name: "Tamanrasset", nameFr: "Tamanrasset", nameAr: "تمنراست" },
  { code: 12, name: "Tebessa", nameFr: "Tébessa", nameAr: "تبسة" },
  { code: 13, name: "Tlemcen", nameFr: "Tlemcen", nameAr: "تلمسان" },
  { code: 14, name: "Tiaret", nameFr: "Tiaret", nameAr: "تيارت" },
  { code: 15, name: "Tizi Ouzou", nameFr: "Tizi Ouzou", nameAr: "تيزي وزو" },
  { code: 16, name: "Algiers", nameFr: "Alger", nameAr: "الجزائر" },
  { code: 17, name: "Djelfa", nameFr: "Djelfa", nameAr: "الجلفة" },
  { code: 18, name: "Jijel", nameFr: "Jijel", nameAr: "جيجل" },
  { code: 19, name: "Setif", nameFr: "Sétif", nameAr: "سطيف" },
  { code: 20, name: "Saida", nameFr: "Saïda", nameAr: "سعيدة" },
  { code: 21, name: "Skikda", nameFr: "Skikda", nameAr: "سكيكدة" },
  { code: 22, name: "Sidi Bel Abbes", nameFr: "Sidi Bel Abbès", nameAr: "سيدي بلعباس" },
  { code: 23, name: "Annaba", nameFr: "Annaba", nameAr: "عنابة" },
  { code: 24, name: "Guelma", nameFr: "Guelma", nameAr: "قالمة" },
  { code: 25, name: "Constantine", nameFr: "Constantine", nameAr: "قسنطينة" },
  { code: 26, name: "Medea", nameFr: "Médéa", nameAr: "المدية" },
  { code: 27, name: "Mostaganem", nameFr: "Mostaganem", nameAr: "مستغانم" },
  { code: 28, name: "M'Sila", nameFr: "M'Sila", nameAr: "المسيلة" },
  { code: 29, name: "Mascara", nameFr: "Mascara", nameAr: "معسكر" },
  { code: 30, name: "Ouargla", nameFr: "Ouargla", nameAr: "ورقلة" },
  { code: 31, name: "Oran", nameFr: "Oran", nameAr: "وهران" },
  { code: 32, name: "El Bayadh", nameFr: "El Bayadh", nameAr: "البيض" },
  { code: 33, name: "Illizi", nameFr: "Illizi", nameAr: "إليزي" },
  { code: 34, name: "Bordj Bou Arreridj", nameFr: "Bordj Bou Arreridj", nameAr: "برج بوعريريج" },
  { code: 35, name: "Boumerdes", nameFr: "Boumerdès", nameAr: "بومرداس" },
  { code: 36, name: "El Tarf", nameFr: "El Tarf", nameAr: "الطارف" },
  { code: 37, name: "Tindouf", nameFr: "Tindouf", nameAr: "تندوف" },
  { code: 38, name: "Tissemsilt", nameFr: "Tissemsilt", nameAr: "تيسمسيلت" },
  { code: 39, name: "El Oued", nameFr: "El Oued", nameAr: "الوادي" },
  { code: 40, name: "Khenchela", nameFr: "Khenchela", nameAr: "خنشلة" },
  { code: 41, name: "Souk Ahras", nameFr: "Souk Ahras", nameAr: "سوق أهراس" },
  { code: 42, name: "Tipaza", nameFr: "Tipaza", nameAr: "تيبازة" },
  { code: 43, name: "Mila", nameFr: "Mila", nameAr: "ميلة" },
  { code: 44, name: "Ain Defla", nameFr: "Aïn Defla", nameAr: "عين الدفلى" },
  { code: 45, name: "Naama", nameFr: "Naâma", nameAr: "النعامة" },
  { code: 46, name: "Ain Temouchent", nameFr: "Aïn Témouchent", nameAr: "عين تموشنت" },
  { code: 47, name: "Ghardaia", nameFr: "Ghardaïa", nameAr: "غرداية" },
  { code: 48, name: "Relizane", nameFr: "Relizane", nameAr: "غليزان" },
  { code: 49, name: "Timimoun", nameFr: "Timimoun", nameAr: "تيميمون" },
  { code: 50, name: "Bordj Badji Mokhtar", nameFr: "Bordj Badji Mokhtar", nameAr: "برج باجي مختار" },
  { code: 51, name: "Ouled Djellal", nameFr: "Ouled Djellal", nameAr: "أولاد جلال" },
  { code: 52, name: "Beni Abbes", nameFr: "Béni Abbès", nameAr: "بني عباس" },
  { code: 53, name: "In Salah", nameFr: "In Salah", nameAr: "عين صالح" },
  { code: 54, name: "In Guezzam", nameFr: "In Guezzam", nameAr: "عين قزام" },
  { code: 55, name: "Touggourt", nameFr: "Touggourt", nameAr: "تقرت" },
  { code: 56, name: "Djanet", nameFr: "Djanet", nameAr: "جانت" },
  { code: 57, name: "El M'Ghair", nameFr: "El M'Ghair", nameAr: "المغير" },
  { code: 58, name: "El Meniaa", nameFr: "El Meniaa", nameAr: "المنيعة" },
];

export default ALGERIAN_WILAYAS;
