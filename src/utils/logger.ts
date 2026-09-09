import winston from "winston";
import fs from "fs";
import path from "path";

/**
 * Serverless-safe logger.
 *
 * Vercel/lambda runtimes have a READ-ONLY project directory (`/var/task`):
 * opening a file transport or mkdir-ing at import time would throw EROFS on
 * every cold start. On Vercel we log to stdout only (the platform captures
 * it); on traditional hosts (Docker/local) a rotating-style file transport is
 * added when the logs directory is writable.
 */
const transports: winston.transport[] = [new winston.transports.Console()];

if (!process.env.VERCEL) {
  try {
    const logsDir = path.join(process.cwd(), "logs");
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    transports.push(new winston.transports.File({ filename: path.join(logsDir, "combined.log") }));
  } catch {
    // Non-writable disk (e.g. serverless sandbox without /tmp): console only.
  }
}

const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(
      (info: Record<string, unknown>) => {
        const timestamp = typeof info.timestamp === "string" ? info.timestamp : String(info.timestamp ?? "");
        const level = typeof info.level === "string" ? info.level : String(info.level ?? "");
        const message = typeof info.message === "string" ? info.message : JSON.stringify(info.message ?? "");
        return `${timestamp} [${level}]: ${message}`;
      }
    )
  ),
  transports,
});

export default logger;