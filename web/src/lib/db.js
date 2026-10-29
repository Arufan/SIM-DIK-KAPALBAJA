import Dexie from "dexie";

// Local-first database — mirrors the server schema (plan §4). Every write is
// local; sync.js ships changes to the server via the outbox table.
export const db = new Dexie("simdik-local");

db.version(1).stores({
  caang: "id, nama, npm, angkatan, mentorId, status, updatedAt",
  weekly_evals: "id, caangId, weekNo, updatedAt, [caangId+weekNo]",
  stage_evals: "id, caangId, stage, updatedAt, [caangId+stage]",
  outbox: "++seq",
  meta: "key",
});

export const getMeta = async (key) => (await db.meta.get(key))?.value;
export const setMeta = (key, value) => db.meta.put({ key, value });

/** All non-deleted rows of a table (tombstones stay until overwritten by pull). */
export const live = (table) => db[table].filter((r) => !r.deletedAt).toArray();
