import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, live } from "../lib/db.js";
import { fisikScore, weeklyTotal, stageTotal } from "../lib/scoring.js";
import { saveRecord } from "../lib/sync.js";
import { showToast } from "./toast.jsx";

function Modal({ title, children, onClose, wide }) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-start justify-center overflow-y-auto p-4">
      <div className={`w-full ${wide ? "max-w-3xl" : "max-w-lg"} bg-white rounded-2xl shadow-2xl my-6`}>
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-bold text-slate-800">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600";
const num = (v) => (v === "" ? null : Number(v));

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-600 mb-1">{label}</label>
      {children}
    </div>
  );
}

function ScorePair({ label, color, t, p, setT, setP }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
      <p className={`text-xs font-bold mb-2 ${color}`}>{label}</p>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Teori (0–100)">
          <input type="number" min="0" max="100" className={inputCls} value={t} onChange={setT} />
        </Field>
        <Field label="Praktik (0–100)">
          <input type="number" min="0" max="100" className={inputCls} value={p} onChange={setP} />
        </Field>
      </div>
    </div>
  );
}

/* ---------------- Pendaftaran / Edit Calon Anggota ---------------- */
export function CaangModal({ edit, onClose }) {
  const [f, setF] = useState(() => edit ?? { npm: "", nama: "", fakultas: "", prodi: "", angkatan: "", mentorNama: "" });
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  async function save(e) {
    e.preventDefault();
    if (!f.npm.trim() || !f.nama.trim()) return showToast("NPM dan Nama wajib diisi", "error");
    const row = { ...f, id: edit?.id ?? crypto.randomUUID() };
    await saveRecord("caang", row);
    showToast(edit ? "Profil diperbarui" : "Calon anggota tersimpan");
    onClose();
  }

  return (
    <Modal title={edit ? "Edit Profil Calon Anggota" : "Pendaftaran Calon Anggota"} onClose={onClose}>
      <form onSubmit={save} className="space-y-4">
        <Field label="NPM (Nomor Pokok Mahasiswa) *">
          <input className={inputCls} placeholder="Contoh: 2023011001" value={f.npm} onChange={set("npm")} />
        </Field>
        <Field label="Nama Lengkap *">
          <input className={inputCls} placeholder="Nama Calon Anggota" value={f.nama} onChange={set("nama")} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Fakultas *"><input className={inputCls} placeholder="Fakultas Teknik" value={f.fakultas} onChange={set("fakultas")} /></Field>
          <Field label="Program Studi *"><input className={inputCls} placeholder="Informatika" value={f.prodi} onChange={set("prodi")} /></Field>
          <Field label="Angkatan Diklat *"><input className={inputCls} placeholder="34" value={f.angkatan} onChange={set("angkatan")} /></Field>
          <Field label="Nama Mentor *"><input className={inputCls} placeholder="Mentor" value={f.mentorNama} onChange={set("mentorNama")} /></Field>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-200">Batal</button>
          <button type="submit" className="rounded-lg bg-[#14532d] px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800">Simpan Profile</button>
        </div>
      </form>
    </Modal>
  );
}

