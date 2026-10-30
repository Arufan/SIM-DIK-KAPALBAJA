import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, getMeta, setMeta } from "./db.js";
import { apiFetch, getAuth } from "./api.js";

// Outbox sync engine (plan §3):
//  1. every mutation is written to the local table immediately (saveRecord /
//     deleteRecord) plus an outbox entry — the UI never waits for the network;
//  2. push() reads outbox entries, sends the CURRENT local row state (newer
//     edits collapse into the same push), applies serverRows that are newer
//     than the local copy (conflict loser catches up), then clears exactly
//     the seqs it read;
//  3. pull() applies server rows only when strictly newer, so echoes of our
//     own push are no-ops, then advances the cursor.

let deviceId = localStorage.getItem("simdik_device_id");
if (!deviceId) {
  deviceId = crypto.randomUUID();
  localStorage.setItem("simdik_device_id", deviceId);
}

let syncTimer = null;
let syncing = false;
const listeners = new Set();
const notify = () => listeners.forEach((fn) => fn());

export async function saveRecord(table, row) {
  row.updatedAt = new Date().toISOString();
  await db.transaction("rw", db[table], db.outbox, async () => {
    await db[table].put(row);
    await db.outbox.add({ table, op: "put", rowId: row.id });
  });
  scheduleSync();
}

export async function deleteRecord(table, id) {
  const row = await db[table].get(id);
  const t = new Date().toISOString();
  await db.transaction("rw", db[table], db.outbox, async () => {
    if (row) await db[table].put({ ...row, deletedAt: t, updatedAt: t });
    await db.outbox.add({ table, op: "delete", rowId: id });
  });
  scheduleSync();
}

export function scheduleSync() {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => sync(), 1500);
}

export async function sync() {
  if (syncing || !navigator.onLine || !getAuth()) { notify(); return; }
  syncing = true;
  notify();
  try {
    await push();
    await pull();
    await setMeta("lastSync", new Date().toISOString());
  } catch (e) {
    if (e?.sessionExpired) notify(); // App.jsx listens for this via status
    // network/offline errors are fine: data stays queued in the outbox
  } finally {
    syncing = false;
    notify();
  }
}

async function push() {
  const entries = await db.outbox.toArray();
  if (entries.length === 0) return;

  // One change per row: the CURRENT local state is what we send (newer edits
  // collapse into the same push).
  const byRow = new Map();
  for (const e of entries) if (!byRow.has(e.rowId)) byRow.set(e.rowId, e);
  const changes = [];
  const tableOf = new Map();
  for (const e of byRow.values()) {
    const row = await db[e.table].get(e.rowId);
    tableOf.set(e.rowId, e.table);
    if (e.op === "delete" || !row) {
      changes.push({ table: e.table, op: "delete", row: { id: e.rowId, updatedAt: row?.updatedAt ?? new Date().toISOString() } });
    } else {
      changes.push({ table: e.table, op: "update", row });
    }
  }

  const res = await apiFetch("/sync/push", { method: "POST", body: { deviceId, changes } });
  const resolved = new Set();
  const rejected = [];
  const winningRows = [];
  for (const r of res.results) {
    if (!tableOf.has(r.id)) continue;
    if (r.status === "accepted" || r.status === "conflict") {
      resolved.add(r.id);
      if (r.serverRow) winningRows.push({ table: tableOf.get(r.id), row: r.serverRow });
    } else {
      rejected.push({ id: r.id, errors: r.errors ?? [] });
    }
  }

  // Drop only resolved entries; rejected ones stay queued and are surfaced in
  // the badge instead of vanishing silently.
  const seqs = entries.filter((e) => resolved.has(e.rowId)).map((e) => e.seq);
  if (seqs.length) await db.outbox.bulkDelete(seqs);
  await setMeta("lastRejected", rejected.length ? { at: new Date().toISOString(), count: rejected.length, items: rejected.slice(0, 5) } : null);

  // Adopt the server's winning version unless a NEWER local edit is still queued.
  for (const { table, row } of winningRows) {
    const stillPending = await db.outbox.where("rowId").equals(row.id).count();
    if (stillPending === 0) await db[table].put(row);
  }
}

async function pull() {
  const cursor = await getMeta("cursor");
  const res = await apiFetch(`/sync/pull${cursor ? `?since=${encodeURIComponent(cursor)}` : ""}`);
  for (const ch of res.changes) {
    // Provenance-based apply: every delivered change is new information (the
    // cursor guarantees it). Only skip rows that still have unpushed local
    // edits — the next push reconciles those. No client-clock comparisons.
    const stillPending = await db.outbox.where("rowId").equals(ch.row.id).count();
    if (stillPending > 0) continue;
    await db[ch.table].put(ch.row);
  }
  await setMeta("cursor", res.cursor);
}

/**
 * Full resync — repair for devices whose local copy diverged (e.g. legacy
 * clock-skew conflicts). Pushes pending changes first, then rebuilds every
 * synced table from the server. Refuses if anything is still unsynced.
 */
export async function resyncAll() {
  if (syncing || !navigator.onLine || !getAuth()) throw new Error("Butuh koneksi internet");
  syncing = true;
  notify();
  try {
    await push();
    if ((await db.outbox.count()) > 0) {
      throw new Error("Masih ada perubahan belum tersinkron — periksa dulu sebelum sinkron ulang");
    }
    await db.transaction("rw", db.caang, db.weekly_evals, db.stage_evals, db.meta, async () => {
      await db.caang.clear();
      await db.weekly_evals.clear();
      await db.stage_evals.clear();
      await db.meta.delete("cursor");
    });
    await pull();
    await setMeta("lastSync", new Date().toISOString());
  } finally {
    syncing = false;
    notify();
  }
}

/** Pending count + last sync time for the badge; re-runs whenever they change. */
export function useSyncStatus() {
  const pending = useLiveQuery(() => db.outbox.count(), [], 0);
  const lastSync = useLiveQuery(() => getMeta("lastSync"), [], null);
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => { setOnline(true); sync(); };
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    const iv = setInterval(() => sync(), 60000);
    sync();
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); clearInterval(iv); };
  }, []);
  return { pending, lastSync, online, syncing };
}
