// Main server entry point
import "./db";
import app from "./app";
import { PORT } from "./config";
import { connectDB } from "./db";
import type { Server } from "http";

const portNumber = Number(PORT) || 5000;

// Returns the configured Express app (used by tests and consumers)
export const startServer = () => app;

// Attempts a database connection without crashing the process if the
// database is temporarily unreachable (so /api/health stays responsive).
export const connectToDatabase = async (): Promise<void> => {
  try {
    await connectDB();
  } catch (error) {
    console.error("Database connection failed - starting without database:", error);
  }
};

// Starts the HTTP listener and returns the running server
export const startListening = (): Server => {
  const server = app.listen(portNumber, () => {
    console.log(`DXN Store API running on port ${portNumber}`);
  });
  return server;
};

// Only auto-start when executed directly (node dist/index.js, ts-node .../index.ts)
if (require.main === module) {
  void connectToDatabase();
  startListening();
}

export default startServer;