import { Router } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { verifyGoogleToken } from "./google.js";
import { User } from "../models/User.js";
import { Plan } from "../models/Plan.js";
import { Sprint } from "../models/Sprint.js";
import { SprintDay } from "../models/SprintDay.js";
import { PlanProgress } from "../models/PlanProgress.js";
import { Assessment } from "../models/Assessment.js";
import { Flashcard } from "../models/Flashcard.js";
import { UserResource } from "../models/UserResource.js";
import { RagSource } from "../models/RagSource.js";
import { Notification } from "../models/Notification.js";
import { ChatSession } from "../models/ChatSession.js";
import { CustomTask } from "../models/CustomTask.js";
import { AuditLog } from "../models/AuditLog.js";

const router = Router();
const SESSION_TTL = "30d";
const SESSION_MAX_AGE = 30 * 24 * 60 * 60 * 1000;
const isProduction = process.env.NODE_ENV === "production";
const sessionCookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? "none" as const : "lax" as const,
  path: "/",
};

function formatUserPayload(user: any) {
  return {
    id: user._id,
    sub: user._id.toString(),
    email: user.email,
    name: user.name,
    ai_credits: user.ai_credits ?? 30,
    profile: user.profile || { skills: [] },
  };
}

function setSessionCookie(res: import("express").Response, user: { _id: unknown; email: string; name: string }) {
  const sessionToken = jwt.sign(
    { sub: user._id, email: user.email, name: user.name },
    process.env.JWT_SECRET!,
    { expiresIn: SESSION_TTL }
  );

  res.cookie("session", sessionToken, {
    ...sessionCookieOptions,
    maxAge: SESSION_MAX_AGE,
  });
}

function clearSessionCookie(res: import("express").Response) {
  res.clearCookie("session", sessionCookieOptions);
}

// Manual Signup
router.post("/api/auth/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: "Name, email, and password are required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters long" });
    }

    const cleanEmail = email.trim().toLowerCase();
    const existingUser = await User.findOne({ email: cleanEmail });
    if (existingUser) {
      return res.status(400).json({ error: "An account with this email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      name: name.trim(),
      email: cleanEmail,
      password: hashedPassword,
      ai_credits: 30,
    });

    setSessionCookie(res, user);

    res.json({
      user: formatUserPayload(user),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Signup failed" });
  }
});

// Manual Login
router.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: cleanEmail });
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    if (!user.password) {
      return res.status(401).json({ error: "Account was created using Google. Please sign in with Google." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    setSessionCookie(res, user);

    res.json({
      user: formatUserPayload(user),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Login failed" });
  }
});

// Google OAuth Login / Signup
router.post("/api/auth/google", async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) return res.status(400).json({ error: "idToken required" });

    const googleUser = await verifyGoogleToken(idToken);
    if (!googleUser.email) {
      return res.status(400).json({ error: "Google account does not provide an email address" });
    }
    const cleanEmail = googleUser.email.toLowerCase();

    let user = await User.findOne({
      $or: [{ googleId: googleUser.googleId }, { email: cleanEmail }],
    });

    if (!user) {
      user = await User.create({
        googleId: googleUser.googleId,
        email: cleanEmail,
        name: googleUser.name,
        ai_credits: 30,
      });
    } else if (!user.googleId) {
      user.googleId = googleUser.googleId;
      await user.save();
    }

    setSessionCookie(res, user);

    res.json({
      user: formatUserPayload(user),
    });
  } catch (err) {
    res.status(401).json({ error: "Authentication failed" });
  }
});

// Clean session check (returns HTTP 200 with user: null when logged out, avoiding red console errors)
router.get("/api/auth/me", async (req, res) => {
  const token = req.cookies.session;
  if (!token) {
    return res.status(200).json({ user: null });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { sub?: string; id?: string; email?: string; name?: string };
    const userId = decoded.sub || decoded.id;
    if (!userId) {
      return res.status(200).json({ user: null });
    }

    const user = await User.findById(userId).select("-password");
    if (!user) {
      clearSessionCookie(res);
      return res.status(200).json({ user: null });
    }

    res.json({
      user: formatUserPayload(user),
    });
  } catch {
    clearSessionCookie(res);
    res.status(200).json({ user: null });
  }
});

