// Scoring rules — kept in sync with api/src/lib/scoring.js (ported verbatim
// from the original SIM-DIK site). Weekly entries are PARTIAL by design:
// mentors assess only the ~2 materi taught that week, so sub-scores may be null.
// If one changes, change both files.

export const round1 = (n) => Math.round(n * 10) / 10;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

/** Original calcSub: Teori/Praktik pair -> one competency score (null-aware). */
export function fieldAvg(teori, praktik) {
  if (teori == null && praktik == null) return null;
  if (teori == null) return praktik;
  if (praktik == null) return teori;
  return Math.round((teori + praktik) / 2);
}

export function fisikScore(lari, pushUp, pullUp) {
  if (lari == null && pushUp == null && pullUp == null) return null;
  const subs = [];
  if (lari != null) subs.push(clamp((20 - lari) * 10, 0, 100));
  if (pushUp != null) subs.push(clamp((pushUp / 35) * 100, 0, 100));
  if (pullUp != null) subs.push(clamp((pullUp / 12) * 100, 0, 100));
  return Math.round(subs.reduce((a, b) => a + b, 0) / subs.length);
}

export function weeklyTotal(ev) {
  const fisik = ev.fisikScore ?? fisikScore(ev.runMin, ev.pushUp, ev.pullUp);
  const parts = [
    fieldAvg(ev.navdarT, ev.navdarP),
    fieldAvg(ev.taliT, ev.taliP),
    fieldAvg(ev.ppgdT, ev.ppgdP),
    fieldAvg(ev.survivalT, ev.survivalP),
    fieldAvg(ev.buddy, ev.team),
    fisik,
  ].filter((v) => v != null);
  return parts.length ? round1(parts.reduce((a, b) => a + b, 0) / parts.length) : null;
}

export function stageTotal(ev) {
  const parts = [
    fieldAvg(ev.navdarT, ev.navdarP),
    fieldAvg(ev.taliT, ev.taliP),
    fieldAvg(ev.ppgdT, ev.ppgdP),
    fieldAvg(ev.survivalT, ev.survivalP),
    fieldAvg(ev.mppT, ev.mppP),
  ].filter((v) => v != null);
  return parts.length ? round1(parts.reduce((a, b) => a + b, 0) / parts.length) : null;
}

// Original getCaangOverallStats — per-field means over weeks where the field
// was assessed; totalAvg averages only the fields that have data.
export function overallStats(weeklyEvals) {
  if (!weeklyEvals || weeklyEvals.length === 0) {
    return { nav: 0, tali: 0, ppgd: 0, surv: 0, team: 0, fisik: 0, totalAvg: 0, status: "Aktif Proses Pembinaan", count: 0 };
  }
  const acc = { nav: [], tali: [], ppgd: [], surv: [], team: [], fisik: [] };
  for (const ev of weeklyEvals) {
    const s = {
      nav: fieldAvg(ev.navdarT, ev.navdarP),
      tali: fieldAvg(ev.taliT, ev.taliP),
      ppgd: fieldAvg(ev.ppgdT, ev.ppgdP),
      surv: fieldAvg(ev.survivalT, ev.survivalP),
      team: fieldAvg(ev.buddy, ev.team),
      fisik: ev.fisikScore ?? fisikScore(ev.runMin, ev.pushUp, ev.pullUp),
    };
    for (const k of Object.keys(acc)) if (s[k] != null) acc[k].push(s[k]);
  }
  const mean = (a) => (a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : 0);
  const nav = mean(acc.nav), tali = mean(acc.tali), ppgd = mean(acc.ppgd), surv = mean(acc.surv), team = mean(acc.team), fisik = mean(acc.fisik);
  const keys = ["nav", "tali", "ppgd", "surv", "team", "fisik"];
  const vals = keys.map((k) => mean(acc[k])).filter((v, i) => acc[keys[i]].length > 0);
  const totalAvg = vals.length ? round1(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
  let status = "Aktif Proses Pembinaan";
  if (totalAvg >= 80) status = "Lulus Standar";
  else if (totalAvg > 0 && totalAvg < 70) status = "Perlu Evaluasi";
  return { nav, tali, ppgd, surv, team, fisik, totalAvg, status, count: weeklyEvals.length };
}

/** Display helper: null-aware "T/P" pair. */
export const fmtPair = (t, p) => (t == null && p == null ? "–" : `${t ?? "–"}/${p ?? "–"}`);

export const STAGE_LULUS_THRESHOLD = 75;

export const BIDANG = [
  { key: "nav", label: "Navigasi Darat", short: "Navdar" },
  { key: "tali", label: "Tali Menali (Pionering)", short: "Tali" },
  { key: "ppgd", label: "PPGD (Pertolongan Pertama)", short: "PPGD" },
  { key: "surv", label: "Survival", short: "Survival" },
  { key: "team", label: "Body & Buddy / Team Work", short: "Team" },
  { key: "fisik", label: "Tes Fisik (Lari, Push-Up, Pull-Up)", short: "Fisik" },
];

export const STATUS_STYLES = {
  "Lulus Standar": "bg-emerald-100 text-emerald-700",
  "Perlu Evaluasi": "bg-amber-100 text-amber-700",
  "Aktif Proses Pembinaan": "bg-sky-100 text-sky-700",
};