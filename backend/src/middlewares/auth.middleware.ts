import { NextFunction, Response } from "express";
import jwt from "jsonwebtoken";

import { User } from "../models/User.js";
import { config } from "../config/env.js";
import { AuthenticatedRequest } from "../types/authenticated-request.js";

export type { AuthenticatedRequest } from "../types/authenticated-request.js";

export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const cookieToken = req.cookies?.session;
  const authHeader = req.headers.authorization;
  const headerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;
  const token = cookieToken || headerToken;
  const authEnabled = config.NODE_ENV === "production" || config.ENABLE_AUTH === true;

  if (!token) {
    if (!authEnabled) {
      try {
        const email = "local-development-user@localhost.invalid";
        const user = await User.findOneAndUpdate(
          { email },
          { $setOnInsert: { name: "Local developer" } },
          { new: true, upsert: true, setDefaultsOnInsert: true },
        );
        req.user = {
          id: user._id.toString(),
          sub: user._id.toString(),
          email: user.email,
          name: user.name,
        };
        next();
        return;
      } catch {
        res.status(503).json({
          success: false,
          error: "The local development user could not be initialized.",
        });
        return;
      }
    }
    res.status(401).json({ success: false, error: "Authentication required" });
    return;
  }

  try {
    const decoded = jwt.verify(token, config.JWT_SECRET) as {
      sub?: string;
      id?: string;
      email?: string;
      name?: string;
    };
    const id = decoded.sub || decoded.id;
    if (!id) {
      res.status(401).json({ success: false, error: "Invalid or expired session token" });
      return;
    }
    req.user = { id, sub: decoded.sub, email: decoded.email, name: decoded.name };
    next();
  } catch {
    res.status(401).json({ success: false, error: "Invalid or expired session token" });
  }
}