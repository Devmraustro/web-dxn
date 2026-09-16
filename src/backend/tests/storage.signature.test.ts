/**
 * Cloudinary signature verification.
 *
 * Cloudinary signs requests with SHA-1, NOT the HMAC-SHA256 that storage.ts
 * used to produce. The signature input is the sorted key=value&key=value
 * string of all request parameters (excluding `file`, `cloud_name`,
 * `signature`, `api_key`, and any null/undefined/empty value) with the API
 * secret appended directly, then SHA-1 hashed to a lowercase hex string.
 *
 * These tests pin that algorithm and prove both `upload()` and `delete()`
 * transmit the resulting signature through the existing manual
 * form-data + https.request path. Only dummy credentials are used and the
 * `https` module is mocked — no real network requests are made.
 */

import crypto from "crypto";
import { EventEmitter } from "events";
import { PassThrough } from "stream";
import { createCloudinarySignature } from "../config/storage";

const DUMMY_SECRET = "test-secret";

const sha1 = (input: string): string =>
  crypto.createHash("sha1").update(input).digest("hex");

const https = require("https") as { request: jest.Mock };

jest.mock("https", () => ({
  request: jest.fn(),
}));

function emptyCloudinaryEnv(): void {
  delete process.env.STORAGE_PROVIDER;
  delete process.env.CLOUDINARY_CLOUD_NAME;
  delete process.env.CLOUDINARY_API_KEY;
  delete process.env.CLOUDINARY_API_SECRET;
  delete process.env.ALLOW_LOCAL_STORAGE_IN_PRODUCTION;
  delete process.env.NODE_ENV;
}

beforeEach(() => {
  emptyCloudinaryEnv();
  https.request.mockReset();
});

interface HttpsMock {
  chunks: Buffer[];
  req: PassThrough;
  piped: Promise<void>;
  requestOptions: Array<{ hostname: string; path: string; method: string }>;
  flush: (json: unknown) => void;
}

function mockHttpsRequest(): HttpsMock {
  const req = new PassThrough();
  const chunks: Buffer[] = [];
  req.on("data", (chunk: unknown) => {
    chunks.push(
      Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk ? String(chunk) : "")
    );
  });
  let resolvePiped: () => void = () => undefined;
  const piped = new Promise<void>((resolve) => {
    resolvePiped = resolve;
  });
  req.on("end", resolvePiped);

  const requestOptions: HttpsMock["requestOptions"] = [];
  let responseCallback: ((res: EventEmitter) => void) | undefined;
  https.request.mockImplementation((opts: unknown, cb: (res: EventEmitter) => void) => {
    requestOptions.push(opts as HttpsMock["requestOptions"][number]);
    responseCallback = cb;
    return req;
  });

  return {
    chunks,
    req,
    piped,
    requestOptions,
    flush: (json: unknown) => {
      if (!responseCallback) throw new Error("https.request was never invoked");
      const res = new EventEmitter() as EventEmitter & { statusCode: number };
      res.statusCode = 200;
      responseCallback(res);
      res.emit("data", JSON.stringify(json));
      res.emit("end");
    },
  };
}

async function waitForRequestComplete(mock: HttpsMock, timeoutMs = 5000): Promise<void> {
  await Promise.race([
    mock.piped,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("timed out waiting for the request body to be piped")), timeoutMs)
    ),
  ]);
}

function extractFormField(body: string, fieldName: string): string | undefined {
  const marker = `name="${fieldName}"`;
  const markerIndex = body.indexOf(marker);
  if (markerIndex === -1) return undefined;
  const afterMarker = body.slice(markerIndex + marker.length);
  const bodyStartIndex = afterMarker.indexOf("\r\n\r\n");
  if (bodyStartIndex === -1) return undefined;
  const value = afterMarker.slice(bodyStartIndex + 4);
  const valueEnd = value.indexOf("\r\n");
  return valueEnd === -1 ? value : value.slice(0, valueEnd);
}

