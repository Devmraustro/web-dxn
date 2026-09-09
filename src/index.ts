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
          // Raw-Node-safe 503: this branch runs BEFORE Express has handled the
          // request, so `res` is the platform response (no .status/.json yet).
          res.statusCode = 503;
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              message: "Service temporarily unavailable — database connection required",
            })
          );
        }
        return;
      }
      // Non-API path: let the SPA render; data calls inside will receive 503s.
    }
  }
  return app(req, res);
};

/**
 * Vercel legacy launchers (the `@vercel/node` builder used by vercel.json)
 * accept the request handler either as the module export itself
 * (`module.exports = fn`) or as a `.default` property. The CommonJS output of
 * this file is made compatible with BOTH conventions so the serverless entry
 * works regardless of which shape the platform builder expects.
 */
const serverlessHandlerExport = serverlessHandler as (
  req: any,
  res: any
) => Promise<unknown>;
(serverlessHandlerExport as unknown as { default?: typeof serverlessHandlerExport }).default =
  serverlessHandlerExport;

export = serverlessHandlerExport;
