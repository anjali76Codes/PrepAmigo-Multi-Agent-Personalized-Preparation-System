import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config/env.js";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    sub?: string;
    email?: string;
    name?: string;
  };
}

export function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const cookieToken = req.cookies?.session;
  const authHeader = req.headers.authorization;
  const headerToken = authHeader && authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : undefined;

  const token = cookieToken || headerToken;

  if (!token) {
    return res.status(401).json({ success: false, error: "Authentication required" });
  }

  try {
    const decoded = jwt.verify(token, config.JWT_SECRET) as any;
    req.user = {
      id: decoded.sub || decoded.id,
      sub: decoded.sub,
      email: decoded.email,
      name: decoded.name,
    };
    next();
  } catch {
    return res.status(401).json({ success: false, error: "Invalid or expired session token" });
  }
}
