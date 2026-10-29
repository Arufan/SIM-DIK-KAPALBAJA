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

  const changes = [];
  for (const e of entries) {
    const row = await db[e.table].get(e.rowId);
    if (e.op === "delete" || !row) {
      changes.push({ table: e.table, op: "delete", row: { id: e.rowId, updatedAt: row?.updatedAt ?? new Date().toISOString() } });
    } else {
      changes.push({ table: e.table, op: "update", row });
    }
  }

  const res = await apiFetch("/sync/push", { method: "POST", body: { deviceId, changes } });
  for (const r of res.results) {
    if (r.serverRow) {
      const table = changes.find((c) => c.row.id === r.id)?.table;
      const local = table ? await db[table].get(r.id) : null;
      const newer = !local || new Date(r.serverRow.updatedAt) >= new Date(local.updatedAt);
      if (table && newer) await db[table].put(r.serverRow);
    }
  }
  await db.outbox.bulkDelete(entries.map((e) => e.seq));
}

async function pull() {
  const cursor = await getMeta("cursor");
  const res = await apiFetch(`/sync/pull${cursor ? `?since=${encodeURIComponent(cursor)}` : ""}`);
  for (const ch of res.changes) {
    const local = await db[ch.table].get(ch.row.id);
    if (!local || new Date(ch.row.updatedAt) > new Date(local.updatedAt)) {
      await db[ch.table].put(ch.row);
    }
  }
  await setMeta("cursor", res.cursor);
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
