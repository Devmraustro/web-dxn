import winston from "winston";

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
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: "logs/combined.log" }),
  ],
});

export default logger;

// Ensure logs directory exists
import fs from "fs";
import path from "path";

const logsDir = path.join(__dirname, "../..", "logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}