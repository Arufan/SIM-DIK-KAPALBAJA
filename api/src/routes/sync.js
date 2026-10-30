import { Router } from "express";
import { z } from "zod";
import { PrismaClient } from "@prisma/client";
import { fisikScore, weeklyTotal, stageTotal } from "../lib/scoring.js";

// Offline sync contract (plan §3) — the only write path the offline-first web
// app and APK use. All rows carry client-generated ids (UUIDv4) and ISO
// `updatedAt`; conflicts resolve last-write-wins on updatedAt.
//
// POST /sync/push  { deviceId, changes: [{ table, op, row }] }
//   -> { results: [{ id, status: "accepted" | "conflict", serverRow? }], serverTime }
//   A change is "accepted" when its updatedAt is >= the stored row's; otherwise
//   the stored (winning) row is returned as serverRow so the device can catch up.
//   Derived scores (fisikScore, weekly avg, stage rata) are recomputed server-side.
//
// GET /sync/pull?since=<ISO>
//   -> { changes: [{ table, op: "upsert" | "delete", row }], cursor, serverTime }
//   Every row (including soft-delete tombstones) with server-stamped syncedAt > since.
//   Clients apply a pulled row only when it is newer than their local copy,
//   which makes echoing a device's own push back to it harmless.

const prisma = new PrismaClient();
export const syncRouter = Router();

const isoDate = z.string().refine((s) => !Number.isNaN(Date.parse(s)), "invalid ISO date");

const caangRow = z.object({
  id: z.string().min(1),
  npm: z.string().min(1),
  nama: z.string().min(1),
  fakultas: z.string().min(1),
  prodi: z.string().min(1),
  angkatan: z.string().min(1),
  mentorId: z.string().nullish(),
  mentorNama: z.string().nullish(),
  status: z.enum(["aktif", "lulus_standar", "perlu_evaluasi", "anggota_muda"]).default("aktif"),
  createdAt: isoDate.optional(),
  updatedAt: isoDate,
});

const weeklyRow = z.object({
  id: z.string().min(1),
  caangId: z.string().min(1),
  weekNo: z.number().int().min(1).max(14),
  tanggal: isoDate,
  navdarT: z.number().nullish(), navdarP: z.number().nullish(),
  taliT: z.number().nullish(), taliP: z.number().nullish(),
  ppgdT: z.number().nullish(), ppgdP: z.number().nullish(),
  survivalT: z.number().nullish(), survivalP: z.number().nullish(),
  buddy: z.number().nullish(), team: z.number().nullish(),
  runMin: z.number().nullish(), pushUp: z.number().int().min(0).nullish(), pullUp: z.number().int().min(0).nullish(),
  catatan: z.string().nullish(),
  updatedAt: isoDate,
});

const stageRow = z.object({
  id: z.string().min(1),
  caangId: z.string().min(1),
  stage: z.enum(["uji_kampus", "diksar", "diklat"]),
  penguji: z.string().min(1),
  tanggal: isoDate,
  navdarT: z.number(), navdarP: z.number(),
  taliT: z.number(), taliP: z.number(),
  ppgdT: z.number(), ppgdP: z.number(),
  survivalT: z.number(), survivalP: z.number(),
  mppT: z.number(), mppP: z.number(),
  keterangan: z.string().nullish(),
  updatedAt: isoDate,
});

const TABLES = {
  caang: { schema: caangRow, model: prisma.caang },
  weekly_evals: { schema: weeklyRow, model: prisma.weeklyEval },
  stage_evals: { schema: stageRow, model: prisma.stageEval },
};

const pushSchema = z.object({
  deviceId: z.string().min(1),
  changes: z.array(z.object({
    table: z.enum(["caang", "weekly_evals", "stage_evals"]),
    op: z.enum(["create", "update", "delete"]),
    row: z.record(z.string(), z.unknown()),
  })).max(500),
});

/** Map a validated client row to Prisma columns, recomputing derived scores. */
function toColumns(table, row) {
  const base = { updatedAt: new Date(row.updatedAt), syncedAt: new Date() };
  if (row.createdAt) base.createdAt = new Date(row.createdAt);
  if (table === "caang") {
    return { ...base, id: row.id, npm: row.npm, nama: row.nama, fakultas: row.fakultas, prodi: row.prodi, angkatan: row.angkatan, mentorId: row.mentorId ?? null, mentorNama: row.mentorNama ?? null, status: row.status };
  }
  if (table === "weekly_evals") {
    const fisik = fisikScore(row.runMin, row.pushUp, row.pullUp);
    return { ...base, id: row.id, caangId: row.caangId, weekNo: row.weekNo, tanggal: row.tanggal, navdarT: row.navdarT ?? null, navdarP: row.navdarP ?? null, taliT: row.taliT ?? null, taliP: row.taliP ?? null, ppgdT: row.ppgdT ?? null, ppgdP: row.ppgdP ?? null, survivalT: row.survivalT ?? null, survivalP: row.survivalP ?? null, buddy: row.buddy ?? null, team: row.team ?? null, runMin: row.runMin ?? null, pushUp: row.pushUp ?? null, pullUp: row.pullUp ?? null, fisikScore: fisik, avg: weeklyTotal({ ...row, fisikScore: fisik }), catatan: row.catatan ?? null };
  }
  return { ...base, id: row.id, caangId: row.caangId, stage: row.stage, penguji: row.penguji, tanggal: row.tanggal, navdarT: row.navdarT, navdarP: row.navdarP, taliT: row.taliT, taliP: row.taliP, ppgdT: row.ppgdT, ppgdP: row.ppgdP, survivalT: row.survivalT, survivalP: row.survivalP, mppT: row.mppT, mppP: row.mppP, rata: stageTotal(row), keterangan: row.keterangan ?? null };
}

