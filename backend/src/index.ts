import express, { Request, Response } from "express";
import cookieParser from "cookie-parser";
import { config } from "./config/env.js";
import { logger } from "./utils/logger.js";
import authRouter from "./auth/routes.js";
import apiRouter from "./routes/index.js";
import { connectDB } from "./config/db.js";
import { startDailyDigestJob } from "./jobs/dailyDigest.js";
import cors from "cors";

const app = express();

// CORS MUST come before routes
app.use(
  cors({
    origin: [config.FRONTEND_URL ||"http://localhost:5173"],
    credentials: true,
  }),
);

// Standard express parsing middlewares
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

// HTTP Request Logger Middleware
app.use((req: Request, _res: Response, next) => {
  logger.http(`${req.method} ${req.url}`);
  next();
});

// Health check
app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "UP",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.NODE_ENV,
  });
});

// Auth routes
app.use(authRouter);

import voiceRouter from "./routes/voice.js";

// Agent, job-intelligence, plans, sprints, and progress routes
app.use(apiRouter);
app.use("/api/voice", voiceRouter);

// Start accepting requests only after MongoDB is connected and models are registered.
void connectDB().then(() => {
  app.listen(config.PORT, () => {
    logger.info(
      `Server running in ${config.NODE_ENV} mode on port ${config.PORT}`,
    );
    startDailyDigestJob();
  });
});
