import mongoose from "mongoose";
import { initializeAIMiddleware } from "./controllers/ai/ai.controller";
import { initializeDefaultWilayas } from "./controllers/shipping.controller";

/**
 * Mongo connection manager.
 *
 * `ensureDB()` caches a single connection promise per process so serverless
 * invocations (Vercel) reuse the connection instead of opening a new one per
 * request. `connectDB()` is the raw entry point used by local startup.
 */

let connectionPromise: Promise<typeof mongoose> | null = null;

export const connectDB = async () => {
  // Fail fast only when a connection is genuinely attempted. This keeps
  // import-time side-effect free (static/health endpoints boot without the
  // env var) while guaranteeing production never silently tries localhost.
  const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/dxn_store";
  if (!process.env.MONGODB_URI && process.env.NODE_ENV === "production") {
    throw new Error(
      "FATAL: MONGODB_URI environment variable is required in production (set it before connecting)."
    );
  }
  const conn = await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
  });
  console.log(`MongoDB Connected: ${conn.connection.host}`);

  // Seed canonical store data when collections are empty (never overwrites).
  await initializeDefaultWilayas();
  await initializeAIMiddleware();

  return conn;
};

/** Reusable connection for serverless / repeated request lifecycles. */
export function ensureDB(): Promise<typeof mongoose> {
  if (!connectionPromise) {
    connectionPromise = connectDB().catch((err) => {
      connectionPromise = null; // allow a later retry after a failure
      throw err;
    });
  }
  return connectionPromise;
}

export const resetConnectionPromise = () => {
  connectionPromise = null;
};

mongoose.connection.on("error", (err) => {
  console.error("MongoDB connection error:", err);
});

mongoose.connection.on("disconnected", () => {
  console.log("MongoDB disconnected");
});

export default { connectDB, ensureDB, resetConnectionPromise };
