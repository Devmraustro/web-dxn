/**
 * DXN Natural Life — Secure RFC-4180 CSV Serializer for Admin CRM Exports.
 *
 * SECURITY & COMPATIBILITY:
 * 1. Prepends UTF-8 BOM (\uFEFF) so Microsoft Excel & LibreOffice render Arabic
 *    script accurately without mojibake.
 * 2. Neutralizes Spreadsheet Formula Injection (CSV Injection / CWE-1236) for
 *    any cell whose trimmed value begins with `=`, `+`, `-`, `@`, `\t`, or
 *    `\r`:
 *    - Unambiguous formula triggers (`=`, `+`, `@`) get a `'` prefix AND are
 *      wrapped in double quotes so spreadsheet apps treat them as literal text.
 *    - `-`, tab and CR only get the `'` prefix (quotes would break numeric
 *      parsing of values like `-10+20`).
 */

const FORMULA_TRIGGERS = /^[=+\-@\t\r]/;
const STRICT_FORMULA_TRIGGERS = /^[=+@]/;

export function escapeCsvCell(raw: unknown): string {
  if (raw === null || raw === undefined) return "";
  const str = String(raw);
  const trimmed = str.trimStart();
  // Neutralize formula execution if opened in Excel/Sheets
  if (FORMULA_TRIGGERS.test(trimmed)) {
    const prefixed = `'${str}`;
    if (STRICT_FORMULA_TRIGGERS.test(trimmed)) {
      return `"${prefixed.replace(/"/g, '""')}"`;
    }
    return prefixed;
  }
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function serializeLeadsToCsv(leads: any[]): string {
  const headers = [
    "Lead Reference",
    "Status",
    "First Name",
    "Last Name",
    "Country",
    "Phone",
    "Preferred Contact",
    "Email",
    "Existing DXN Member ID",
    "Sponsor Member ID",
    "Official Registered DXN ID",
    "Traffic Source",
    "Follow-Up Date",
    "Notes Count",
    "Created At",
    "Message",
  ];

  const rows: string[] = [headers.map(escapeCsvCell).join(",")];

  for (const lead of leads || []) {
    const row = [
      lead.leadReference || "",
      lead.status || "new",
      lead.firstName || "",
      lead.lastName || "",
      lead.country || "",
      lead.phone || "",
      lead.preferredContactMethod || "",
      lead.email || "",
      lead.existingMembershipNumber || "",
      lead.sponsorMembershipNumber || "",
      lead.officialMembershipNumber || "",
      lead.trafficSource?.source || "direct",
      lead.followUpDate ? new Date(lead.followUpDate).toISOString().slice(0, 10) : "",
      Array.isArray(lead.notes) ? lead.notes.length : 0,
      lead.createdAt ? new Date(lead.createdAt).toISOString() : "",
      lead.message || "",
    ];
    rows.push(row.map(escapeCsvCell).join(","));
  }

  return "\uFEFF" + rows.join("\r\n") + "\r\n";
}
