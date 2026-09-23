import express, { Request, Response } from "express";
import cookieParser from "cookie-parser";
import { config } from "./config/env.js";
import { logger } from "./utils/logger.js";
import authRouter from "./auth/routes.js";

const app = express();

// Standard express parsing middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// HTTP Request Logger Middleware
app.use((req: Request, _res: Response, next) => {
  logger.http(`${req.method} ${req.url}`);
  next();
});

// Production Health Check Route
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

app.listen(config.PORT, () => {
  logger.info(
    `Server running in ${config.NODE_ENV} mode on port ${config.PORT}`,
  );
});