// Update User Profile
router.put("/api/auth/profile", async (req, res) => {
  const token = req.cookies.session;
  if (!token) return res.status(401).json({ error: "Authentication required" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { sub?: string; id?: string };
    const userId = decoded.sub || decoded.id;
    if (!userId) return res.status(401).json({ error: "Invalid token" });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    const {
      target_role,
      experience_level,
      skills,
      github_url,
      resume_url,
      resume_filename,
      resume_text,
    } = req.body;

    const currentProfile = user.profile || { skills: [] };

    const validLevels = ["student", "fresher", "experienced"];
    const normalizedLevel =
      experience_level && validLevels.includes(experience_level)
        ? experience_level
        : currentProfile.experience_level;

    user.profile = {
      target_role: typeof target_role === "string" ? target_role.trim().slice(0, 100) : currentProfile.target_role,
      experience_level: normalizedLevel,
      skills: Array.isArray(skills)
        ? skills.map((s: any) => String(s).trim().slice(0, 50)).filter(Boolean).slice(0, 50)
        : currentProfile.skills || [],
      github_url: typeof github_url === "string" ? github_url.trim().slice(0, 255) : currentProfile.github_url,
      resume_url: typeof resume_url === "string" ? resume_url.trim().slice(0, 2048) : currentProfile.resume_url,
      resume_filename: typeof resume_filename === "string" ? resume_filename.trim().slice(0, 255) : currentProfile.resume_filename,
      resume_text: typeof resume_text === "string" ? resume_text.slice(0, 100000) : currentProfile.resume_text,
    };

    await user.save();

    res.json({
      success: true,
      profile: user.profile,
      user: formatUserPayload(user),
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Failed to update profile" });
  }
});

// Delete Account with Confirmation & Audit Log
router.delete("/api/auth/account", async (req, res) => {
  const token = req.cookies.session;
  if (!token) return res.status(401).json({ error: "Authentication required" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { sub?: string; id?: string };
    const userId = decoded.sub || decoded.id;
    if (!userId) return res.status(401).json({ error: "Invalid token" });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    const confirmation = String(req.body?.confirmation || "").trim().toLowerCase();
    if (confirmation !== "delete") {
      return res.status(400).json({ error: "Please type 'delete' to confirm account deletion." });
    }

    const ipAddress = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "";
    const userAgent = req.headers["user-agent"] || "";

    // Audit Log record stored before deletion
    await AuditLog.create({
      user_id: user._id,
      action: "account_deletion",
      email: user.email,
      details: {
        userName: user.name,
        confirmationKeyword: req.body?.confirmation,
        deletedAt: new Date(),
      },
      ip_address: ipAddress,
      userAgent: userAgent,
    });

    // Cascading deletion
    const plans = await Plan.find({ user_id: user._id }).select("_id").lean();
    const planIds = plans.map((p) => p._id);
    const sprints = await Sprint.find({ plan_id: { $in: planIds } }).select("_id").lean();
    const sprintIds = sprints.map((s) => s._id);

    await Promise.all([
      SprintDay.deleteMany({ sprint_id: { $in: sprintIds } }),
      Sprint.deleteMany({ _id: { $in: sprintIds } }),
      Plan.deleteMany({ user_id: user._id }),
      PlanProgress.deleteMany({ user_id: user._id }),
      Assessment.deleteMany({ user_id: user._id }),
      Flashcard.deleteMany({ user_id: user._id }),
      UserResource.deleteMany({ user_id: user._id }),
      RagSource.deleteMany({ user_id: user._id }),
      Notification.deleteMany({ user_id: user._id }),
      ChatSession.deleteMany({ user_id: user._id }),
      CustomTask.deleteMany({ user_id: user._id }),
      User.deleteOne({ _id: user._id }),
    ]);

    clearSessionCookie(res);
    res.json({ success: true, message: "Your account and all associated data have been permanently deleted." });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Failed to delete account" });
  }
});

router.post("/api/auth/logout", (_req, res) => {
  clearSessionCookie(res);
  res.json({ success: true });
});

export default router;

