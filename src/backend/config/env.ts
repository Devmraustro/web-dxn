export const PORT = process.env.PORT || 5000;
export const NODE_ENV = process.env.NODE_ENV || "development";
export const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/dxn_store";
export const JWT_SECRET = (() => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (NODE_ENV === "production") {
      throw new Error("FATAL: JWT_SECRET environment variable is required in production");
    }
    console.warn("[env] JWT_SECRET not set — using insecure development fallback. Set it before deployment.");
    return "dxn_store_development_secret_change_production";
  }
  if (secret.length < 32) {
    if (NODE_ENV === "production") {
      throw new Error("FATAL: JWT_SECRET must be at least 32 characters");
    }
    console.warn("[env] JWT_SECRET is shorter than 32 characters — this is weak for production.");
  }
  return secret;
})();
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";
export const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:3000";
export const BCRYPT_SALT_ROUNDS = process.env.BCRYPT_SALT_ROUNDS || "12";
export const MAX_FILE_SIZE = process.env.MAX_FILE_SIZE || "5242880"; // 5MB
export const ALLOWED_MIME_TYPES = process.env.ALLOWED_MIME_TYPES || "image/jpeg,image/png,image/webp,video/mp4";
export const API_RATE_LIMIT = process.env.API_RATE_LIMIT || "100"; // requests per window
export const API_RATE_WINDOW = process.env.API_RATE_WINDOW || "15"; // minutes