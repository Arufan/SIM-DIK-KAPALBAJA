import { useMemo, useRef } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, live } from "../lib/db.js";
import { overallStats, STATUS_STYLES, STAGE_LULUS_THRESHOLD } from "../lib/scoring.js";
import { downloadCsv } from "./WeeklyEvals.jsx";
import { exportHtmlToPdf, escapeHtml } from "../lib/exportPdf.js";
import { showToast } from "./toast.jsx";

// Pure inline-styled rapor node — html2canvas (bundled in html2pdf) cannot
// parse Tailwind v4's oklch() colors, so PDF builders must use hex only.
function buildRaporNode(caang, stats, stageRow) {
  const stages = [
    ["uji_kampus", "Uji Kompetensi Kampus"],
    ["diksar", "Diksar Penjelajah"],
    ["diklat", "Diklat Penjelajah"],
  ];
  const row = (label, v, bg = "#ffffff") =>
    `<tr style="background:${bg}">
      <td style="border:1px solid #cbd5e1;padding:6px 10px">${label}</td>
      <td style="border:1px solid #cbd5e1;padding:6px 10px;text-align:center;font-weight:700">${stats.count ? v : "-"}</td>
    </tr>`;
  const node = document.createElement("div");
  node.innerHTML = `
    <div style="text-align:center;margin-bottom:14px">
      <div style="font-family:'Saira Variable',Arial,sans-serif;font-weight:700;font-size:18px;color:#071c14;letter-spacing:0.04em">UKM KAPAL BAJA</div>
      <div style="font-size:10px;color:#657168;letter-spacing:0.06em">KELUARGA PENJELAJAH ALAM UNIVERSITAS BHAYANGKARA JAKARTA RAYA</div>
      <div style="display:inline-block;margin-top:8px;padding:4px 14px;background:#fdf6d8;border:1px solid #f4d52f;font-size:11px;font-weight:700;color:#071c14;letter-spacing:0.08em">RAPOR EVALUASI AKUMULATIF MINGGUAN</div>
    </div>
    <div style="font-size:12px;line-height:1.7;color:#101814;margin-bottom:12px">
      <div>Nama Caang: <b>${escapeHtml(caang?.nama)}</b> &nbsp;·&nbsp; NPM: <b>${escapeHtml(caang?.npm)}</b></div>
      <div>Fakultas / Prodi: <b>${escapeHtml(caang?.fakultas)} / ${escapeHtml(caang?.prodi)}</b></div>
      <div>Angkatan / Mentor: <b>${escapeHtml(caang?.angkatan)} / ${escapeHtml(caang?.mentorNama ?? "-")}</b></div>
    </div>
    <table style="border-collapse:collapse;width:100%;font-size:12px">
      <thead><tr style="background:#f2f1e9">
        <th style="border:1px solid #cbd5e1;padding:6px 10px;text-align:left;font-size:10px;letter-spacing:0.05em">MATERI COMPETENCY MATRIX</th>
        <th style="border:1px solid #cbd5e1;padding:6px 10px;text-align:center;font-size:10px;letter-spacing:0.05em">RATA-RATA SKOR</th>
      </tr></thead>
      <tbody>
        ${row("Navigasi Darat", stats.nav)}
        ${row("Tali Menali (Pionering)", stats.tali)}
        ${row("PPGD (Pertolongan Pertama)", stats.ppgd)}
        ${row("Survival", stats.surv)}
        ${row("Body & Buddy System / Team Work", stats.team)}
        ${row("Tes Fisik (Lari 3Km, Push-Up, Pull-Up)", stats.fisik)}
        <tr style="background:#fdf6d8">
          <td style="border:1px solid #cbd5e1;padding:8px 10px;text-align:center;font-weight:800;color:#071c14">SKOR AKUMULATIF AKHIR:</td>
          <td style="border:1px solid #cbd5e1;padding:8px 10px;text-align:center;font-weight:800;color:#1e6943">${stats.count ? stats.totalAvg : "-"}</td>
        </tr>
      </tbody>
    </table>
    <div style="font-size:12px;line-height:1.8;color:#101814;margin-top:12px">
      <div>Status Pembinaan: <b style="color:#1e6943">${stats.status}</b></div>
      <div>Jumlah Evaluasi Terekam: <b>${stats.count} Pertemuan Minggu</b></div>
      ${stages.map(([s, label]) => {
        const r = stageRow(s);
        if (!r) return "";
        const lulus = r.rata >= STAGE_LULUS_THRESHOLD;
        return `<div>${label}: <b>${r.rata}</b> — <span style="color:${lulus ? "#1e6943" : "#b45309"}">${escapeHtml(r.keterangan ?? (lulus ? "Lulus" : "Perlu Perbaikan"))}</span></div>`;
      }).join("")}
    </div>
    <p style="font-size:10px;color:#657168;margin-top:12px">Dicetak ${new Date().toLocaleString("id-ID")} · SIM-DIK KAPALBAJA</p>`;
  return node;
}

/** Rapor Evaluasi Akumulatif — mirrors the original modal, printable via CSS. */
export function RaporModal({ caangId, onClose }) {
  const printRef = useRef(null);  const caang = useLiveQuery(() => db.caang.get(caangId), [], null);
  const evals = useLiveQuery(() => live("weekly_evals"), [], []);
  const stageEvals = useLiveQuery(() => live("stage_evals"), [], []);

  const history = evals.filter((e) => e.caangId === caangId);
  const stats = overallStats(history);
  const stages = stageEvals.filter((e) => e.caangId === caangId);
  const stageRow = (s) => stages.find((e) => e.stage === s);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-start justify-center overflow-y-auto p-4 print:hidden">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl my-6">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-bold text-slate-800">Rapor Evaluasi Akumulatif Caang</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
        </div>
        <div className="p-6">
          <div ref={printRef} className="print-area border border-slate-200 rounded-xl p-6 text-sm">
            <div className="text-center mb-4">
              <p className="font-display font-bold uppercase text-lg text-forest-950">UKM KAPAL BAJA</p>
              <p className="text-[11px] tracking-wide text-slate-500">KELUARGA PENJELAJAH ALAM UNIVERSITAS BHAYANGKARA JAKARTA RAYA</p>
              <p className="mt-2 inline-block rounded bg-kuning/20 px-4 py-1 label-mono text-forest-950 border border-kuning">
                RAPOR EVALUASI AKUMULATIF MINGGUAN
              </p>
            </div>
            <div className="grid grid-cols-2 gap-y-1 mb-4 text-slate-700">
              <p>Nama Caang: <b>{caang?.nama}</b></p>
              <p>NPM: <b>{caang?.npm}</b></p>
              <p>Fakultas / Prodi: <b>{caang?.fakultas} / {caang?.prodi}</b></p>
              <p>Angkatan / Mentor: <b>{caang?.angkatan} / {caang?.mentorNama ?? "-"}</b></p>
            </div>
            <table className="w-full border border-slate-200">
              <thead>
                <tr className="bg-slate-100 text-left text-xs uppercase">
                  <th className="border-b px-3 py-2">Materi Competency Matrix</th>
                  <th className="border-b px-3 py-2 text-center">Rata-Rata Skor</th>
                </tr>
              </thead>
              <tbody>
                {[["Navigasi Darat", stats.nav], ["Tali Menali (Pionering)", stats.tali], ["PPGD (Pertolongan Pertama)", stats.ppgd], ["Survival", stats.surv], ["Body & Buddy System / Team Work", stats.team], ["Tes Fisik (Lari 3Km, Push-Up, Pull-Up)", stats.fisik]].map(([label, v]) => (
                  <tr key={label} className="border-b border-slate-100">
                    <td className="px-3 py-1.5">{label}</td>
                    <td className="px-3 py-1.5 text-center font-semibold">{stats.count ? v : "-"}</td>
                  </tr>
                ))}
                <tr className="bg-kuning/15">
                  <td className="px-3 py-2 text-center font-bold text-emerald-800">SKOR AKUMULATIF AKHIR:</td>
                  <td className="px-3 py-2 text-center font-bold text-forest-700">{stats.count ? stats.totalAvg : "-"}</td>
                </tr>
              </tbody>
            </table>
            <div className="mt-4 space-y-1 text-slate-700">
              <p>Status Pembinaan: <b className="text-forest-700">{stats.status}</b></p>
              <p>Jumlah Evaluasi Terekam: <b>{stats.count} Pertemuan Minggu</b></p>
              {(["uji_kampus", "diksar", "diklat"]).map((s) => {
                const r = stageRow(s);
                return r ? (
                  <p key={s}>
                    {s === "uji_kampus" ? "Uji Kompetensi Kampus" : s === "diksar" ? "Diksar Penjelajah" : "Diklat Penjelajah"}:{" "}
                    <b>{r.rata}</b> — <span className={r.rata >= STAGE_LULUS_THRESHOLD ? "text-emerald-700" : "text-amber-700"}>{r.keterangan ?? (r.rata >= STAGE_LULUS_THRESHOLD ? "Lulus" : "Perlu Perbaikan")}</span>
                  </p>
                ) : null;
              })}
            </div>
          </div>
          <div className="mt-5 flex justify-end gap-2 print:hidden">
            <button
              onClick={async () => {
                try {
                  showToast("Membuat PDF…");
                  await exportHtmlToPdf(buildRaporNode(caang, stats, stageRow), `rapor-${caang?.nama ?? "caang"}.pdf`);
                  showToast("PDF tersimpan");
                } catch (e) {
                  showToast("Gagal membuat PDF: " + (e?.message ?? "coba lagi"), "error");
                }
              }}
              className="rounded-sm bg-kuning px-4 py-2.5 label-mono text-forest-950 hover:brightness-95"
            >📕 Simpan PDF</button>
            <button onClick={() => window.print()} className="rounded-sm bg-forest-950 px-4 py-2.5 label-mono text-kuning hover:brightness-125">🖨️ Cetak</button>
            <button onClick={onClose} className="rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-200">Tutup</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Stage rapor — matches the official "Rapor Tahapan" layout
// (Teori/Praktik/Rata-Rata per competency, cumulative score, signatures).
const STAGE_RAPOR = {
  uji_kampus: {
    title: "RAPOR EVALUASI UJI KOMPETENSI DI KAMPUS",
    hasil: "Lulus Standar – Dilanjutkan ke Tahap DIKSAR Penjelajah",
    catatan: "Direkomendasikan melanjutkan ke Pendidikan Dasar Lapangan (DIKSAR).",
  },
  diksar: {
    title: "RAPOR EVALUASI DIKSAR PENJELAJAH",
    hasil: "Lulus Standar – Dilanjutkan ke Tahap DIKLAT Penjelajah",
    catatan: "Direkomendasikan melanjutkan ke Pendidikan Latihan (DIKLAT).",
  },
  diklat: {
    title: "RAPOR EVALUASI DIKLAT PENJELAJAH",
    hasil: "Lulus Standar – Dinyatakan Menjadi Anggota Muda KAPALBAJA dan Mendapatkan Hak Sesuai AD/ART KAPALBAJA",
    catatan: "Direkomendasikan menjadi Anggota Muda KAPALBAJA.",
  },
};

const KOMPETENSI_ROWS = [
  ["Navigasi Darat", "navdarT", "navdarP"],
  ["Tali Menali", "taliT", "taliP"],
  ["PPGD", "ppgdT", "ppgdP"],
  ["Survival", "survivalT", "survivalP"],
  ["MPP (Manajemen Perencanaan)", "mppT", "mppP"],
];

function stageRaporHtml(evalRow, caang) {
  const meta = STAGE_RAPOR[evalRow.stage] ?? STAGE_RAPOR.uji_kampus;
  const rows = KOMPETENSI_ROWS.map(([label, tKey, pKey], i) => {
    const t = evalRow[tKey], p = evalRow[pKey];
    const rata = Math.round((t + p) / 2);
    return `<tr style="background:${i % 2 ? "#f8fafc" : "#ffffff"}">
      <td style="border:1px solid #e2e8f0;padding:7px 10px">${label}</td>
      <td style="border:1px solid #e2e8f0;padding:7px 10px;text-align:center">${t}</td>
      <td style="border:1px solid #e2e8f0;padding:7px 10px;text-align:center">${p}</td>
      <td style="border:1px solid #e2e8f0;padding:7px 10px;text-align:center;font-weight:700">${rata}</td>
    </tr>`;
  }).join("");
  const total = evalRow.rata;
  return `
    <div style="text-align:center;margin-bottom:10px">
      <div style="font-family:'Saira Variable',Arial,sans-serif;font-weight:700;font-size:18px;color:#0b2b1e;letter-spacing:0.05em">UKM KAPAL BAJA</div>
      <div style="font-size:9.5px;color:#657168;letter-spacing:0.06em">KELUARGA PENJELAJAH ALAM UNIVERSITAS BHAYANGKARA JAKARTA RAYA</div>
    </div>
    <div style="border:1px solid #cdebd8;background:#eef9f2;color:#14532d;font-weight:700;font-size:13px;text-align:center;padding:9px 10px;margin:12px 0;letter-spacing:0.02em">${meta.title}</div>
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:12px 0" />
    <table style="width:100%;font-size:12px;margin-bottom:10px">
      <tr>
        <td style="padding:2px 0"><b>Nama Caang: ${escapeHtml(caang?.nama)}</b></td>
        <td style="padding:2px 0;text-align:right"><b>NPM: ${escapeHtml(caang?.npm)}</b></td>
      </tr>
      <tr>
        <td style="padding:2px 0"><b>Fakultas / Prodi:</b> ${escapeHtml(caang?.fakultas)} / ${escapeHtml(caang?.prodi)}</td>
        <td style="padding:2px 0;text-align:right"><b>Angkatan / Tgl:</b> ${escapeHtml(caang?.angkatan)} / ${escapeHtml(evalRow.tanggal)}</td>
      </tr>
    </table>
    <table style="border-collapse:collapse;width:100%;font-size:12px">
      <thead><tr style="background:#f2f1e9">
        <th style="border:1px solid #e2e8f0;padding:8px 10px;text-align:left;font-size:11px">Materi Kompetensi</th>
        <th style="border:1px solid #e2e8f0;padding:8px 10px;text-align:center;font-size:11px">Teori</th>
        <th style="border:1px solid #e2e8f0;padding:8px 10px;text-align:center;font-size:11px">Praktik</th>
        <th style="border:1px solid #e2e8f0;padding:8px 10px;text-align:center;font-size:11px">Rata-Rata</th>
      </tr></thead>
      <tbody>
        ${rows}
        <tr style="background:#eef9f2">
          <td colspan="3" style="border:1px solid #e2e8f0;padding:9px 10px;text-align:right;font-weight:800;color:#14532d">NILAI AKHIR KUMULATIF:</td>
          <td style="border:1px solid #e2e8f0;padding:9px 10px;text-align:center;font-weight:800;color:#1e6943;font-size:14px">${total}</td>
        </tr>
      </tbody>
    </table>
    <div style="border:1px solid #e2e8f0;border-radius:6px;padding:10px 12px;margin-top:12px;font-size:12px;line-height:1.7">
      <div><b style="color:#14532d">Keterangan Hasil: ${meta.hasil}</b></div>
      <div><b>Catatan Penguji:</b> <i>${escapeHtml(evalRow.keterangan || meta.catatan)}</i></div>
    </div>
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0 10px" />
    <table style="width:100%;font-size:11px;text-align:center">
      <tr>
        <td style="width:33%;padding:4px"><b>Penguji / Evaluator</b></td>
        <td style="width:33%;padding:4px"><b>Ketua Umum KAPALBAJA</b></td>
        <td style="width:33%;padding:4px"><b>Pembimbing / Pembina</b></td>
      </tr>
      <tr><td style="padding:26px 4px 4px"></td><td></td><td></td></tr>
      <tr>
        <td style="padding:2px"><b style="text-decoration:underline">${escapeHtml(evalRow.penguji)}</b><br/><span style="color:#657168">Tim Evaluator KAPALBAJA</span></td>
        <td style="padding:2px"><b style="text-decoration:underline">Kapten Pratama</b><br/><span style="color:#657168">NPM. 2020011099</span></td>
        <td style="padding:2px"><b style="text-decoration:underline">Dr. Ir. Heru Prasetyo, M.T.</b><br/><span style="color:#657168">NIDN. 0412087501</span></td>
      </tr>
    </table><div style="height:10px"></div>`;
}

export function StageRaporModal({ evalId, onClose }) {
  const stageEval = useLiveQuery(() => db.stage_evals.get(evalId), [evalId], null);
  const caang = useLiveQuery(() => (stageEval ? db.caang.get(stageEval.caangId) : null), [stageEval?.caangId], null);
  const meta = stageEval ? STAGE_RAPOR[stageEval.stage] ?? STAGE_RAPOR.uji_kampus : null;
  const rows = stageEval
    ? KOMPETENSI_ROWS.map(([label, tKey, pKey]) => ({ label, t: stageEval[tKey], p: stageEval[pKey], rata: Math.round((stageEval[tKey] + stageEval[pKey]) / 2) }))
    : [];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-start justify-center overflow-y-auto p-4 print:hidden">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl my-6">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-bold text-slate-800">Rapor Tahapan</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">×</button>
        </div>
        <div className="p-6">
          <div className="print-area border border-slate-200 rounded-xl p-6 text-sm">
            <div className="text-center mb-3">
              <p className="font-display font-bold uppercase text-lg text-forest-900">UKM KAPAL BAJA</p>
              <p className="text-[10px] tracking-wide text-sage">KELUARGA PENJELAJAH ALAM UNIVERSITAS BHAYANGKARA JAKARTA RAYA</p>
            </div>
            <div className="rounded-sm bg-emerald-50 border border-emerald-200 text-center py-2.5 px-3 font-bold text-emerald-900 text-sm mb-3">
              {meta?.title}
            </div>
            <hr className="border-slate-200 my-3" />
            <div className="grid grid-cols-2 gap-y-1 text-slate-700 text-sm mb-3">
              <p>Nama Caang: <b>{caang?.nama}</b></p>
              <p className="text-right">NPM: <b>{caang?.npm}</b></p>
              <p>Fakultas / Prodi: <b>{caang?.fakultas} / {caang?.prodi}</b></p>
              <p className="text-right">Angkatan / Tgl: <b>{caang?.angkatan} / {stageEval?.tanggal}</b></p>
            </div>
            <table className="w-full border border-slate-200 text-sm">
              <thead>
                <tr className="bg-paper-2 text-left">
                  <th className="border border-slate-200 px-3 py-2">Materi Kompetensi</th>
                  <th className="border border-slate-200 px-3 py-2 text-center">Teori</th>
                  <th className="border border-slate-200 px-3 py-2 text-center">Praktik</th>
                  <th className="border border-slate-200 px-3 py-2 text-center">Rata-Rata</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.label}>
                    <td className="border border-slate-200 px-3 py-1.5">{r.label}</td>
                    <td className="border border-slate-200 px-3 py-1.5 text-center">{r.t}</td>
                    <td className="border border-slate-200 px-3 py-1.5 text-center">{r.p}</td>
                    <td className="border border-slate-200 px-3 py-1.5 text-center font-bold">{r.rata}</td>
                  </tr>
                ))}
                <tr className="bg-emerald-50">
                  <td colSpan={3} className="border border-slate-200 px-3 py-2 text-right font-bold text-emerald-900">NILAI AKHIR KUMULATIF:</td>
                  <td className="border border-slate-200 px-3 py-2 text-center font-bold text-emerald-700 text-base">{stageEval?.rata}</td>
                </tr>
              </tbody>
            </table>
            <div className="mt-3 rounded-lg border border-slate-200 p-3 text-sm leading-relaxed">
              <p className="text-emerald-900 font-semibold">Keterangan Hasil: {meta?.hasil}</p>
              <p className="text-slate-700"><b>Catatan Penguji:</b> <i>{stageEval?.keterangan || meta?.catatan}</i></p>
            </div>
            <hr className="border-slate-200 my-4" />
            <div className="grid grid-cols-3 text-center text-xs gap-2">
              <div><p className="font-bold">Penguji / Evaluator</p><p className="mt-8 font-bold underline">{stageEval?.penguji}</p><p className="text-sage">Tim Evaluator KAPALBAJA</p></div>
              <div><p className="font-bold">Ketua Umum KAPALBAJA</p><p className="mt-8 font-bold underline">Kapten Pratama</p><p className="text-sage">NPM. 2020011099</p></div>
              <div><p className="font-bold">Pembimbing / Pembina</p><p className="mt-8 font-bold underline">Dr. Ir. Heru Prasetyo, M.T.</p><p className="text-sage">NIDN. 0412087501</p></div>
            </div>
          </div>
          <div className="mt-5 flex justify-end gap-2 print:hidden">
            <button
              onClick={async () => {
                try {
                  if (!stageEval || !caang) return;
                  showToast("Membuat PDF…");
                  const node = document.createElement("div");
                  node.innerHTML = stageRaporHtml(stageEval, caang);
                  await exportHtmlToPdf(node, `Rapor_Tahapan_KAPALBAJA_${stageEval.tanggal}.pdf`);
                  showToast("PDF tersimpan");
                } catch (e) {
                  showToast("Gagal membuat PDF: " + (e?.message ?? "coba lagi"), "error");
                }
              }}
              className="rounded-sm bg-kuning px-4 py-2.5 label-mono text-forest-950 hover:brightness-95"
            >📕 Simpan PDF</button>
            <button onClick={() => window.print()} className="rounded-sm bg-forest-950 px-4 py-2.5 label-mono text-kuning hover:brightness-125">🖨️ Cetak</button>
            <button onClick={onClose} className="rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-200">Tutup</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Ranking({ openModal }) {
  const caang = useLiveQuery(() => live("caang"), [], []);
  const evals = useLiveQuery(() => live("weekly_evals"), [], []);

  const ranked = useMemo(
    () =>
      caang
        .map((c) => ({ c, stats: overallStats(evals.filter((e) => e.caangId === c.id)) }))
        .sort((a, b) => b.stats.totalAvg - a.stats.totalAvg),
    [caang, evals],
  );

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-md border border-forest-950/10 shadow-sm p-5 flex flex-wrap items-center gap-3">
        <div>
          <h2 className="font-bold text-slate-800">🏆 Papan Ranking Standar Caang KAPALBAJA</h2>
          <p className="text-xs text-slate-400">Peringkat dihitung otomatis berdasarkan akumulasi rata-rata evaluasi mingguan.</p>
        </div>
        <button
          onClick={() =>
            downloadCsv(
              "ranking-standar.csv",
              [["Rank", "NPM", "Nama", "Fakultas", "Prodi", "Navdar", "Tali", "PPGD", "Survival", "Buddy/Team", "Fisik", "Skor Total", "Status"],
                ...ranked.map((r, i) => [i + 1, r.c.npm, r.c.nama, r.c.fakultas, r.c.prodi, r.stats.nav, r.stats.tali, r.stats.ppgd, r.stats.surv, r.stats.team, r.stats.fisik, r.stats.totalAvg, r.stats.status])],
            )
          }
          className="ml-auto rounded-sm bg-forest-950 text-kuning label-mono px-3 sm:px-4 py-2.5 hover:brightness-125"
        >
          📄 Ekspor CSV
        </button>
      </div>

      {/* mobile: ranked cards */}
      <div className="md:hidden space-y-3">
        {ranked.length === 0 && (
          <div className="bg-white rounded-md border border-forest-950/10 p-6 text-center text-sm text-sage">Belum ada calon anggota.</div>
        )}
        {ranked.map((r, i) => (
          <div key={r.c.id} className="bg-white rounded-md border border-forest-950/10 shadow-sm p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center font-display font-bold text-sm shrink-0 ${i === 0 ? "bg-kuning text-forest-950" : i === 1 ? "bg-forest-950 text-white" : i === 2 ? "bg-forest-700 text-white" : "bg-paper-2 text-sage"}`}>
              {i + 1}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-ink truncate">{r.c.nama}</p>
              <p className="text-xs text-sage truncate">{r.c.fakultas} - {r.c.prodi}</p>
              <span className={`inline-block mt-1 rounded-sm px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLES[r.stats.status]}`}>{r.stats.status}</span>
            </div>
            <div className="text-right shrink-0">
              <p className="font-display font-bold text-2xl text-forest-700 leading-none">{r.stats.count ? r.stats.totalAvg : "-"}</p>
              <button
                onClick={() => { if (r.stats.count === 0) { showToast("Belum ada evaluasi untuk rapor", "error"); return; } openModal({ type: "rapor", caangId: r.c.id }); }}
                className="mt-1.5 rounded-sm bg-forest-950 text-kuning label-mono px-2.5 py-1.5 border border-kuning/40"
              >📕 Rapor</button>
            </div>
          </div>
        ))}
      </div>

      <div className="hidden md:block bg-white rounded-md border border-forest-950/10 shadow-sm overflow-x-auto thin-scroll">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-white bg-forest-950">
              <th className="py-3 px-3">Rank</th>
              <th className="py-3 px-3">NPM</th>
              <th className="py-3 px-3">Nama & Fakultas/Prodi</th>
              <th className="py-3 px-3">Navdar</th>
              <th className="py-3 px-3">Tali</th>
              <th className="py-3 px-3">PPGD</th>
              <th className="py-3 px-3">Survival</th>
              <th className="py-3 px-3">Buddy/Team</th>
              <th className="py-3 px-3">Fisik</th>
              <th className="py-3 px-3">Skor Total</th>
              <th className="py-3 px-3">Keterangan Result</th>
              <th className="py-3 px-3">Rapor Evaluasi</th>
            </tr>
          </thead>
          <tbody>
            {ranked.length === 0 && (
              <tr><td colSpan={12} className="py-8 text-center text-slate-400">Belum ada calon anggota.</td></tr>
            )}
            {ranked.map((r, i) => (
              <tr key={r.c.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="py-2.5 px-3 font-bold text-slate-500">{i + 1}</td>
                <td className="py-2.5 px-3 text-slate-600">{r.c.npm}</td>
                <td className="py-2.5 px-3">
                  <span className="block font-semibold text-slate-800">{r.c.nama}</span>
                  <span className="block text-xs text-slate-400">{r.c.fakultas} - {r.c.prodi}</span>
                </td>
                <td className="py-2.5 px-3">{r.stats.count ? r.stats.nav : "-"}</td>
                <td className="py-2.5 px-3">{r.stats.count ? r.stats.tali : "-"}</td>
                <td className="py-2.5 px-3">{r.stats.count ? r.stats.ppgd : "-"}</td>
                <td className="py-2.5 px-3">{r.stats.count ? r.stats.surv : "-"}</td>
                <td className="py-2.5 px-3">{r.stats.count ? r.stats.team : "-"}</td>
                <td className="py-2.5 px-3">{r.stats.count ? r.stats.fisik : "-"}</td>
                <td className="py-2.5 px-3 font-bold text-forest-700">{r.stats.count ? r.stats.totalAvg : "-"}</td>
                <td className="py-2.5 px-3">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[r.stats.status]}`}>{r.stats.status}</span>
                </td>
                <td className="py-2.5 px-3">
                  <button
                    onClick={() => { if (r.stats.count === 0) { showToast("Belum ada evaluasi untuk rapor", "error"); return; } openModal({ type: "rapor", caangId: r.c.id }); }}
                    className="rounded-lg bg-forest-950 text-kuning label-mono px-3 py-1.5 hover:brightness-125 border border-kuning/40"
                  >
                    📕 Rapor
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
