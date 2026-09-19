/**
 * Test setup file
 * Configures the test environment before running tests.
 *
 * MongoDB is OPTIONAL: if no local/CI database is reachable, DB-backed tests
 * will fail on missing data (documented as CONFIGURATION REQUIRED) while pure
 * unit tests (e.g. the AI safety-guard suite) still pass. Previously this file
 * hard-exited the whole jest run when Mongo was down, which blocked every
 * suite regardless of whether it needed a database.
 */
import mongoose from "mongoose";

// Raise the hook/test timeout at module scope so the DB-optional beforeAll
// below is NOT killed by the 5s default hook timeout while mongoose waits up
// to its own (10s) serverSelectionTimeoutMS when MongoDB is down. This lets
// DB-less (pure unit) suites still pass when no database is reachable, which is
// the documented intent of this setup file.
jest.setTimeout(30000);

// Set test-specific Meta config for Messenger tests
process.env.META_VERIFY_TOKEN = process.env.META_VERIFY_TOKEN || "test_verify_token";
process.env.META_APP_SECRET = process.env.META_APP_SECRET || "test_app_secret";
process.env.META_PAGE_ACCESS_TOKEN = process.env.META_PAGE_ACCESS_TOKEN || "test_page_token";
process.env.META_PAGE_ID = process.env.META_PAGE_ID || "test_page_id_123456789";
process.env.META_GRAPH_VERSION = process.env.META_GRAPH_VERSION || "v26.0";

const MONGO_URI =
  process.env.MONGODB_URI_TEST || "mongodb://localhost:27017/dxn_store_test";

const isConnected = (): boolean => mongoose.connection.readyState === 1;

beforeAll(async () => {
  try {
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
    });
    console.log("Test database connected");
  } catch (error) {
    console.warn(
      "[setup] MongoDB not available at " +
        MONGO_URI +
        " - DB-backed tests require a running database (CONFIGURATION REQUIRED). Reason: " +
        (error instanceof Error ? error.message : String(error))
    );
  }
});

afterAll(async () => {
  if (isConnected()) {
    await mongoose.connection.close();
  }
});