/* ---------------- Penilaian Mentor Mingguan ---------------- */
export function WeeklyEvalModal({ edit, caangId, onClose }) {
  const caang = useLiveQuery(() => live("caang"), [], []);
  const [f, setF] = useState(() => {
    const e = edit;
    return {
      caangId: e?.caangId ?? caangId ?? "",
      weekNo: e?.weekNo ?? 1,
      tanggal: e?.tanggal ?? new Date().toISOString().slice(0, 10),
      navdarT: e?.navdarT ?? "", navdarP: e?.navdarP ?? "",
      taliT: e?.taliT ?? "", taliP: e?.taliP ?? "",
      ppgdT: e?.ppgdT ?? "", ppgdP: e?.ppgdP ?? "",
      survivalT: e?.survivalT ?? "", survivalP: e?.survivalP ?? "",
      buddy: e?.buddy ?? "", team: e?.team ?? "",
      runMin: e?.runMin ?? "", pushUp: e?.pushUp ?? "", pullUp: e?.pullUp ?? "",
      catatan: e?.catatan ?? "",
    };
  });
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  const fisik = useMemo(() => {
    if (f.runMin === "" || f.pushUp === "" || f.pullUp === "") return null;
    return fisikScore(num(f.runMin), num(f.pushUp), num(f.pullUp));
  }, [f.runMin, f.pushUp, f.pullUp]);

  const preview = useMemo(() => {
    if (fisik == null || Object.values(f).some((v) => v === "")) return null;
    return weeklyTotal({ ...f, weekNo: num(f.weekNo), runMin: num(f.runMin), pushUp: num(f.pushUp), pullUp: num(f.pullUp), fisikScore: fisik, catatan: undefined });
  }, [f, fisik]);

  async function save(e) {
    e.preventDefault();
    if (!f.caangId) return showToast("Pilih calon anggota", "error");
    const required = ["navdarT", "navdarP", "taliT", "taliP", "ppgdT", "ppgdP", "survivalT", "survivalP", "buddy", "team", "runMin", "pushUp", "pullUp"];
    if (required.some((k) => f[k] === "")) return showToast("Lengkapi semua nilai", "error");

    const weekTaken = await db.weekly_evals
      .where("[caangId+weekNo]")
      .equals([f.caangId, Number(f.weekNo)])
      .filter((r) => !r.deletedAt && r.id !== (edit?.id ?? ""))
      .first();
    if (weekTaken) return showToast(`Minggu ${f.weekNo} untuk caang ini sudah ada (edit dari tabel)`, "error");

    const row = {
      id: edit?.id ?? crypto.randomUUID(),
      caangId: f.caangId,
      weekNo: Number(f.weekNo),
      tanggal: f.tanggal,
      navdarT: num(f.navdarT), navdarP: num(f.navdarP),
      taliT: num(f.taliT), taliP: num(f.taliP),
      ppgdT: num(f.ppgdT), ppgdP: num(f.ppgdP),
      survivalT: num(f.survivalT), survivalP: num(f.survivalP),
      buddy: num(f.buddy), team: num(f.team),
      runMin: num(f.runMin), pushUp: num(f.pushUp), pullUp: num(f.pullUp),
      fisikScore: fisik,
      catatan: f.catatan,
    };
    row.avg = weeklyTotal(row);
    await saveRecord("weekly_evals", row);
    showToast(edit ? "Penilaian diperbarui" : "Penilaian tersimpan (offline aman)");
    onClose();
  }

  return (
    <Modal title={edit ? "Edit Penilaian Mentor Mingguan" : "Tambah Penilaian Mentor Mingguan"} onClose={onClose} wide>
      <form onSubmit={save} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Calon Anggota *">
            <select className={inputCls} value={f.caangId} onChange={set("caangId")}>
              <option value="">— pilih —</option>
              {caang.map((c) => <option key={c.id} value={c.id}>{c.nama} (NPM: {c.npm})</option>)}
            </select>
          </Field>
          <Field label="Minggu Ke- (1 - 14) *">
            <select className={inputCls} value={f.weekNo} onChange={set("weekNo")}>
              {Array.from({ length: 14 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>Minggu {n}</option>)}
            </select>
          </Field>
          <Field label="Tanggal Evaluasi *">
            <input type="date" className={inputCls} value={f.tanggal} onChange={set("tanggal")} />
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ScorePair label="🧭 Navigasi Darat" color="text-emerald-700" t={f.navdarT} p={f.navdarP} setT={set("navdarT")} setP={set("navdarP")} />
          <ScorePair label="🪢 Tali Menali" color="text-teal-700" t={f.taliT} p={f.taliP} setT={set("taliT")} setP={set("taliP")} />
          <ScorePair label="🩹 PPGD" color="text-red-600" t={f.ppgdT} p={f.ppgdP} setT={set("ppgdT")} setP={set("ppgdP")} />
          <ScorePair label="🏕️ Survival" color="text-amber-700" t={f.survivalT} p={f.survivalP} setT={set("survivalT")} setP={set("survivalP")} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
            <p className="text-xs font-bold mb-2 text-blue-700">🤝 Buddy & Team Work</p>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Body & Buddy (0–100)"><input type="number" min="0" max="100" className={inputCls} value={f.buddy} onChange={set("buddy")} /></Field>
              <Field label="Team Work (0–100)"><input type="number" min="0" max="100" className={inputCls} value={f.team} onChange={set("team")} /></Field>
            </div>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
            <p className="text-xs font-bold mb-2 text-purple-700">🏃 Penilaian Tes Fisik {fisik != null && <span className="ml-1 rounded bg-purple-100 px-2 py-0.5 text-purple-800">Skor: {fisik}</span>}</p>
            <div className="grid grid-cols-3 gap-2">
              <Field label="Lari 3Km (Menit)"><input type="number" step="0.1" min="0" className={inputCls} value={f.runMin} onChange={set("runMin")} /></Field>
              <Field label="Push-Up (Reps)"><input type="number" min="0" className={inputCls} value={f.pushUp} onChange={set("pushUp")} /></Field>
              <Field label="Pull-Up (Reps)"><input type="number" min="0" className={inputCls} value={f.pullUp} onChange={set("pullUp")} /></Field>
            </div>
          </div>
        </div>

        <Field label="Catatan Mentor / Rekomendasi Evaluasi">
          <textarea rows="2" className={inputCls} placeholder="Tuliskan perkembangan, kelemahan, atau saran khusus..." value={f.catatan} onChange={set("catatan")} />
        </Field>

        {preview != null && (
          <p className="text-sm text-slate-500">Pratinjau total minggu ini: <b className="text-emerald-700">{preview}</b></p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-200">Batal</button>
          <button type="submit" className="rounded-lg bg-[#14532d] px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800">Simpan Evaluasi</button>
        </div>
      </form>
    </Modal>
  );
}

/* ---------------- Uji Kampus / Diksar / Diklat ---------------- */
export function StageModal({ stage, edit, onClose }) {
  const caang = useLiveQuery(() => live("caang"), [], []);
  const [f, setF] = useState(() => ({
    caangId: edit?.caangId ?? "",
    penguji: edit?.penguji ?? "",
    tanggal: edit?.tanggal ?? new Date().toISOString().slice(0, 10),
    navdarT: edit?.navdarT ?? "", navdarP: edit?.navdarP ?? "",
    taliT: edit?.taliT ?? "", taliP: edit?.taliP ?? "",
    ppgdT: edit?.ppgdT ?? "", ppgdP: edit?.ppgdP ?? "",
    survivalT: edit?.survivalT ?? "", survivalP: edit?.survivalP ?? "",
    mppT: edit?.mppT ?? "", mppP: edit?.mppP ?? "",
    keterangan: edit?.keterangan ?? "",
  }));
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
  const pairs = [
    ["navdarT", "navdarP", "🧭 Navdar", "text-emerald-700"],
    ["taliT", "taliP", "🪢 Tali", "text-teal-700"],
    ["ppgdT", "ppgdP", "🩹 PPGD", "text-red-600"],
    ["survivalT", "survivalP", "🏕️ Survival", "text-amber-700"],
    ["mppT", "mppP", "📘 MPP", "text-sky-700"],
  ];

  async function save(e) {
    e.preventDefault();
    const required = ["caangId", "penguji", "navdarT", "navdarP", "taliT", "taliP", "ppgdT", "ppgdP", "survivalT", "survivalP", "mppT", "mppP"];
    if (required.some((k) => f[k] === "" || f[k] == null)) return showToast("Lengkapi semua data penilaian", "error");
    const row = {
      id: edit?.id ?? crypto.randomUUID(),
      stage,
      caangId: f.caangId,
      penguji: f.penguji,
      tanggal: f.tanggal,
      keterangan: f.keterangan,
    };
    for (const [t, p] of pairs) { row[t] = num(f[t]); row[p] = num(f[p]); }
    row.rata = stageTotal(row);
    await saveRecord("stage_evals", row);
    showToast(edit ? "Penilaian diperbarui" : "Penilaian tahapan tersimpan");
    onClose();
  }

  return (
    <Modal title={edit ? "Edit Penilaian Tahapan" : "Input Penilaian Tahapan"} onClose={onClose} wide>
      <form onSubmit={save} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Calon Anggota *">
            <select className={inputCls} value={f.caangId} onChange={set("caangId")}>
              <option value="">— pilih —</option>
              {caang.map((c) => <option key={c.id} value={c.id}>{c.nama} (NPM: {c.npm})</option>)}
            </select>
          </Field>
          <Field label="Nama Penguji *"><input className={inputCls} placeholder="Penguji / Pembina" value={f.penguji} onChange={set("penguji")} /></Field>
          <Field label="Tanggal *"><input type="date" className={inputCls} value={f.tanggal} onChange={set("tanggal")} /></Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {pairs.map(([t, p, label, color]) => (
            <ScorePair key={t} label={label} color={color} t={f[t]} p={f[p]} setT={set(t)} setP={set(p)} />
          ))}
        </div>
        <Field label="Keterangan Lanjut">
          <input className={inputCls} placeholder="Contoh: Lanjut Ke Diksar / Anggota Muda" value={f.keterangan} onChange={set("keterangan")} />
        </Field>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-200">Batal</button>
          <button type="submit" className="rounded-lg bg-[#14532d] px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800">Simpan Penilaian</button>
        </div>
      </form>
    </Modal>
  );
}
