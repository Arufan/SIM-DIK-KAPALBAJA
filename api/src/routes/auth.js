import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { PrismaClient } from "@prisma/client";
import { signAccessToken, signRefreshToken, requireAuth } from "../middleware/auth.js";

const prisma = new PrismaClient();
export const authRouter = Router();

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "username dan password wajib diisi" });

  const { username, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || !user.isActive || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ error: "username atau password salah" });
  }

  res.json({
    accessToken: signAccessToken(user),
    refreshToken: signRefreshToken(user),
    profile: { id: user.id, username: user.username, displayName: user.displayName, role: user.role },
  });
});

const refreshSchema = z.object({ refreshToken: z.string().min(1) });

authRouter.post("/refresh", async (req, res) => {
  const parsed = refreshSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "refreshToken required" });

  let payload;
  try {
    payload = jwt.verify(parsed.data.refreshToken, process.env.JWT_REFRESH_SECRET);
  } catch {
    return res.status(401).json({ error: "refresh token invalid or expired — login required" });
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || !user.isActive) return res.status(401).json({ error: "account disabled" });

  res.json({
    accessToken: signAccessToken(user),
    profile: { id: user.id, username: user.username, displayName: user.displayName, role: user.role },
  });
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.sub } });
  if (!user) return res.status(404).json({ error: "user not found" });
  res.json({ id: user.id, username: user.username, displayName: user.displayName, role: user.role });
});
