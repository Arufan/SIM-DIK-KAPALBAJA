// Scoring rules — kept byte-for-byte in sync with api/src/lib/scoring.js
// (ported verbatim from the original SIM-DIK site). If one changes, change both.
// The server recomputes these on every push; the client computes them only to
// render instantly while offline.

export const round1 = (n) => Math.round(n * 10) / 10;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

export const fieldAvg = (teori, praktik) => Math.round((teori + praktik) / 2);

export function fisikScore(lari, pushUp, pullUp) {
  const sLari = clamp((20 - lari) * 10, 0, 100);
  const sPush = clamp((pushUp / 35) * 100, 0, 100);
  const sPull = clamp((pullUp / 12) * 100, 0, 100);
  return Math.round((sLari + sPush + sPull) / 3);
}

export function weeklyTotal(ev) {
  const parts = [
    fieldAvg(ev.navdarT, ev.navdarP),
    fieldAvg(ev.taliT, ev.taliP),
    fieldAvg(ev.ppgdT, ev.ppgdP),
    fieldAvg(ev.survivalT, ev.survivalP),
    fieldAvg(ev.buddy, ev.team),
    ev.fisikScore,
  ];
  return round1(parts.reduce((a, b) => a + b, 0) / parts.length);
}

export function stageTotal(ev) {
  const parts = [
    fieldAvg(ev.navdarT, ev.navdarP),
    fieldAvg(ev.taliT, ev.taliP),
    fieldAvg(ev.ppgdT, ev.ppgdP),
    fieldAvg(ev.survivalT, ev.survivalP),
    fieldAvg(ev.mppT, ev.mppP),
  ];
  return round1(parts.reduce((a, b) => a + b, 0) / parts.length);
}

// getCaangOverallStats from the original: per-field mean across weekly logs.
export function overallStats(weeklyEvals) {
  if (weeklyEvals.length === 0) {
    return { nav: 0, tali: 0, ppgd: 0, surv: 0, team: 0, fisik: 0, totalAvg: 0, status: "Aktif Proses Pembinaan", count: 0 };
  }
  const acc = { nav: [], tali: [], ppgd: [], surv: [], team: [], fisik: [] };
  for (const ev of weeklyEvals) {
    if (ev.fisikScore == null) {
      ev = { ...ev, fisikScore: fisikScore(ev.runMin, ev.pushUp, ev.pullUp) };
    }
    acc.nav.push(fieldAvg(ev.navdarT, ev.navdarP));
    acc.tali.push(fieldAvg(ev.taliT, ev.taliP));
    acc.ppgd.push(fieldAvg(ev.ppgdT, ev.ppgdP));
    acc.surv.push(fieldAvg(ev.survivalT, ev.survivalP));
    acc.team.push(fieldAvg(ev.buddy, ev.team));
    acc.fisik.push(ev.fisikScore);
  }
  const mean = (a) => Math.round(a.reduce((x, y) => x + y, 0) / a.length);
  const nav = mean(acc.nav), tali = mean(acc.tali), ppgd = mean(acc.ppgd), surv = mean(acc.surv), team = mean(acc.team), fisik = mean(acc.fisik);
  const totalAvg = round1((nav + tali + ppgd + surv + team + fisik) / 6);
  let status = "Aktif Proses Pembinaan";
  if (totalAvg >= 80) status = "Lulus Standar";
  else if (totalAvg < 70) status = "Perlu Evaluasi";
  return { nav, tali, ppgd, surv, team, fisik, totalAvg, status, count: weeklyEvals.length };
}

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
