import mongoose from "mongoose";
import { logger } from "../utils/logger.js";
import { config } from "./env.js";

export async function connectDB() {
  try {
    await mongoose.connect(config.MONGODB_URI);
    logger.info("MongoDB connected");
  } catch (err) {
    logger.error("MongoDB connection failed", err);
    process.exit(1);
  }
}
