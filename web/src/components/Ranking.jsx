import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, live } from "../lib/db.js";
import { overallStats, STATUS_STYLES, STAGE_LULUS_THRESHOLD } from "../lib/scoring.js";
import { downloadCsv } from "./WeeklyEvals.jsx";
import { showToast } from "./toast.jsx";

/** Rapor Evaluasi Akumulatif — mirrors the original modal, printable via CSS. */
export function RaporModal({ caangId, onClose }) {
  const caang = useLiveQuery(() => db.caang.get(caangId), [], null);
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
          <div className="print-area border border-slate-200 rounded-xl p-6 text-sm">
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
            <button onClick={() => window.print()} className="rounded-lg bg-forest-950 px-4 py-2.5 label-mono text-kuning hover:brightness-125">🖨️ Cetak / Simpan PDF</button>
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
