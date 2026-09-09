import mongoose from "mongoose";
import { initializeAIMiddleware } from "./controllers/ai/ai.controller";

export const connectDB = async () => {
  const conn = await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/dxn_store");
  console.log(`MongoDB Connected: ${conn.connection.host}`);

  // Initialize AI knowledge base
  await initializeAIMiddleware();

  return conn;
};

mongoose.connection.on("error", (err) => {
  console.error("MongoDB connection error:", err);
});

mongoose.connection.on("disconnected", () => {
  console.log("MongoDB disconnected");
});