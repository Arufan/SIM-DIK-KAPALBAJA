import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { PrismaClient } from "@prisma/client";
import { requireAdmin } from "../middleware/auth.js";

// User Center — admin-only account management (plan §8: per-user accounts).
// Not part of the offline sync: auth data stays server-side; the panel needs
// a connection by design.
const prisma = new PrismaClient();
export const usersRouter = Router();
usersRouter.use(requireAdmin);

const publicUser = (u) => ({
  id: u.id,
  username: u.username,
  displayName: u.displayName,
  role: u.role,
  isActive: u.isActive,
  createdAt: u.createdAt,
});

const activeAdminsExcept = (id) =>
  prisma.user.count({ where: { role: "admin", isActive: true, id: { not: id } } });

usersRouter.get("/", async (_req, res) => {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { caang: { where: { deletedAt: null } } } } },
  });
  res.json(users.map(({ _count, ...u }) => ({ ...publicUser(u), caangCount: _count.caang })));
});

const createSchema = z.object({
  username: z
    .string()
    .min(3, "username minimal 3 karakter")
    .max(32)
    .regex(/^[a-zA-Z0-9._-]+$/, "username: huruf, angka, titik, garis bawah saja"),
  displayName: z.string().min(1, "nama tampilan wajib"),
  password: z.string().min(8, "password minimal 8 karakter"),
  role: z.enum(["admin", "mentor"]).default("mentor"),
});

usersRouter.post("/", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "data tidak valid" });
  }
  const { username, displayName, password, role } = parsed.data;
  try {
    const user = await prisma.user.create({
      data: { username: username.toLowerCase(), displayName, role, passwordHash: await bcrypt.hash(password, 12) },
    });
    res.json(publicUser(user));
  } catch (e) {
    if (e?.code === "P2002") return res.status(409).json({ error: "username sudah dipakai" });
    throw e;
  }
});

const patchSchema = z.object({
  displayName: z.string().min(1).optional(),
  role: z.enum(["admin", "mentor"]).optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(8, "password minimal 8 karakter").optional(),
});

usersRouter.patch("/:id", async (req, res) => {
  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "data tidak valid" });
  }
  const target = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!target) return res.status(404).json({ error: "user tidak ditemukan" });
  const d = parsed.data;

  if ((d.role === "mentor" || d.isActive === false) && target.role === "admin" && target.isActive) {
    if ((await activeAdminsExcept(target.id)) === 0) {
      return res.status(400).json({ error: "minimal harus ada satu admin aktif" });
    }
  }
  const data = {};
  if (d.displayName !== undefined) data.displayName = d.displayName;
  if (d.role !== undefined) data.role = d.role;
  if (d.isActive !== undefined) data.isActive = d.isActive;
  if (d.password !== undefined) data.passwordHash = await bcrypt.hash(d.password, 12);
  const user = await prisma.user.update({ where: { id: target.id }, data });
  res.json(publicUser(user));
});

usersRouter.delete("/:id", async (req, res) => {
  const target = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!target) return res.status(404).json({ error: "user tidak ditemukan" });
  if (target.id === req.user.sub) return res.status(400).json({ error: "tidak bisa menghapus akun sendiri" });
  if (target.role === "admin" && target.isActive && (await activeAdminsExcept(target.id)) === 0) {
    return res.status(400).json({ error: "minimal harus ada satu admin aktif" });
  }
  // release their mentees, then remove the account
  await prisma.caang.updateMany({ where: { mentorId: target.id }, data: { mentorId: null } });
  await prisma.user.delete({ where: { id: target.id } });
  res.json({ ok: true });
});
