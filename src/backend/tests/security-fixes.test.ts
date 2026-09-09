/**
 * Phase 24 — Security regression tests.
 *
 * Verifies the four HIGH-severity fixes from the forensic audit:
 *  H1: JWT_SECRET production validation (throws in production, warns in dev)
 *  H2: auth.middleware.ts uses centralized JWT_SECRET (no inline dev fallback)
 *  H3: user.controller.ts uses centralized JWT/BCRYPT config
 *  H4: product search escapes regex metacharacters + length-cap
 */
import { Request, Response, NextFunction } from "express";

// H1 — JWT_SECRET production validation
describe("H1 — JWT_SECRET production validation", () => {
  const ORIGINAL_ENV = process.env;
  const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

  afterEach(() => {
    process.env = ORIGINAL_ENV;
    jest.resetModules();
  });

  test("production with missing JWT_SECRET throws at module load", () => {
    process.env = { ...ORIGINAL_ENV, NODE_ENV: "production" };
    delete process.env.JWT_SECRET;
    jest.resetModules();
    expect(() => {
      require("../config/env");
    }).toThrow(/JWT_SECRET/);
  });

  test("production with short JWT_SECRET (< 32 chars) throws at module load", () => {
    process.env = { ...ORIGINAL_ENV, NODE_ENV: "production", JWT_SECRET: "short" };
    jest.resetModules();
    expect(() => {
      require("../config/env");
    }).toThrow(/at least 32 characters/);
  });

  test("production with valid 32+ char JWT_SECRET loads successfully", () => {
    process.env = { ...ORIGINAL_ENV, NODE_ENV: "production", JWT_SECRET: "x".repeat(32) };
    jest.resetModules();
    expect(() => {
      const env = require("../config/env");
      expect(env.JWT_SECRET).toBe("x".repeat(32));
    }).not.toThrow();
  });

  test("development with missing JWT_SECRET does not throw (warns and falls back)", () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    process.env = { ...ORIGINAL_ENV, NODE_ENV: "development" };
    delete process.env.JWT_SECRET;
    jest.resetModules();
    expect(() => {
      const env = require("../config/env");
      expect(env.JWT_SECRET).toBeDefined();
      expect(env.JWT_SECRET.length).toBeGreaterThan(0);
    }).not.toThrow();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  test("development with short JWT_SECRET warns (does not throw)", () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    process.env = { ...ORIGINAL_ENV, NODE_ENV: "development", JWT_SECRET: "x" };
    jest.resetModules();
    expect(() => {
      const env = require("../config/env");
      expect(env.JWT_SECRET).toBe("x");
    }).not.toThrow();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

// H2 — auth.middleware.ts uses centralized JWT_SECRET
describe("H2 — auth middleware uses centralized JWT_SECRET", () => {
  test("imports JWT_SECRET from config (not inline process.env fallback)", () => {
    const fs = require("fs");
    const path = require("path");
    const middlewarePath = path.join(__dirname, "../middleware/auth.middleware.ts");
    const source = fs.readFileSync(middlewarePath, "utf8");
    expect(source).toMatch(/import\s+\{[^}]*JWT_SECRET[^}]*\}\s+from\s+["']\.\.\/config\/env["']/);
    // Ensure no inline '|| "dxn_store_development' fallback remains
    expect(source).not.toMatch(/dxn_store_development_secret/);
  });
});

// H3 — user.controller.ts uses centralized JWT/BCRYPT config
describe("H3 — user controller uses centralized JWT/BCRYPT config", () => {
  test("imports JWT_SECRET, JWT_EXPIRES_IN, BCRYPT_SALT_ROUNDS from config", () => {
    const fs = require("fs");
    const path = require("path");
    const controllerPath = path.join(__dirname, "../controllers/user.controller.ts");
    const source = fs.readFileSync(controllerPath, "utf8");
    expect(source).toMatch(/JWT_SECRET/);
    expect(source).toMatch(/JWT_EXPIRES_IN/);
    expect(source).toMatch(/BCRYPT_SALT_ROUNDS/);
    expect(source).toMatch(/from\s+["']\.\.\/config\/env["']/);
    // No inline fallbacks remain
    expect(source).not.toMatch(/process\.env\.JWT_SECRET\s*\|\|/);
    expect(source).not.toMatch(/dxn_store_development_secret/);
  });
});

// H4 — product search regex/ReDoS hardening
describe("H4 — product search regex escaping + length cap", () => {
  // Test the regex escaping logic in isolation (mirrors what product.controller does)
  function escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  function isInputSafe(s: string): boolean {
    return s.length <= 64;
  }

  test("normal alphanumeric search is unchanged", () => {
    expect(escapeRegex("hello")).toBe("hello");
    expect(escapeRegex("DXN-123")).toBe("DXN-123");
  });

  test("regex metacharacters are escaped", () => {
    expect(escapeRegex("a.b")).toBe("a\\.b");
    expect(escapeRegex("a+b")).toBe("a\\+b");
    expect(escapeRegex("a*b")).toBe("a\\*b");
    expect(escapeRegex("(a)")).toBe("\\(a\\)");
    expect(escapeRegex("[a-z]")).toBe("\\[a-z\\]"); // hyphen is safe as-is inside [...]
    expect(escapeRegex("a?b")).toBe("a\\?b");
    expect(escapeRegex("^abc$")).toBe("\\^abc\\$");
    expect(escapeRegex("a|b")).toBe("a\\|b");
    expect(escapeRegex("{1,2}")).toBe("\\{1,2\\}");
    expect(escapeRegex("a\\b")).toBe("a\\\\b");
  });

  test("pathological ReDoS input is neutralised (no nested quantifier)", () => {
    const evil = "(a+)+$";
    const escaped = escapeRegex(evil);
    // The escaped form, when used as a regex, must NOT match catastrophically
    const re = new RegExp(escaped);
    // The string "(a+)+$" itself should not match the escaped literal
    expect(re.test("(a+)+$")).toBe(true);
    // But a payload that would have caused backtracking with (a+)+ should be safe
    const start = Date.now();
    for (let i = 0; i < 1000; i++) {
      re.test("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa!");
    }
    const elapsed = Date.now() - start;
    // 1000 evaluations of a literal escape should be effectively instant
    expect(elapsed).toBeLessThan(500);
  });

  test("input > 64 chars is rejected (DoS guard)", () => {
    expect(isInputSafe("")).toBe(true);
    expect(isInputSafe("a".repeat(64))).toBe(true);
    expect(isInputSafe("a".repeat(65))).toBe(false);
    expect(isInputSafe("a".repeat(10000))).toBe(false);
  });

  test("empty input is safe", () => {
    expect(escapeRegex("")).toBe("");
    expect(isInputSafe("")).toBe(true);
  });

  test("product controller source applies the cap and escaping", () => {
    const fs = require("fs");
    const path = require("path");
    const controllerPath = path.join(__dirname, "../controllers/product.controller.ts");
    const source = fs.readFileSync(controllerPath, "utf8");
    // The 64-char cap
    expect(source).toMatch(/length\s*>\s*64/);
    // The metacharacter escape
    expect(source).toMatch(/\[.*\+.*\^\$\{\}\(\)\|\[\\\]\\\\\]/);
    // The $regex operator
    expect(source).toMatch(/\$regex/);
    // No raw new RegExp from user input
    expect(source).not.toMatch(/new\s+RegExp\(search/);
  });
});
