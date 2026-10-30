import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, live } from "../lib/db.js";
import { weeklyTotal, fisikScore, fmtPair } from "../lib/scoring.js";
import { deleteRecord } from "../lib/sync.js";
import { exportHtmlToPdf, escapeHtml } from "../lib/exportPdf.js";
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
      fmtPair(e.navdarT, e.navdarP), fmtPair(e.taliT, e.taliP), fmtPair(e.ppgdT, e.ppgdP), fmtPair(e.survivalT, e.survivalP),
      fmtPair(e.buddy, e.team), e.runMin == null && e.pushUp == null && e.pullUp == null ? "-" : `${e.runMin ?? "-"}m/${e.pushUp ?? "-"}p/${e.pullUp ?? "-"}p`, e.avg ?? weeklyTotal(e) ?? "-", e.catatan ?? "",
    ]),
  ];

  async function exportPdf() {
    if (rows.length === 0) return showToast("Belum ada data untuk diekspor", "error");
    showToast("Membuat PDF…");
    const rowsHtml = rows
      .map(({ e, c }, i) => {
        const fisik = e.fisikScore ?? fisikScore(e.runMin, e.pushUp, e.pullUp);
        const avg = e.avg ?? weeklyTotal(e);
        return `<tr style="background:${i % 2 ? "#f2f1e9" : "#ffffff"}">
          <td style="border:1px solid #cbd5e1;padding:5px 7px">${i + 1}</td>
          <td style="border:1px solid #cbd5e1;padding:5px 7px;font-weight:700">${escapeHtml(c.nama)}</td>
          <td style="border:1px solid #cbd5e1;padding:5px 7px">${e.weekNo}</td>
          <td style="border:1px solid #cbd5e1;padding:5px 7px">${escapeHtml(e.tanggal)}</td>
          <td style="border:1px solid #cbd5e1;padding:5px 7px">${fmtPair(e.navdarT, e.navdarP)}</td>
          <td style="border:1px solid #cbd5e1;padding:5px 7px">${fmtPair(e.taliT, e.taliP)}</td>
          <td style="border:1px solid #cbd5e1;padding:5px 7px">${fmtPair(e.ppgdT, e.ppgdP)}</td>
          <td style="border:1px solid #cbd5e1;padding:5px 7px">${fmtPair(e.survivalT, e.survivalP)}</td>
          <td style="border:1px solid #cbd5e1;padding:5px 7px">${fmtPair(e.buddy, e.team)}</td>
          <td style="border:1px solid #cbd5e1;padding:5px 7px">${e.runMin == null && e.pushUp == null && e.pullUp == null ? "–" : `${e.runMin ?? "–"}m/${e.pushUp ?? "–"}p/${e.pullUp ?? "–"}p`}</td>
          <td style="border:1px solid #cbd5e1;padding:5px 7px;font-weight:700">${avg ?? "–"}</td>
        </tr>`;
      })
      .join("");
    const node = document.createElement("div");
    node.innerHTML = `
      <div style="text-align:center;margin-bottom:10px">
        <div style="font-family:'Saira Variable',Arial,sans-serif;font-weight:700;font-size:18px;color:#071c14;letter-spacing:0.04em">SDM KAPAL BAJA</div>
        <div style="font-size:11px;color:#657168">FORM PENILAIAN MENTOR MINGGUAN (MINGGU 1–14) · UKM KAPAL BAJA UBHARA JAYA</div>
      </div>
      <table style="border-collapse:collapse;width:100%;font-size:11px">
        <thead><tr style="background:#071c14;color:#f4d52f">
          ${HEAD.map((h) => `<th style="border:1px solid #071c14;padding:6px 7px;text-align:left">${h}</th>`).join("")}
        </tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
      <p style="font-size:10px;color:#657168;margin-top:8px">Dicetak ${new Date().toLocaleString("id-ID")} · ${rows.length} penilaian · SIM-DIK KAPALBAJA</p>`;
    await exportHtmlToPdf(node, "evaluasi-mingguan.pdf");
    showToast("PDF tersimpan");
  }

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-md border border-forest-950/10 shadow-sm p-5 flex flex-wrap items-center gap-3">
        <div>
          <h2 className="font-bold text-slate-800">📝 Form Penilaian Mentor Mingguan (Minggu 1 – 14)</h2>
          <p className="text-xs text-slate-400">Kelola dan perbarui catatan penilaian evaluasi berkala calon anggota.</p>
        </div>
        <div className="ml-auto flex gap-2">
          <button onClick={exportPdf} className="rounded-sm border border-forest-950/30 bg-white label-mono px-3 sm:px-4 py-2.5 text-forest-950 hover:bg-paper-2">
            📕 Ekspor PDF
          </button>
          <button onClick={() => downloadCsv("evaluasi-mingguan.csv", csvRows)} className="rounded-sm bg-forest-950 text-kuning label-mono px-3 sm:px-4 py-2.5 hover:brightness-125">
            📄 Ekspor CSV
          </button>
          <button onClick={() => openModal({ type: "eval" })} className="rounded-lg bg-kuning text-forest-950 label-mono px-4 py-2.5 hover:brightness-95">
            + Tambah Penilaian Baru
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row flex-wrap gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari nama Caang..."
          className="rounded-sm border border-forest-950/20 bg-white px-3 py-2.5 text-base w-full sm:w-56 focus:outline-none focus:ring-2 focus:ring-forest-700"
        />
        <select value={week} onChange={(e) => setWeek(e.target.value)} className="rounded-sm border border-forest-950/20 bg-white px-3 py-2.5 text-base w-full sm:w-auto focus:outline-none focus:ring-2 focus:ring-forest-700">
          <option value="">Semua Minggu (1 - 14)</option>
          {Array.from({ length: 14 }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>Minggu {n}</option>
          ))}
        </select>
      </div>

      {/* mobile: thumb-friendly cards instead of a wide table */}
      <div className="md:hidden space-y-3">
        {rows.length === 0 && (
          <div className="bg-white rounded-md border border-forest-950/10 p-6 text-center text-sm text-sage">
            Belum ada penilaian. Tekan tombol <b className="text-forest-950">+</b> di kanan bawah.
          </div>
        )}
        {rows.map(({ e, c }) => (
          <div key={e.id} className="bg-white rounded-md border border-forest-950/10 shadow-sm p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-bold text-ink truncate">{c.nama}</p>
                <p className="label-mono text-forest-700 mt-0.5">Minggu {e.weekNo} · {e.tanggal}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-display font-bold text-2xl text-forest-700 leading-none">{e.avg ?? weeklyTotal(e) ?? "–"}</p>
                <p className="label-mono text-sage mt-1">Total</p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              {[["Navdar", fmtPair(e.navdarT, e.navdarP)], ["Tali", fmtPair(e.taliT, e.taliP)], ["PPGD", fmtPair(e.ppgdT, e.ppgdP)], ["Survival", fmtPair(e.survivalT, e.survivalP)], ["Buddy", fmtPair(e.buddy, e.team)], ["Fisik", e.runMin == null && e.pushUp == null && e.pullUp == null ? "–" : `${e.runMin ?? "–"}m · ${e.pushUp ?? "–"}/${e.pullUp ?? "–"}`]].map(([label, text]) => (
                <div key={label} className="rounded-sm bg-paper-2 py-1.5">
                  <p className="text-[10px] font-semibold text-sage uppercase">{label}</p>
                  <p className="text-xs font-bold text-ink">{text}</p>
                </div>
              ))}
            </div>
            {e.catatan && <p className="mt-2 text-xs text-sage italic">“{e.catatan}”</p>}
            <div className="mt-3 flex gap-2">
              <button onClick={() => openModal({ type: "eval", edit: e })} className="flex-1 rounded-sm border border-forest-950/20 py-2 label-mono text-forest-900">✏️ Edit</button>
              <button
                onClick={async () => { if (confirm(`Hapus penilaian ${c.nama} Minggu ${e.weekNo}?`)) { await deleteRecord("weekly_evals", e.id); showToast("Penilaian dihapus"); } }}
                className="rounded-sm border border-red-200 bg-red-50 px-4 py-2 label-mono text-red-700"
              >🗑️</button>
            </div>
          </div>
        ))}
      </div>

      <div className="hidden md:block bg-white rounded-md border border-forest-950/10 shadow-sm overflow-x-auto thin-scroll">
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
                <td className="py-2.5 px-3">{fmtPair(e.navdarT, e.navdarP)}</td>
                <td className="py-2.5 px-3">{fmtPair(e.taliT, e.taliP)}</td>
                <td className="py-2.5 px-3">{fmtPair(e.ppgdT, e.ppgdP)}</td>
                <td className="py-2.5 px-3">{fmtPair(e.survivalT, e.survivalP)}</td>
                <td className="py-2.5 px-3">{fmtPair(e.buddy, e.team)}</td>
                <td className="py-2.5 px-3">{e.runMin == null && e.pushUp == null && e.pullUp == null ? "–" : `${e.runMin ?? "–"}m/${e.pushUp ?? "–"}p/${e.pullUp ?? "–"}p`}</td>
                <td className="py-2.5 px-3 font-bold text-forest-700">{e.avg ?? weeklyTotal(e) ?? "–"}</td>
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
