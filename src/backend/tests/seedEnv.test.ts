import fs from "fs";
import os from "os";
import path from "path";
import {
  PLACEHOLDER_PASSWORD,
  preflightSeed,
  type PreflightViolation,
  type SeedPreflight,
  resolveSeedEnvFile,
  loadSeedEnv,
} from "../scripts/seedEnv";

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "dxn-seedenv-"));
}

function writeEnv(dir: string, file: string, body: string) {
  fs.writeFileSync(path.join(dir, file), body, "utf8");
}

/* ------------------------------------------------------------------ */
/*  resolveSeedEnvFile  — precedence                                    */
/* ------------------------------------------------------------------ */

describe("resolveSeedEnvFile", () => {
  it("prefers .env.production.local over .env", () => {
    const dir = tmpDir();
    writeEnv(dir, ".env", "MONGODB_URI=mongodb://localhost:27017/dxn_store\n");
    writeEnv(dir, ".env.production.local", "MONGODB_URI=mongodb+srv://x\n");
    expect(path.basename(resolveSeedEnvFile(dir)!)).toBe(".env.production.local");
  });

  it("falls back to .env when no production file exists", () => {
    const dir = tmpDir();
    writeEnv(dir, ".env", "MONGODB_URI=mongodb://localhost:27017/dxn_store\n");
    expect(path.basename(resolveSeedEnvFile(dir)!)).toBe(".env");
  });

  it("returns null when no env file exists", () => {
    const dir = tmpDir();
    expect(resolveSeedEnvFile(dir)).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/*  loadSeedEnv  — apply rules                                         */
/* ------------------------------------------------------------------ */

describe("loadSeedEnv", () => {
  const KEY = "DXN_TEST_LOADED_ENV";

  beforeEach(() => {
    delete process.env[KEY];
    delete process.env.MONGODB_URI;
  });
  afterEach(() => {
    delete process.env[KEY];
    delete process.env.MONGODB_URI;
  });

  it("fills values from the resolved file", () => {
    const dir = tmpDir();
    writeEnv(dir, ".env.production.local", `MONGODB_URI=mongodb+srv://cluster\n${KEY}=yes\n`);
    const res = loadSeedEnv(dir);
    expect(res.file).not.toBeNull();
    expect(process.env[KEY]).toBe("yes");
  });

  it("never overrides a value already present in process.env", () => {
    const dir = tmpDir();
    writeEnv(dir, ".env.production.local", "MONGODB_URI=mongodb+srv://cluster\n");
    process.env.MONGODB_URI = "mongodb+srv://shell-supplied";
    const res = loadSeedEnv(dir);
    expect(res.overridden).toContain("MONGODB_URI");
    expect(process.env.MONGODB_URI).toBe("mongodb+srv://shell-supplied");
  });
});

/* ------------------------------------------------------------------ */
/*  preflightSeed  — non-sensitive validation                          */
/* ------------------------------------------------------------------ */

function violations(u: Partial<SeedPreflight>): PreflightViolation[] {
  return preflightSeed({
    uri: undefined,
    email: undefined,
    password: undefined,
    requireAdmin: true,
    forbidLocalhost: true,
    ...u,
  });
}

describe("preflightSeed", () => {
  it("accepts a valid Atlas admin provisioning request", () => {
    const v = violations({
      uri: "mongodb+srv://user:pass@cluster0.abc.mongodb.net/dxn_store",
      email: "owner@dxn.dz",
      password: "Str0ng-P@ssw0rd!",
    });
    expect(v).toEqual([]);
  });

  it("rejects a missing URI", () => {
    expect(violations({})).toContain("missing-uri");
  });

  it("rejects a non-mongodb scheme", () => {
    const v = violations({
      uri: "postgres://host/db",
      email: "a@b.c",
      password: "x",
    });
    expect(v).toContain("bad-scheme");
  });

  it("rejects localhost when forbidLocalhost is set", () => {
    const v = violations({
      uri: "mongodb://localhost:27017/dxn_store",
      email: "a@b.c",
      password: "x",
    });
    expect(v).toContain("localhost");
  });

  it("allows localhost when forbidLocalhost is false (dev)", () => {
    const v = violations({
      uri: "mongodb://localhost:27017/dxn_store",
      email: "a@b.c",
      password: "x",
      forbidLocalhost: false,
    });
    expect(v).not.toContain("localhost");
  });

  it("rejects the redaction marker as URI", () => {
    const v = violations({
      uri: "[SENSITIVE]",
      email: "a@b.c",
      password: "x",
    });
    expect(v).toContain("redacted-uri");
  });

  it("rejects a missing admin email/password", () => {
    const v = violations({ uri: "mongodb+srv://cluster" });
    expect(v).toContain("missing-email");
    expect(v).toContain("missing-password");
  });

  it("rejects the known placeholder password", () => {
    const v = violations({
      uri: "mongodb+srv://cluster",
      email: "a@b.c",
      password: PLACEHOLDER_PASSWORD,
    });
    expect(v).toContain("placeholder-password");
  });

  it("rejects the redaction marker as password", () => {
    const v = violations({
      uri: "mongodb+srv://cluster",
      email: "a@b.c",
      password: "[SENSITIVE]",
    });
    expect(v).toContain("redacted-password");
  });

  it("does not require admin credentials when requireAdmin=false", () => {
    const v = violations({
      uri: "mongodb+srv://cluster",
      requireAdmin: false,
    });
    expect(v).not.toContain("missing-email");
    expect(v).not.toContain("missing-password");
  });
});