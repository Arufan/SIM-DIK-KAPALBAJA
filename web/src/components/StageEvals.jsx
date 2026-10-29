import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, live } from "../lib/db.js";
import { stageTotal, STAGE_LULUS_THRESHOLD } from "../lib/scoring.js";
import { deleteRecord } from "../lib/sync.js";
import { showToast } from "./toast.jsx";

const STAGE_META = {
  uji_kampus: { title: "🎓 Penilaian Uji Kompetensi di Kampus", subtitle: "Evaluasi pemahaman teori dan praktik pra-lapangan calon anggota di kampus.", button: "+ Input Uji Kompetensi", accent: "bg-sky-800 hover:bg-sky-700", header: "bg-sky-700" },
  diksar: { title: "✅ Penilaian Evaluasi Diksar Penjelajah", subtitle: "Evaluasi Pendidikan Dasar Lapangan (DIKSAR) calon anggota UKM KAPALBAJA.", button: "+ Input Evaluasi Diksar", accent: "bg-emerald-700 hover:brightness-95", header: "bg-emerald-800" },
  diklat: { title: "⛰️ Penilaian Evaluasi Diklat Penjelajah", subtitle: "Evaluasi Akhir Pendidikan Latihan (DIKLAT) Penetapan Anggota Muda KAPALBAJA.", button: "+ Input Evaluasi Diklat", accent: "bg-forest-950 text-kuning hover:brightness-125", header: "bg-forest-950" },
};

