// Read-only browse endpoints — convenient for admin tooling and smoke tests.
// The offline-first client itself reads its local DB and talks to /sync only.
import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { caangStats } from "../lib/scoring.js";

const prisma = new PrismaClient();
export const browseRouter = Router();

browseRouter.get("/caang", async (req, res) => {
  const q = req.query.q ? String(req.query.q) : null;
  const rows = await prisma.caang.findMany({
    where: {
      deletedAt: null,
      ...(q ? { OR: [{ nama: { contains: q } }, { npm: { contains: q } }, { prodi: { contains: q } }] } : {}),
    },
    orderBy: { nama: "asc" },
    include: { weeklyEvals: { where: { deletedAt: null } } },
  });
  res.json(rows.map(({ weeklyEvals, ...c }) => {
    const stats = caangStats(weeklyEvals);
    return { ...c, totalAvg: stats.totalAvg, status: stats.status, evalCount: stats.count };
  }));
});

browseRouter.get("/weekly-evals", async (req, res) => {
  const rows = await prisma.weeklyEval.findMany({
    where: { deletedAt: null, ...(req.query.caangId ? { caangId: String(req.query.caangId) } : {}) },
    orderBy: [{ caangId: "asc" }, { weekNo: "asc" }],
  });
  res.json(rows);
});

browseRouter.get("/stage-evals", async (req, res) => {
  const rows = await prisma.stageEval.findMany({
    where: { deletedAt: null, ...(req.query.caangId ? { caangId: String(req.query.caangId) } : {}) },
    orderBy: [{ caangId: "asc" }, { tanggal: "asc" }],
  });
  res.json(rows);
});
