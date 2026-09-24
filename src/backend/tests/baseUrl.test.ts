import { normalizeBaseUrl } from "../config/baseUrl";

describe("normalizeBaseUrl — production base-origin normalization", () => {
  test("returns fallback when value is missing or empty", () => {
    expect(normalizeBaseUrl(undefined, "https://dxn.dz")).toBe("https://dxn.dz");
    expect(normalizeBaseUrl("", "http://localhost:5000")).toBe("http://localhost:5000");
  });

  test("strips a pasted 'BASE_URL=' assignment prefix (Vercel env UI mistake)", () => {
    expect(normalizeBaseUrl("BASE_URL=https://dxnnadz.vercel.app", "https://dxn.dz")).toBe(
      "https://dxnnadz.vercel.app"
    );
    expect(normalizeBaseUrl("BASE_URL = https://dxnnadz.vercel.app/", "https://dxn.dz")).toBe(
      "https://dxnnadz.vercel.app"
    );
  });

  test("strips trailing slashes from a clean value", () => {
    expect(normalizeBaseUrl("https://dxnnadz.vercel.app///", "https://dxn.dz")).toBe(
      "https://dxnnadz.vercel.app"
    );
  });

  test("leaves an already-clean value untouched", () => {
    expect(normalizeBaseUrl("https://dxnnadz.vercel.app", "https://dxn.dz")).toBe(
      "https://dxnnadz.vercel.app"
    );
  });

  test("falls back when the value is only the prefix", () => {
    expect(normalizeBaseUrl("BASE_URL=", "https://dxn.dz")).toBe("https://dxn.dz");
  });
});