import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { RadialLinearScale, CategoryScale, Chart as ChartJS, Filler, Tooltip, RadarController, PointElement, LineElement } from "chart.js";
import { Radar } from "react-chartjs-2";
import { db, live } from "../lib/db.js";
import { overallStats, weeklyTotal, fisikScore, BIDANG, STATUS_STYLES } from "../lib/scoring.js";
import { deleteRecord } from "../lib/sync.js";
import { showToast } from "./toast.jsx";

ChartJS.register(RadialLinearScale, CategoryScale, Tooltip, Filler, RadarController, PointElement, LineElement);

const BAR_COLORS = ["bg-[#1E6943]", "bg-[#0B2B1E]", "bg-[#4E9463]", "bg-[#F4D52F]", "bg-[#657168]", "bg-[#B8912B]"];

export default function Profile({ selectedCaangId, setSelectedCaangId, openModal }) {
  const [q, setQ] = useState("");
  const caang = useLiveQuery(() => live("caang"), [], []);
  const evals = useLiveQuery(() => live("weekly_evals"), [], []);

  const filtered = useMemo(
    () => caang.filter((c) => (c.nama + c.npm + c.prodi).toLowerCase().includes(q.toLowerCase())),
    [caang, q],
  );
  const selected = caang.find((c) => c.id === selectedCaangId) ?? filtered[0] ?? caang[0] ?? null;
  const history = selected ? evals.filter((e) => e.caangId === selected.id).sort((a, b) => a.weekNo - b.weekNo) : [];
  const stats = selected ? overallStats(history) : null;

  const radarData = {
    labels: BIDANG.map((b) => b.short),
    datasets: [{
      label: "Skor",
      data: stats ? BIDANG.map((b) => stats[b.key]) : [],
      backgroundColor: "rgba(244,213,47,0.24)",
      borderColor: "#F4D52F",
      borderWidth: 2,
      pointBackgroundColor: "#F4D52F",
    }],
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      {/* picker */}
      <div className="bg-white rounded-md border border-forest-950/10 shadow-sm p-4 h-fit">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold tracking-wide text-slate-500 uppercase">👥 Pilih Calon Anggota</h2>
          <button onClick={() => openModal({ type: "caang" })} className="text-xs font-semibold text-forest-700 hover:underline">+ Baru</button>
        </div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="🔍 Cari nama, NPM, atau Prodi..."
          className="w-full mb-3 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
        />
        <div className="space-y-2 max-h-72 overflow-y-auto thin-scroll pr-1">
          {filtered.length === 0 && <p className="text-sm text-slate-400 py-4 text-center">Belum ada calon anggota.</p>}
          {filtered.map((c) => {
            const s = overallStats(evals.filter((e) => e.caangId === c.id));
            const active = selected?.id === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setSelectedCaangId(c.id)}
                className={`w-full text-left rounded-lg border px-3 py-2.5 ${active ? "border-kuning bg-kuning/10" : "border-slate-200 hover:bg-slate-50"}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-slate-800">{c.nama}</span>
                  {s.count > 0 && <span className="text-sm font-bold text-forest-700">{s.totalAvg}</span>}
                </div>
                <div className="text-xs text-slate-400">NPM: {c.npm} • {c.prodi}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* detail */}
      {!selected ? (
        <div className="lg:col-span-2 bg-white rounded-md border border-forest-950/10 shadow-sm p-10 text-center text-slate-400 text-sm">
          Pilih atau tambahkan calon anggota untuk melihat skill matrix.
        </div>
      ) : (
        <div className="lg:col-span-2 space-y-5">
          <div className="bg-white rounded-md border border-forest-950/10 shadow-sm p-5">
            <div className="flex flex-wrap items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-forest-950 text-white flex items-center justify-center text-xl font-bold">
                {selected.nama.split(" ").map((w) => w[0]).slice(0, 2).join("")}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-bold text-slate-900">{selected.nama}</h2>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[stats.status]}`}>{stats.status}</span>
                </div>
                <p className="text-sm text-slate-600">NPM: {selected.npm} | Fakultas: {selected.fakultas} | Prodi: {selected.prodi}</p>
                <p className="text-xs text-slate-400">Angkatan Diklat: {selected.angkatan} | Mentor: {selected.mentorNama ?? "-"}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-semibold tracking-wider text-slate-400 uppercase">Skor Kumulatif</p>
                <p className="text-3xl font-bold text-forest-700">{stats.count > 0 ? stats.totalAvg : "-"}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
              <div className="h-56 sm:h-64">
                <h3 className="text-center text-sm font-bold text-slate-700 mb-1">Skill Matrix Radar</h3>
                <Radar
                  data={radarData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: { r: { min: 0, max: 100, ticks: { stepSize: 20, backdropColor: "transparent" } } },
                    plugins: { legend: { display: false } },
                  }}
                />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-700 mb-3">Ringkasan Kompetensi Utama</h3>
                <div className="space-y-3">
                  {BIDANG.map((b, i) => (
                    <div key={b.key}>
                      <div className="flex justify-between text-xs font-medium text-slate-600 mb-1">
                        <span>{b.label}</span>
                        <span>{stats[b.key]}</span>
                      </div>
                      <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                        <div className={`h-full rounded-full ${BAR_COLORS[i]}`} style={{ width: `${stats[b.key]}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-md border border-forest-950/10 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-slate-800">Riwayat Penilaian Mentor Mingguan</h3>
              <button
                onClick={() => openModal({ type: "eval", caangId: selected.id })}
                className="rounded-lg bg-emerald-700 text-white text-xs font-semibold px-3 py-2 hover:brightness-95 bg-kuning text-forest-950"
              >
                + Input Nilai Minggu Ini
              </button>
            </div>
            <div className="overflow-x-auto thin-scroll">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b">
                    <th className="py-2 pr-3">Minggu</th>
                    <th className="py-2 pr-3">Tanggal</th>
                    <th className="py-2 pr-3">Navdar (T/P)</th>
                    <th className="py-2 pr-3">Tali (T/P)</th>
                    <th className="py-2 pr-3">PPGD (T/P)</th>
                    <th className="py-2 pr-3">Survival (T/P)</th>
                    <th className="py-2 pr-3">Buddy/Team</th>
                    <th className="py-2 pr-3">Fisik</th>
                    <th className="py-2 pr-3">Total</th>
                    <th className="py-2 pr-3">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {history.length === 0 && (
                    <tr><td colSpan={10} className="py-6 text-center text-slate-400">Belum ada penilaian mingguan.</td></tr>
                  )}
                  {history.map((e) => (
                    <tr key={e.id} className="border-b border-slate-100">
                      <td className="py-2 pr-3 font-semibold">Mgg {e.weekNo}</td>
                      <td className="py-2 pr-3 text-slate-500">{e.tanggal}</td>
                      <td className="py-2 pr-3">{e.navdarT}/{e.navdarP}</td>
                      <td className="py-2 pr-3">{e.taliT}/{e.taliP}</td>
                      <td className="py-2 pr-3">{e.ppgdT}/{e.ppgdP}</td>
                      <td className="py-2 pr-3">{e.survivalT}/{e.survivalP}</td>
                      <td className="py-2 pr-3">{e.buddy}/{e.team}</td>
                      <td className="py-2 pr-3">{e.fisikScore ?? fisikScore(e.runMin, e.pushUp, e.pullUp)}</td>
                      <td className="py-2 pr-3 font-bold text-forest-700">{e.avg ?? weeklyTotal(e)}</td>
                      <td className="py-2 pr-3 whitespace-nowrap">
                        <button onClick={() => openModal({ type: "eval", edit: e })} className="mr-1" title="Edit">✏️</button>
                        <button
                          onClick={async () => { if (confirm(`Hapus penilaian Mgg ${e.weekNo}?`)) { await deleteRecord("weekly_evals", e.id); showToast("Penilaian dihapus"); } }}
                          title="Hapus"
                        >🗑️</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
