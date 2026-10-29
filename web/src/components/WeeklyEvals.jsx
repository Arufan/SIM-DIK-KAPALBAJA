import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, live } from "../lib/db.js";
import { weeklyTotal, fisikScore } from "../lib/scoring.js";
import { deleteRecord } from "../lib/sync.js";
import { showToast } from "./toast.jsx";

export function downloadCsv(filename, rows) {
  const csv = rows.map((r) => r.map((v) => `"${String(v ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: filename });
  a.click();
  URL.revokeObjectURL(a.href);
}

const HEAD = ["No", "Nama Caang", "Minggu", "Tanggal", "Navdar", "Tali", "PPGD", "Survival", "Team & Buddy", "Fisik (L/P/P)", "Rata-Rata", "Catatan Mentor"];

export default function WeeklyEvals({ openModal }) {
  const [q, setQ] = useState("");
  const [week, setWeek] = useState("");
  const evals = useLiveQuery(() => live("weekly_evals"), [], []);
  const caang = useLiveQuery(() => live("caang"), [], []);

  const byId = useMemo(() => Object.fromEntries(caang.map((c) => [c.id, c])), [caang]);
  const rows = useMemo(
    () =>
      evals
        .map((e) => ({ e, c: byId[e.caangId] }))
        .filter(({ e, c }) => c && (!q || c.nama.toLowerCase().includes(q.toLowerCase())) && (!week || e.weekNo === Number(week)))
        .sort((a, b) => (a.c.nama + a.e.weekNo).localeCompare(b.c.nama + b.e.weekNo)),
    [evals, byId, q, week],
  );

  const csvRows = [
    HEAD,
    ...rows.map(({ e, c }, i) => [
      i + 1, c.nama, `Minggu ${e.weekNo}`, e.tanggal,
      `${e.navdarT}/${e.navdarP}`, `${e.taliT}/${e.taliP}`, `${e.ppgdT}/${e.ppgdP}`, `${e.survivalT}/${e.survivalP}`,
      e.buddy, `${e.runMin}m/${e.pushUp}p/${e.pullUp}p`, e.avg ?? weeklyTotal(e), e.catatan ?? "",
    ]),
  ];

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-md border border-forest-950/10 shadow-sm p-5 flex flex-wrap items-center gap-3">
        <div>
          <h2 className="font-bold text-slate-800">📝 Form Penilaian Mentor Mingguan (Minggu 1 – 14)</h2>
          <p className="text-xs text-slate-400">Kelola dan perbarui catatan penilaian evaluasi berkala calon anggota.</p>
        </div>
        <div className="ml-auto flex gap-2">
          <button onClick={() => downloadCsv("evaluasi-mingguan.csv", csvRows)} className="rounded-lg bg-forest-950 text-kuning label-mono px-4 py-2.5 hover:bg-slate-700">
            📄 Ekspor CSV
          </button>
          <button onClick={() => openModal({ type: "eval" })} className="rounded-lg bg-kuning text-forest-950 label-mono px-4 py-2.5 hover:brightness-95">
            + Tambah Penilaian Baru
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari nama Caang..."
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-emerald-600"
        />
        <select value={week} onChange={(e) => setWeek(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
          <option value="">Semua Minggu (1 - 14)</option>
          {Array.from({ length: 14 }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>Minggu {n}</option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-md border border-forest-950/10 shadow-sm overflow-x-auto thin-scroll">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-slate-500 bg-forest-950 text-kuning">
              <th className="py-3 px-3">No</th>
              <th className="py-3 px-3">Nama Caang</th>
              <th className="py-3 px-3">Minggu</th>
              <th className="py-3 px-3">Tanggal</th>
              <th className="py-3 px-3">Navdar</th>
              <th className="py-3 px-3">Tali</th>
              <th className="py-3 px-3">PPGD</th>
              <th className="py-3 px-3">Survival</th>
              <th className="py-3 px-3">Team & Buddy</th>
              <th className="py-3 px-3">Fisik (L/P/P)</th>
              <th className="py-3 px-3">Rata-Rata</th>
              <th className="py-3 px-3">Catatan Mentor</th>
              <th className="py-3 px-3">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={13} className="py-8 text-center text-slate-400">Belum ada penilaian. Klik "+ Tambah Penilaian Baru".</td></tr>
            )}
            {rows.map(({ e, c }, i) => (
              <tr key={e.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="py-2.5 px-3 text-slate-400">{i + 1}</td>
                <td className="py-2.5 px-3 font-semibold text-slate-800">{c.nama}</td>
                <td className="py-2.5 px-3 font-semibold text-forest-700">Minggu {e.weekNo}</td>
                <td className="py-2.5 px-3 text-slate-500">{e.tanggal}</td>
                <td className="py-2.5 px-3">{e.navdarT}/{e.navdarP}</td>
                <td className="py-2.5 px-3">{e.taliT}/{e.taliP}</td>
                <td className="py-2.5 px-3">{e.ppgdT}/{e.ppgdP}</td>
                <td className="py-2.5 px-3">{e.survivalT}/{e.survivalP}</td>
                <td className="py-2.5 px-3">{e.buddy}/{e.team}</td>
                <td className="py-2.5 px-3">{e.runMin}m/{e.pushUp}p/{e.pullUp}p</td>
                <td className="py-2.5 px-3 font-bold text-forest-700">{e.avg ?? weeklyTotal(e)}</td>
                <td className="py-2.5 px-3 text-slate-500 max-w-[180px] truncate" title={e.catatan}>{e.catatan}</td>
                <td className="py-2.5 px-3 whitespace-nowrap">
                  <button onClick={() => openModal({ type: "eval", edit: e })} className="mr-1" title="Edit">✏️</button>
                  <button
                    onClick={async () => { if (confirm(`Hapus penilaian ${c.nama} Minggu ${e.weekNo}?`)) { await deleteRecord("weekly_evals", e.id); showToast("Penilaian dihapus"); } }}
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
