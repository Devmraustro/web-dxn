/**
 * Phase 25 — form-data availability for the Cloudinary storage provider.
 *
 * The forensic report found that storage.ts required("form-data") inside its
 * Cloudinary request path while the package was only present as a transitive
 * dependency of axios. These tests guard the now-direct declaration:
 *  - "form-data" resolves and exports a usable FormData constructor;
 *  - the Cloudinary provider is selected (no fail-closed throw) when
 *    STORAGE_PROVIDER=cloudinary with credentials present;
 *  - production still fail-closes when no storage provider is configured.
 */

describe("form-data availability for the Cloudinary storage provider", () => {
  beforeEach(() => {
    delete process.env.STORAGE_PROVIDER;
    delete process.env.CLOUDINARY_CLOUD_NAME;
    delete process.env.CLOUDINARY_API_KEY;
    delete process.env.CLOUDINARY_API_SECRET;
    delete process.env.ALLOW_LOCAL_STORAGE_IN_PRODUCTION;
    delete process.env.NODE_ENV;
  });

  test("form-data is a declared, resolvable dependency exposing a FormData constructor", () => {
    expect(() => require.resolve("form-data")).not.toThrow();
    const FormData = require("form-data");
    expect(typeof FormData).toBe("function");
  });

  test("CloudinaryStorageProvider is selected (no fail-closed throw) when STORAGE_PROVIDER=cloudinary and credentials exist", () => {
    process.env.NODE_ENV = "production";
    process.env.STORAGE_PROVIDER = "cloudinary";
    process.env.CLOUDINARY_CLOUD_NAME = "test-cloud";
    process.env.CLOUDINARY_API_KEY = "test-key";
    process.env.CLOUDINARY_API_SECRET = "test-secret";

    let storageModule: any;
    jest.isolateModules(() => {
      storageModule = require("../config/storage");
    });
    const provider = storageModule.getStorageProvider();
    expect(provider).toBeTruthy();
    expect(typeof provider.upload).toBe("function");
    expect(typeof provider.delete).toBe("function");
    expect(provider.constructor.name).toBe("CloudinaryStorageProvider");
  });

  test("production still fail-closes when the storage provider is not configured", () => {
    process.env.NODE_ENV = "production";
    process.env.STORAGE_PROVIDER = "local";

    let storageModule: any;
    jest.isolateModules(() => {
      storageModule = require("../config/storage");
    });
    expect(() => storageModule.getStorageProvider()).toThrow(
      /Local filesystem storage is not available in production/
    );
  });
});