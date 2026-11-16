import { Router } from "express";
import { z } from "zod";
import { PrismaClient } from "@prisma/client";
import { requireAdmin } from "../middleware/auth.js";

// App-wide settings (rapor signature block). Readable by any authenticated
// user, writable by admins only. Stored server-side so every device renders
// identical rapors; clients cache the values for offline PDF export.
const prisma = new PrismaClient();
export const settingsRouter = Router();

const KEYS = [
  "rapor_penguji_nama",
  "rapor_ketua_nama",
  "rapor_ketua_nim",
  "rapor_pembimbing_nama",
  "rapor_pembimbing_nidn",
];

async function readAll() {
  const rows = await prisma.setting.findMany({ where: { key: { in: KEYS } } });
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

settingsRouter.get("/", async (_req, res) => {
  res.json(await readAll());
});

const putSchema = z.object(
  Object.fromEntries(KEYS.map((k) => [k, z.string().max(80).optional()])),
);

settingsRouter.put("/", requireAdmin, async (req, res) => {
  const parsed = putSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "data tidak valid" });
  for (const [key, value] of Object.entries(parsed.data)) {
    if (value === undefined) continue;
    await prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
  }
  res.json(await readAll());
});