// Shared scoring rules — ported verbatim from the original SIM-DIK inline script
// (calcEvalSummary / calcFisikScore / calcTahapanSummary / getCaangOverallStats)
// so client and server compute identical numbers.
//
// Verified against the site's sample data:
//   fisik:  14.5m/35p/12p -> 85   15m/30p/10p -> 73   18m/20p/6p -> 42
//   weekly: Ahmad Mgg1 83+89+80+83+89+85 -> 84.8, Bambang -> 82, Siti -> 68.3

export const round1 = (n) => Math.round(n * 10) / 10;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

/**
 * Original calcSub: one competency score from a Teori/Praktik pair
 * (rounded to integer). Inputs are always present in v1.
 */
export const fieldAvg = (teori, praktik) => Math.round((teori + praktik) / 2);

/** Original calcFisikScore: lari 3km (menit) + push-up + pull-up -> 0-100. */
export function fisikScore(lari, pushUp, pullUp) {
  const sLari = clamp((20 - lari) * 10, 0, 100);
  const sPush = clamp((pushUp / 35) * 100, 0, 100);
  const sPull = clamp((pullUp / 12) * 100, 0, 100);
  return Math.round((sLari + sPush + sPull) / 3);
}

/** Original calcEvalSummary: weekly total = mean of the six competency scores, 1 decimal. */
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

/** Original calcTahapanSummary: stage exam (uji kampus/diksar/diklat) average, 1 decimal. */
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

/** Original getCaangOverallStats status line (weekly cumulative). */
export function pembinaanStatus(totalAvg, evalCount) {
  if (evalCount === 0 || totalAvg === 0) return "Aktif Proses Pembinaan";
  if (totalAvg >= 80) return "Lulus Standar";
  if (totalAvg < 70) return "Perlu Evaluasi";
  return "Aktif Proses Pembinaan";
}

/** Stage exams: original isLulus threshold (calcTahapanSummary). */
export const STAGE_LULUS_THRESHOLD = 75;
