import { Router } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { verifyGoogleToken } from "./google.js";
import { User } from "../models/User.js";

const router = Router();

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
    });

    const sessionToken = jwt.sign(
      { sub: user._id, email: user.email, name: user.name },
      process.env.JWT_SECRET!,
      { expiresIn: "7d" }
    );

    res.cookie("session", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({ user: { id: user._id, email: user.email, name: user.name } });
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

    const sessionToken = jwt.sign(
      { sub: user._id, email: user.email, name: user.name },
      process.env.JWT_SECRET!,
      { expiresIn: "7d" }
    );

    res.cookie("session", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({ user: { id: user._id, email: user.email, name: user.name } });
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
      });
    } else if (!user.googleId) {
      user.googleId = googleUser.googleId;
      await user.save();
    }

    const sessionToken = jwt.sign(
      { sub: user._id, email: user.email, name: user.name },
      process.env.JWT_SECRET!,
      { expiresIn: "7d" }
    );

    res.cookie("session", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({ user: { id: user._id, email: user.email, name: user.name } });
  } catch (err) {
    res.status(401).json({ error: "Authentication failed" });
  }
});

router.get("/api/auth/me", (req, res) => {
  const token = req.cookies.session;
  if (!token) return res.status(401).json({ error: "Not authenticated" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!);
    res.json({ user: decoded });
  } catch {
    res.status(401).json({ error: "Invalid session" });
  }
});

router.post("/api/auth/logout", (_req, res) => {
  res.clearCookie("session");
  res.json({ success: true });
});

export default router;
