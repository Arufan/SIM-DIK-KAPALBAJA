// Shared scoring rules — ported verbatim from the original SIM-DIK inline script
// (calcEvalSummary / calcFisikScore / calcTahapanSummary / getCaangOverallStats).
// Weekly entries are partial: mentors only assess the 2+ materi taught that week,
// so every sub-score may be null — same as the original app's null handling.
//
// Verified against the site's sample data:
//   fisik:  14.5m/35p/12p -> 85   15m/30p/10p -> 73   18m/20p/6p -> 42
//   weekly: Ahmad Mgg1 83+89+80+83+89+85 -> 84.8, Bambang -> 82, Siti -> 68.3

export const round1 = (n) => Math.round(n * 10) / 10;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

/** Original calcSub: Teori/Praktik pair -> one competency score (null-aware). */
export function fieldAvg(teori, praktik) {
  if (teori == null && praktik == null) return null;
  if (teori == null) return praktik;
  if (praktik == null) return teori;
  return Math.round((teori + praktik) / 2);
}

/** Original calcFisikScore: lari 3km (menit) + push-up + pull-up -> 0-100, null if none. */
export function fisikScore(lari, pushUp, pullUp) {
  if (lari == null && pushUp == null && pullUp == null) return null;
  const subs = [];
  if (lari != null) subs.push(clamp((20 - lari) * 10, 0, 100));
  if (pushUp != null) subs.push(clamp((pushUp / 35) * 100, 0, 100));
  if (pullUp != null) subs.push(clamp((pullUp / 12) * 100, 0, 100));
  return Math.round(subs.reduce((a, b) => a + b, 0) / subs.length);
}

/** Original calcEvalSummary: mean of the non-null competency scores, 1 decimal. */
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

/** Original calcTahapanSummary: stage exam average (all T/P fields required), 1 decimal. */
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

/** Original getCaangOverallStats: per-field means over weeks where the field was assessed. */
export function caangStats(weeklyEvals) {
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
  const present = [nav, tali, ppgd, surv, team, fisik].filter((v, i) => [acc.nav, acc.tali, acc.ppgd, acc.surv, acc.team, acc.fisik][i].length > 0);
  const totalAvg = present.length ? round1(present.reduce((a, b) => a + b, 0) / present.length) : 0;
  let status = "Aktif Proses Pembinaan";
  if (totalAvg >= 80) status = "Lulus Standar";
  else if (totalAvg > 0 && totalAvg < 70) status = "Perlu Evaluasi";
  return { nav, tali, ppgd, surv, team, fisik, totalAvg, status, count: weeklyEvals.length };
}

/** Stage exams: original isLulus threshold (calcTahapanSummary). */
export const STAGE_LULUS_THRESHOLD = 75;