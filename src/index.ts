// Production entry point (compiles to dist/index.js).
//
// Two run modes:
//  1. Traditional server (Docker / `node dist/index.js`) — boots the Express
//     app and listens on PORT (this file is executed as the main module).
//  2. Vercel serverless — the same compiled file is the request handler. A
//     cached Mongo connection (ensureDB) is reused across warm invocations and
//     never opened per request.
import app from "./backend/app";
import { ensureDB } from "./backend/db";
import {
  connectToDatabase,
  startListening,
} from "./backend/index";

if (require.main === module) {
  void connectToDatabase();
  startListening();
}

/**
 * Vercel/severless entry point. Returns 503 (safe, secret-free) when the
 * database is unreachable instead of buffering queries for every endpoint.
 */
const serverlessHandler = async (req: any, res: any) => {
  const path = (req?.url || "").split("?")[0] || "";
  // Paths that can be fully served without a database connection. Everything
  // else (including /sitemap.xml, which lists products) awaits ensureDB()
  // first so mongoose never buffers queries against an unopened connection.
  const needsDb = !(
    path === "/api/health" ||
    path === "/robots.txt" ||
    path === "/api/seo/robots.txt" ||
    path.startsWith("/assets/") ||
    path.startsWith("/uploads/") ||
    path.endsWith(".js") ||
    path.endsWith(".css") ||
    path.endsWith(".svg") ||
    path.endsWith(".png") ||
    path.endsWith(".ico") ||
    path.endsWith(".webmanifest")
  );
  if (needsDb) {
    try {
      await ensureDB();
    } catch (err) {
      console.error("Database unavailable:", err instanceof Error ? err.message : String(err));
      if (path.startsWith("/api/") || path.startsWith("/meta/")) {
        if (!res.headersSent) {
          res.status(503).json({ message: "Service temporarily unavailable — database connection required" });
        }
        return;
      }
      // Non-API path: let the SPA render; data calls inside will receive 503s.
    }
  }
  return app(req, res);
};

export default serverlessHandler;
