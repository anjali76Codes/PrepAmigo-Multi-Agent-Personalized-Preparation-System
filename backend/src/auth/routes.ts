import { Router } from "express";
import jwt from "jsonwebtoken";
import { verifyGoogleToken } from "./google.js";

const router = Router();

router.post("/api/auth/google", async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) return res.status(400).json({ error: "idToken required" });

    const user = await verifyGoogleToken(idToken);

    const sessionToken = jwt.sign(
      { sub: user.googleId, email: user.email, name: user.name },
      process.env.JWT_SECRET!,
      { expiresIn: "7d" },
    );

    res.cookie("session", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({ user });
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
