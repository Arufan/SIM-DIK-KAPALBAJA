import { useLiveQuery } from "dexie-react-hooks";
import { BarElement, CategoryScale, Chart as ChartJS, LinearScale, Tooltip } from "chart.js";
import { Bar } from "react-chartjs-2";
import { db, live } from "../lib/db.js";
import { overallStats, BIDANG, STATUS_STYLES } from "../lib/scoring.js";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

const CARD_COLORS = ["text-emerald-600", "bg-emerald-100", "text-amber-600", "bg-amber-100", "text-violet-600", "bg-violet-100"];

function StatCard({ label, value, sub, icon, tone }) {
  return (
    <div className="bg-white rounded-md border border-forest-950/10 shadow-sm p-4 flex items-start justify-between">
      <div>
        <p className="label-mono text-sage">{label}</p>
        <p className={`mt-1 text-3xl font-display font-bold ${tone?.text ?? "text-slate-900"}`}>{value}</p>
        <p className="mt-1 text-xs text-sage">{sub}</p>
      </div>
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl ${tone?.bg ?? "bg-slate-100"}`}>{icon}</div>
    </div>
  );
}

export default function Dashboard({ setTab, setSelectedCaangId }) {
  const caang = useLiveQuery(() => live("caang"), [], []);
  const evals = useLiveQuery(() => live("weekly_evals"), [], []);

  const statsById = caang.map((c) => ({ caang: c, stats: overallStats(evals.filter((e) => e.caangId === c.id)) }));
  const total = statsById.length;
  const lulus = statsById.filter((s) => s.stats.status === "Lulus Standar").length;
  const perlu = statsById.filter((s) => s.stats.status === "Perlu Evaluasi").length;
  const scored = statsById.filter((s) => s.stats.count > 0);
  const avgAngkatan = scored.length ? Math.round((scored.reduce((a, s) => a + s.stats.totalAvg, 0) / scored.length) * 10) / 10 : 0;

  const perBidang = BIDANG.map((b) => {
    const vals = statsById.filter((s) => s.stats.count > 0).map((s) => s.stats[b.key]).filter((v) => v > 0);
    return vals.length ? Math.round((vals.reduce((a, v) => a + v, 0) / vals.length) * 10) / 10 : 0;
  });

  const top = [...scored].sort((a, b) => b.stats.totalAvg - a.stats.totalAvg).slice(0, 3);
  const rankColor = ["bg-kuning text-forest-950", "bg-forest-950 text-white", "bg-forest-700 text-white"];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard label="Total Calon Anggota" value={total} sub="Aktif Proses Pembinaan" icon="👥" tone={{ text: "text-slate-900", bg: "bg-emerald-100" }} />
        <StatCard label="Lulus Standar" value={lulus} sub="✓ Memenuhi Benchmark" icon="🎯" tone={{ text: "text-emerald-600", bg: "bg-emerald-100" }} />
        <StatCard label="Perlu Evaluasi" value={perlu} sub="▲ Perlu Bimbingan" icon="👮" tone={{ text: "text-amber-600", bg: "bg-amber-100" }} />
        <StatCard label="Rata-Rata Angkatan" value={avgAngkatan} sub="Skala 0 - 100 Poin" icon="📈" tone={{ text: "text-violet-600", bg: "bg-violet-100" }} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-white rounded-md border border-forest-950/10 shadow-sm p-5">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="font-bold text-ink">📶 Distribusi Rata-Rata Nilai per Bidang</h2>
            <span className="text-xs text-sage">Kumulatif Angkatan</span>
          </div>
          <div className="h-56 sm:h-72">
            <Bar
              data={{
                labels: BIDANG.map((b) => b.short),
                datasets: [{
                  data: perBidang,
                  backgroundColor: ["#F4D52F", "#1E6943", "#0B2B1E", "#4E9463", "#657168", "#B8912B"],
                  borderRadius: 4,
                }],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { y: { min: 0, max: 100 } },
              }}
            />
          </div>
        </div>

        <div className="bg-white rounded-md border border-forest-950/10 shadow-sm p-5">
          <h2 className="font-bold text-ink mb-4">👑 Top Performer Calon Anggota</h2>
          <div className="space-y-2.5">
            {top.length === 0 && <p className="text-sm text-sage">Belum ada penilaian tercatat.</p>}
            {top.map((s, i) => (
              <button
                key={s.caang.id}
                onClick={() => { setSelectedCaangId(s.caang.id); setTab("profile"); }}
                className="w-full flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5 text-left hover:bg-slate-100"
              >
                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${rankColor[i] ?? "bg-slate-200"}`}>{i + 1}</span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold text-ink truncate">{s.caang.nama}</span>
                  <span className="block text-xs text-sage truncate">{s.caang.prodi} • NPM: {s.caang.npm}</span>
                </span>
                <span className="text-sm font-bold text-emerald-700">{s.stats.totalAvg} Pts</span>
              </button>
            ))}
          </div>
          <button
            onClick={() => setTab("ranking")}
            className="mt-4 w-full rounded-lg bg-slate-100 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-200"
          >
            Lihat Ranking Standar Selengkapnya
          </button>
        </div>
      </div>
    </div>
  );
}