const isNewer = (incomingIso, stored) => !stored || new Date(incomingIso) >= stored.updatedAt;

const deleteRow = z.object({ id: z.string().min(1), updatedAt: isoDate });

async function applyChange(change, req) {
  const def = TABLES[change.table];
  // Deletes travel as tombstones ({ id, updatedAt }) — no full row needed.
  const parsed = (change.op === "delete" ? deleteRow : def.schema).safeParse(change.row);
  if (!parsed.success) {
    return { id: String(change.row?.id ?? "?"), status: "rejected", errors: parsed.error.issues.slice(0, 3) };
  }
  const row = parsed.data;
  const existing = await def.model.findUnique({ where: { id: row.id } });

  // Caang edit/delete is admin-only (mentors may create, auto-assigned to them).
  if (change.table === "caang" && change.op !== "create" && req.user.role !== "admin") {
    return { id: row.id, status: "rejected", errors: [{ message: "edit/hapus calon anggota khusus admin" }] };
  }

  if (change.op === "delete") {
    // Deletes win by arrival — a device clock that is behind must never be
    // able to "hide" a row locally while the server keeps it alive elsewhere.
    if (!existing) return { id: row.id, status: "accepted" };
    const serverRow = await def.model.update({
      where: { id: row.id },
      data: { deletedAt: new Date(), updatedAt: new Date(), syncedAt: new Date() },
    });
    // Cascade: a deleted caang takes their evaluation history with them.
    if (change.table === "caang") {
      const stamp = { deletedAt: new Date(), updatedAt: new Date(), syncedAt: new Date() };
      await prisma.weeklyEval.updateMany({ where: { caangId: row.id, deletedAt: null }, data: stamp });
      await prisma.stageEval.updateMany({ where: { caangId: row.id, deletedAt: null }, data: stamp });
    }
    return { id: row.id, status: "accepted", serverRow };
  }

  if (!isNewer(row.updatedAt, existing)) {
    return { id: row.id, status: "conflict", serverRow: existing };
  }

  // Mentors may only own/create caang assigned to themselves; admin sets freely.
  const columns = toColumns(change.table, row);
  if (change.table === "caang") {
    const me = await prisma.user.findUnique({ where: { id: req.user.sub }, select: { displayName: true } });
    if (req.user.role !== "admin") {
      columns.mentorId = req.user.sub;
      columns.mentorNama = me?.displayName ?? null;
    } else if (!columns.mentorNama) {
      columns.mentorNama = existing?.mentorNama ?? me?.displayName ?? null;
      if (!columns.mentorId && !existing?.mentorId) columns.mentorId = req.user.sub;
    }
  }

  try {
    const serverRow = await def.model.upsert({
      where: { id: row.id },
      update: { ...columns, id: undefined },
      create: columns,
    });
    return { id: row.id, status: "accepted", serverRow };
  } catch (e) {
    // Unique (caangId, weekNo) hit: two devices created the same week's eval.
    // Keep whichever row is newer.
    if (e?.code === "P2002" && change.table === "weekly_evals") {
      const twin = await prisma.weeklyEval.findUnique({ where: { caangId_weekNo: { caangId: row.caangId, weekNo: row.weekNo } } });
      if (twin && new Date(row.updatedAt) >= twin.updatedAt) {
        const serverRow = await prisma.weeklyEval.update({ where: { id: twin.id }, data: { ...columns, id: undefined, deletedAt: null } });
        return { id: row.id, status: "accepted", serverRow };
      }
      return { id: row.id, status: "conflict", serverRow: twin };
    }
    throw e;
  }
}

syncRouter.post("/push", async (req, res) => {
  const parsed = pushSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid push payload", details: parsed.error.issues.slice(0, 5) });

  const results = [];
  for (const change of parsed.data.changes) {
    results.push(await applyChange(change, req));
  }
  res.json({ results, serverTime: new Date().toISOString() });
});

syncRouter.get("/pull", async (req, res) => {
  const since = req.query.since ? new Date(String(req.query.since)) : new Date(0);
  if (Number.isNaN(since.getTime())) return res.status(400).json({ error: "since must be an ISO date" });

  const now = new Date(); // cursor captured up-front: no row in (since, now] can be missed
  const changes = [];
  for (const [table, { model }] of Object.entries(TABLES)) {
    const rows = await model.findMany({ where: { syncedAt: { gt: since, lte: now } } });
    for (const row of rows) {
      changes.push({ table, op: row.deletedAt ? "delete" : "upsert", row });
    }
  }
  res.json({ changes, cursor: now.toISOString(), serverTime: new Date().toISOString() });
});