describe("createCloudinarySignature", () => {
  test("signs a timestamp-only parameter set", () => {
    const signature = createCloudinarySignature({ timestamp: "1000" }, DUMMY_SECRET);
    expect(signature).toBe(sha1("timestamp=1000test-secret"));
  });

  test("joins multiple parameters with '&' in alphabetical key order", () => {
    const signature = createCloudinarySignature(
      { folder: "a", public_id: "b", timestamp: "1000" },
      DUMMY_SECRET
    );
    expect(signature).toBe(sha1("folder=a&public_id=b&timestamp=1000test-secret"));
  });

  test("excludes file, cloud_name, signature, and api_key from the signed string", () => {
    const signature = createCloudinarySignature(
      {
        file: "photo.png",
        cloud_name: "test-cloud",
        signature: "pretend-signature",
        api_key: "test-key",
        timestamp: "1000",
      },
      DUMMY_SECRET
    );
    expect(signature).toBe(sha1("timestamp=1000test-secret"));
  });

  test("excludes null, undefined, and empty string values", () => {
    const signature = createCloudinarySignature(
      {
        timestamp: "1000",
        folder: "",
        public_id: undefined,
        tags: null,
      },
      DUMMY_SECRET
    );
    expect(signature).toBe(sha1("timestamp=1000test-secret"));
  });

  test("always sorts parameters alphabetically regardless of insertion order", () => {
    const scrambled = createCloudinarySignature(
      { timestamp: "1000", public_id: "b", folder: "a" },
      DUMMY_SECRET
    );
    expect(scrambled).toBe(sha1("folder=a&public_id=b&timestamp=1000test-secret"));
  });

  test("output is lowercase hexadecimal", () => {
    const signature = createCloudinarySignature({ timestamp: "1000" }, DUMMY_SECRET);
    expect(signature).toMatch(/^[0-9a-f]{40}$/);
  });
});

describe("CloudinaryStorageProvider upload and delete signatures", () => {
  const DUMMY_FILE: any = {
    fieldname: "image",
    originalname: "photo.png",
    encoding: "7bit",
    mimetype: "image/png",
    size: 4,
    buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
  };

  test("upload() sends the correct SHA1 signature via mocked https.request", async () => {
    process.env.STORAGE_PROVIDER = "cloudinary";
    process.env.CLOUDINARY_CLOUD_NAME = "test-cloud";
    process.env.CLOUDINARY_API_KEY = "test-key";
    process.env.CLOUDINARY_API_SECRET = DUMMY_SECRET;

    const storage = require("../config/storage");
    const provider = new storage.CloudinaryStorageProvider();
    const mock = mockHttpsRequest();

    const uploadPromise = provider.upload(DUMMY_FILE) as Promise<string>;
    await waitForRequestComplete(mock);

    const body = Buffer.concat(mock.chunks).toString("utf8");
    const sentSignature = extractFormField(body, "signature");
    const sentTimestamp = extractFormField(body, "timestamp");

    expect(mock.requestOptions).toHaveLength(1);
    expect(mock.requestOptions[0].hostname).toBe("api.cloudinary.com");
    expect(mock.requestOptions[0].path).toBe("/v1_1/test-cloud/image/upload");
    expect(mock.requestOptions[0].method).toBe("POST");
    expect(extractFormField(body, "api_key")).toBe("test-key");
    expect(sentTimestamp).toBeDefined();
    expect(sentSignature).toBe(
      createCloudinarySignature({ timestamp: sentTimestamp as string }, DUMMY_SECRET)
    );

    mock.flush({
      secure_url: "https://res.cloudinary.com/test-cloud/image/upload/v1/photo.jpg",
    });
    await expect(uploadPromise).resolves.toBe(
      "https://res.cloudinary.com/test-cloud/image/upload/v1/photo.jpg"
    );
  });

  test("delete() sends the correct SHA1 signature via mocked https.request", async () => {
    process.env.STORAGE_PROVIDER = "cloudinary";
    process.env.CLOUDINARY_CLOUD_NAME = "test-cloud";
    process.env.CLOUDINARY_API_KEY = "test-key";
    process.env.CLOUDINARY_API_SECRET = DUMMY_SECRET;

    const storage = require("../config/storage");
    const provider = new storage.CloudinaryStorageProvider();
    const mock = mockHttpsRequest();

    const deletePromise = provider.delete(
      "https://res.cloudinary.com/test-cloud/image/upload/v1610000000/sample.jpg"
    ) as Promise<void>;
    await waitForRequestComplete(mock);

    const body = Buffer.concat(mock.chunks).toString("utf8");
    const sentSignature = extractFormField(body, "signature");
    const sentTimestamp = extractFormField(body, "timestamp");
    const sentPublicId = extractFormField(body, "public_id");

    expect(mock.requestOptions).toHaveLength(1);
    expect(mock.requestOptions[0].hostname).toBe("api.cloudinary.com");
    expect(mock.requestOptions[0].path).toBe("/v1_1/test-cloud/image/destroy");
    expect(mock.requestOptions[0].method).toBe("POST");
    expect(sentPublicId).toBe("sample");
    expect(sentTimestamp).toBeDefined();
    expect(sentSignature).toBe(
      createCloudinarySignature(
        { public_id: "sample", timestamp: sentTimestamp as string },
        DUMMY_SECRET
      )
    );

    mock.flush({ result: "ok" });
    await expect(deletePromise).resolves.toBeUndefined();
  });
});