export default function StageEvals({ stage, openModal }) {
  const meta = STAGE_META[stage];
  const evals = useLiveQuery(() => live("stage_evals"), [], []);
  const caang = useLiveQuery(() => live("caang"), [], []);
  const byId = useMemo(() => Object.fromEntries(caang.map((c) => [c.id, c])), [caang]);
  const rows = useMemo(() => evals.filter((e) => e.stage === stage), [evals, stage]);

  const csv = () => {
    const head = ["No", "Nama Caang", "Penguji", "Tanggal", "Navdar", "Tali", "PPGD", "Survival", "MPP", "Rata-Rata", "Keterangan"];
    const body = rows.map((e, i) => [
      i + 1, byId[e.caangId]?.nama ?? "?", e.penguji, e.tanggal,
      `${e.navdarT}/${e.navdarP}`, `${e.taliT}/${e.taliP}`, `${e.ppgdT}/${e.ppgdP}`, `${e.survivalT}/${e.survivalP}`, `${e.mppT}/${e.mppP}`,
      e.rata ?? stageTotal(e), e.keterangan ?? "",
    ]);
    import("./WeeklyEvals.jsx").then((m) => m.downloadCsv(`${stage}.csv`, [head, ...body]));
  };

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-md border border-forest-950/10 shadow-sm p-5 flex flex-wrap items-center gap-3">
        <div>
          <h2 className="font-bold text-slate-800">{meta.title}</h2>
          <p className="text-xs text-slate-400">{meta.subtitle}</p>
        </div>
        <div className="ml-auto flex gap-2">
          <button onClick={csv} className="rounded-lg bg-forest-950 text-kuning label-mono px-4 py-2.5 hover:bg-slate-700">📄 Ekspor CSV</button>
          <button onClick={() => openModal({ type: "stage", stage })} className={`rounded-lg text-white text-sm font-semibold px-4 py-2.5 ${meta.accent}`}>
            {meta.button}
          </button>
        </div>
      </div>

      {/* mobile cards */}
      <div className="md:hidden space-y-3">
        {rows.length === 0 && (
          <div className="bg-white rounded-md border border-forest-950/10 p-6 text-center text-sm text-sage">
            Belum ada penilaian untuk tahapan ini.
          </div>
        )}
        {rows.map((e) => (
          <div key={e.id} className="bg-white rounded-md border border-forest-950/10 shadow-sm p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-bold text-ink truncate">{byId[e.caangId]?.nama ?? "(caang terhapus)"}</p>
                <p className="label-mono text-sage mt-0.5">{e.penguji} · {e.tanggal}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-display font-bold text-2xl text-forest-700 leading-none">{e.rata ?? stageTotal(e)}</p>
                <p className="label-mono text-sage mt-1">Rata-rata</p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-5 gap-1.5 text-center">
              {[["Navdar", e.navdarT, e.navdarP], ["Tali", e.taliT, e.taliP], ["PPGD", e.ppgdT, e.ppgdP], ["Surv", e.survivalT, e.survivalP], ["MPP", e.mppT, e.mppP]].map(([label, a, b]) => (
                <div key={label} className="rounded-sm bg-paper-2 py-1.5">
                  <p className="text-[10px] font-semibold text-sage uppercase">{label}</p>
                  <p className="text-xs font-bold text-ink">{a}/{b}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <span className={`rounded-sm px-2.5 py-1.5 label-mono flex-1 text-center ${e.rata >= STAGE_LULUS_THRESHOLD ? "bg-forest-700/15 text-forest-700" : "bg-amber-100 text-amber-700"}`}>
                {e.keterangan ?? (e.rata >= STAGE_LULUS_THRESHOLD ? "Lulus" : "Perlu Perbaikan")}
              </span>
              <button onClick={() => openModal({ type: "stage", stage, edit: e })} className="rounded-sm border border-forest-950/20 px-3 py-2 label-mono text-forest-900">✏️</button>
              <button
                onClick={async () => { if (confirm("Hapus penilaian tahapan ini?")) { await deleteRecord("stage_evals", e.id); showToast("Penilaian dihapus"); } }}
                className="rounded-sm border border-red-200 bg-red-50 px-3 py-2 label-mono text-red-700"
              >🗑️</button>
            </div>
          </div>
        ))}
      </div>

      <div className="hidden md:block bg-white rounded-md border border-forest-950/10 shadow-sm overflow-x-auto thin-scroll">
        <table className="w-full text-sm min-w-[1000px]">
          <thead>
            <tr className={`text-left text-xs uppercase tracking-wide text-white ${meta.header}`}>
              <th className="py-3 px-3">No</th>
              <th className="py-3 px-3">Nama Caang</th>
              <th className="py-3 px-3">Nama Penguji</th>
              <th className="py-3 px-3">Tanggal</th>
              <th className="py-3 px-3">Navdar (T/P)</th>
              <th className="py-3 px-3">Tali (T/P)</th>
              <th className="py-3 px-3">PPGD (T/P)</th>
              <th className="py-3 px-3">Survival (T/P)</th>
              <th className="py-3 px-3">MPP (T/P)</th>
              <th className="py-3 px-3">Rata-Rata</th>
              <th className="py-3 px-3">Keterangan</th>
              <th className="py-3 px-3">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={12} className="py-8 text-center text-slate-400">Belum ada penilaian untuk tahapan ini.</td></tr>
            )}
            {rows.map((e, i) => (
              <tr key={e.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="py-2.5 px-3 text-slate-400">{i + 1}</td>
                <td className="py-2.5 px-3 font-semibold text-slate-800">{byId[e.caangId]?.nama ?? "(caang terhapus)"}</td>
                <td className="py-2.5 px-3 text-slate-600">{e.penguji}</td>
                <td className="py-2.5 px-3 text-slate-500">{e.tanggal}</td>
                <td className="py-2.5 px-3">{e.navdarT}/{e.navdarP}</td>
                <td className="py-2.5 px-3">{e.taliT}/{e.taliP}</td>
                <td className="py-2.5 px-3">{e.ppgdT}/{e.ppgdP}</td>
                <td className="py-2.5 px-3">{e.survivalT}/{e.survivalP}</td>
                <td className="py-2.5 px-3">{e.mppT}/{e.mppP}</td>
                <td className="py-2.5 px-3 font-bold text-forest-700">{e.rata ?? stageTotal(e)}</td>
                <td className="py-2.5 px-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${e.rata >= STAGE_LULUS_THRESHOLD ? "bg-emerald-100 text-forest-700" : "bg-amber-100 text-amber-700"}`}>
                    {e.keterangan ?? (e.rata >= STAGE_LULUS_THRESHOLD ? "Lulus" : "Perlu Perbaikan")}
                  </span>
                </td>
                <td className="py-2.5 px-3 whitespace-nowrap">
                  <button onClick={() => openModal({ type: "stage", stage, edit: e })} className="mr-1" title="Edit">✏️</button>
                  <button
                    onClick={async () => { if (confirm("Hapus penilaian tahapan ini?")) { await deleteRecord("stage_evals", e.id); showToast("Penilaian dihapus"); } }}
                    title="Hapus"
                  >🗑️</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
