// Phase 1 exit test: run against a live dev server.
//   node --env-file=.env scripts/smoke-sync.mjs [baseUrl]
// Exercises: login, scoring parity, push/pull, LWW conflict, unique-week
// collision, soft-delete tombstones. Exits non-zero on the first failure.

const BASE = process.argv[2] || "http://127.0.0.1:8080";

let failures = 0;
function check(name, cond, extra = "") {
  if (cond) console.log(`  PASS  ${name}`);
  else {
    failures++;
    console.error(`  FAIL  ${name} ${extra}`);
  }
}

const uuid = () => crypto.randomUUID();
const nowIso = () => new Date().toISOString();
const api = async (path, { method = "GET", token, body } = {}) => {
  const res = await fetch(BASE + path, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
};

// --- scoring parity with the original site (sample rows from the live app) ---
const { fisikScore, weeklyTotal, stageTotal, caangStats } = await import("../src/lib/scoring.js");
console.log("[scoring]");
check("fisik 14.5m/35p/12p = 85", fisikScore(14.5, 35, 12) === 85);
check("fisik 15m/30p/10p  = 73", fisikScore(15, 30, 10) === 73);
check("fisik 18m/20p/6p  = 42", fisikScore(18, 20, 6) === 42);
check(
  "weekly Ahmad Mgg1 = 84.8",
  weeklyTotal({
    navdarT: 85, navdarP: 80, taliT: 90, taliP: 88, ppgdT: 78, ppgdP: 82,
    survivalT: 80, survivalP: 85, buddy: 89, team: 89, fisikScore: fisikScore(14.5, 35, 12),
  }) === 84.8,
);
check("stage rata = 87.2", stageTotal({ navdarT: 88, navdarP: 85, taliT: 90, taliP: 92, ppgdT: 85, ppgdP: 88, survivalT: 82, survivalP: 85, mppT: 85, mppP: 88 }) === 87.2);
const mk = (v) => ({ navdarT: v, navdarP: v, taliT: v, taliP: v, ppgdT: v, ppgdP: v, survivalT: v, survivalP: v, buddy: v, team: v, runMin: v === 85 ? 13.5 : 14, pushUp: v === 85 ? 30 : 23, pullUp: v === 85 ? 10 : 8 });
check("status >=80 Lulus Standar", caangStats([mk(85)]).status === "Lulus Standar");
check("status <70 Perlu Evaluasi", caangStats([mk(65)]).status === "Perlu Evaluasi");

// --- login ---
console.log("[auth]");
const bad = await api("/auth/login", { method: "POST", body: { username: "admin", password: "wrong" } });
check("wrong password rejected", bad.status === 401);
const login = await api("/auth/login", { method: "POST", body: { username: "admin", password: process.env.SEED_ADMIN_PASSWORD || "changeme123" } });
check("login ok", login.status === 200 && !!login.json.accessToken);
const token = login.json.accessToken;

// --- push: create caang + weekly eval + stage eval ---
console.log("[push create]");
const caangId = uuid();
const evalId = uuid();
const stageId = uuid();
const t0 = nowIso();

const push1 = await api("/sync/push", {
  method: "POST",
  token,
  body: {
    deviceId: "smoke-device",
    changes: [
      {
        table: "caang", op: "create",
        row: { id: caangId, npm: "2099099", nama: "Smoke Test Caang", fakultas: "Teknik", prodi: "Informatika", angkatan: "99", status: "aktif", updatedAt: t0 },
      },
      {
        table: "weekly_evals", op: "create",
        row: { id: evalId, caangId, weekNo: 1, tanggal: "2026-10-30", navdarT: 85, navdarP: 80, taliT: 90, taliP: 88, ppgdT: 78, ppgdP: 82, survivalT: 80, survivalP: 85, buddy: 89, team: 89, runMin: 14.5, pushUp: 35, pullUp: 12, catatan: "smoke", updatedAt: t0 },
      },
      {
        table: "stage_evals", op: "create",
        row: { id: stageId, caangId, stage: "uji_kampus", penguji: "Senior Budi", tanggal: "2026-10-30", navdarT: 88, navdarP: 85, taliT: 90, taliP: 92, ppgdT: 85, ppgdP: 88, survivalT: 82, survivalP: 85, mppT: 85, mppP: 88, updatedAt: t0 },
      },
    ],
  },
});
check("push accepted x3", push1.status === 200 && push1.json.results.every((r) => r.status === "accepted"), JSON.stringify(push1.json.results?.map((r) => r.status)));
const pushedEval = push1.json.results[1].serverRow;
check("server recomputed fisik=85 & avg=84.8", pushedEval?.fisikScore === 85 && pushedEval?.avg === 84.8);
check("server recomputed stage rata=87.2", push1.json.results[2].serverRow?.rata === 87.2);

// caang created by non-admin gets auto-assigned to that mentor
const mentorLogin = await api("/auth/login", { method: "POST", body: { username: "mentor", password: process.env.SEED_ADMIN_PASSWORD || "changeme123" } });
const pushMentor = await api("/sync/push", {
  method: "POST", token: mentorLogin.json.accessToken,
  body: { deviceId: "smoke-device", changes: [{ table: "caang", op: "create", row: { id: uuid(), npm: "2099098", nama: "Mentor Caang", fakultas: "F", prodi: "P", angkatan: "99", updatedAt: nowIso() } }] },
});
check("mentor-owned caang auto-assigned", pushMentor.json.results[0].status === "accepted" && pushMentor.json.results[0].serverRow.mentorId === mentorLogin.json.profile.id);

// --- LWW conflict: stale update must lose ---
console.log("[conflict]");
const stale = await api("/sync/push", {
  method: "POST", token,
  body: { deviceId: "smoke-device", changes: [{ table: "caang", op: "update", row: { id: caangId, npm: "2099099", nama: "STALE WRITE", fakultas: "Teknik", prodi: "Informatika", angkatan: "99", updatedAt: "2020-01-01T00:00:00.000Z" } }] },
});
check("stale write -> conflict", stale.json.results[0].status === "conflict" && stale.json.results[0].serverRow.nama === "Smoke Test Caang");
const fresh = await api("/sync/push", {
  method: "POST", token,
  body: { deviceId: "smoke-device", changes: [{ table: "caang", op: "update", row: { id: caangId, npm: "2099099", nama: "Smoke Test Caang v2", fakultas: "Teknik", prodi: "Informatika", angkatan: "99", updatedAt: nowIso() } }] },
});
check("fresh write -> accepted", fresh.json.results[0].status === "accepted");

// --- unique (caangId, weekNo): second eval for week 1 with a different id ---
console.log("[unique week]");
const dupEval = await api("/sync/push", {
  method: "POST", token,
  body: { deviceId: "another-device", changes: [{ table: "weekly_evals", op: "create", row: { id: uuid(), caangId, weekNo: 1, tanggal: "2026-10-30", navdarT: 50, navdarP: 50, taliT: 50, taliP: 50, ppgdT: 50, ppgdP: 50, survivalT: 50, survivalP: 50, buddy: 50, team: 50, runMin: 20, pushUp: 0, pullUp: 0, updatedAt: "2020-01-01T00:00:00.000Z" } }] },
});
check("older duplicate week -> conflict (original kept)", dupEval.json.results[0].status === "conflict" && dupEval.json.results[0].serverRow.id === evalId);

// --- partial week: only 2 materi assessed (Teori+Praktik), extras optional ---
console.log("[partial week]");
const partialId = uuid();
const partialPush = await api("/sync/push", {
  method: "POST", token,
  body: { deviceId: "partial-week-device", changes: [{ table: "weekly_evals", op: "create", row: { id: partialId, caangId, weekNo: 2, tanggal: "2026-10-31", navdarT: 80, navdarP: 90, taliT: 70, taliP: 80, ppgdT: null, ppgdP: null, survivalT: null, survivalP: null, buddy: null, team: null, runMin: null, pushUp: null, pullUp: null, updatedAt: nowIso() } }] },
});
check("partial week accepted", partialPush.json.results[0].status === "accepted");
const partialRow = partialPush.json.results[0].serverRow;
check("partial avg = mean of assessed fields (nav 85 + tali 75 -> 80)", partialRow?.avg === 80);
check("partial fisikScore null without physical test", partialRow?.fisikScore === null);

// --- pull: cursor increments, rows come back, delete becomes tombstone ---
console.log("[pull]");
const pull1 = await api("/sync/pull?since=1970-01-01T00:00:00.000Z", { token });
check("pull returns pushed rows", pull1.json.changes.some((c) => c.row.id === caangId) && pull1.json.changes.some((c) => c.row.id === evalId));
check("pull cursor is ISO", !Number.isNaN(Date.parse(pull1.json.cursor)));
const pull2 = await api(`/sync/pull?since=${encodeURIComponent(pull1.json.cursor)}`, { token });
check("second pull empty (no new rows)", pull2.json.changes.length === 0);

const del = await api("/sync/push", {
  method: "POST", token,
  body: { deviceId: "smoke-device", changes: [{ table: "weekly_evals", op: "delete", row: { id: evalId, updatedAt: nowIso() } }] },
});
check("delete accepted", del.json.results[0].status === "accepted" && del.json.results[0].serverRow.deletedAt !== null);
const pull3 = await api(`/sync/pull?since=${encodeURIComponent(pull2.json.cursor)}`, { token });
check("tombstone arrives as op=delete", pull3.json.changes.some((c) => c.table === "weekly_evals" && c.op === "delete" && c.row.id === evalId));

// --- browse endpoints ---
console.log("[browse]");
const list = await api(`/caang?q=Smoke`, { token });
check("caang list + partial-week stats (1 eval, avg 80, Lulus)", list.status === 200 && list.json.some((c) => c.id === caangId && c.evalCount === 1 && c.totalAvg === 80 && c.status === "Lulus Standar"));


// --- clock skew: a device with a slow clock must still reach other devices ---
// Pull cursors are server-stamped syncedAt, so a row pushed with an OLD client
// updatedAt (phone clock behind) is still delivered after the cursor.
console.log('[clock skew]');
const skewId = uuid();
const skewPush = await api('/sync/push', {
  method: 'POST', token,
  body: { deviceId: 'skewed-phone', changes: [{ table: 'caang', op: 'create', row: { id: skewId, npm: '2099097', nama: 'Skewed Clock', fakultas: 'F', prodi: 'P', angkatan: '99', updatedAt: '2020-01-01T00:00:00.000Z' } }] },
});
check('skewed push accepted', skewPush.json.results[0].status === 'accepted');
const pullSkew = await api(`/sync/pull?since=${encodeURIComponent(pull3.json.cursor)}`, { token });
check('row with 2020 timestamp delivered after cursor', pullSkew.json.changes.some((c) => c.row.id === skewId));

// --- delete wins by arrival: a slow-clock device cannot hide a row ---
console.log("[delete wins]");
const delOld = await api("/sync/push", { method: "POST", token, body: { deviceId: "slow-clock-device", changes: [{ table: "stage_evals", op: "delete", row: { id: stageId, updatedAt: "2019-01-01T00:00:00.000Z" } }] } });
check("delete with 2019 timestamp accepted", delOld.json.results[0].status === "accepted" && delOld.json.results[0].serverRow.deletedAt !== null);

// --- user center: admin CRUD + role guard ---
console.log("[users]");
const usersDenied = await api("/users", { token: mentorLogin.json.accessToken });
check("mentor blocked from /users (403)", usersDenied.status === 403);
const created = await api("/users", {
  method: "POST", token,
  body: { username: "smoke.user", displayName: "Smoke User", password: "password123", role: "mentor" },
});
check("admin creates user", created.status === 200 && created.json.username === "smoke.user");
const dupe = await api("/users", {
  method: "POST", token,
  body: { username: "smoke.user", displayName: "Dup", password: "password123" },
});
check("duplicate username rejected (409)", dupe.status === 409);
const asMentor = await api("/auth/login", { method: "POST", body: { username: "smoke.user", password: "password123" } });
check("new user can login", asMentor.status === 200 && asMentor.json.profile.role === "mentor");
const patched = await api(`/users/${created.json.id}`, { method: "PATCH", token, body: { isActive: false } });
check("deactivate user", patched.status === 200 && patched.json.isActive === false);
const deact = await api("/auth/login", { method: "POST", body: { username: "smoke.user", password: "password123" } });
check("deactivated user cannot login", deact.status === 401);
const delUser = await api(`/users/${created.json.id}`, { method: "DELETE", token });
check("delete user", delUser.status === 200);
const selfDel = await api(`/users/${login.json.profile.id}`, { method: "DELETE", token });
check("self-delete rejected", selfDel.status === 400);

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
