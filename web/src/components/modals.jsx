import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, live } from "../lib/db.js";
import { fisikScore, weeklyTotal, stageTotal } from "../lib/scoring.js";
import { saveRecord } from "../lib/sync.js";
import { getAuth } from "../lib/api.js";
import { showToast } from "./toast.jsx";

// Bottom sheet on phones (thumb-reachable, native app feel), centered card on
// desktop. Content scrolls under a sticky header; 16px inputs prevent iOS zoom.
export function Modal({ title, children, onClose, wide }) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-end sm:items-center sm:justify-center sm:p-4 print:hidden">
      <div className={`w-full ${wide ? "sm:max-w-3xl" : "sm:max-w-lg"} bg-paper rounded-t-xl sm:rounded-md shadow-2xl flex flex-col max-h-[94dvh] sm:max-h-[88vh]`}>
        <div className="sm:hidden pt-2 pb-1 flex justify-center shrink-0 cursor-pointer" onClick={onClose}>
          <div className="w-10 h-1 rounded-full bg-slate-300" />
        </div>
        <div className="flex items-center justify-between px-5 py-3 border-b shrink-0">
          <h2 className="font-bold text-ink text-base">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl w-9 h-9 flex items-center justify-center">✕</button>
        </div>
        <div
          className="p-5 overflow-y-auto thin-scroll"
          style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-sm border border-forest-950/25 bg-white px-3.5 py-2.5 text-base text-ink focus:outline-none focus:ring-2 focus:ring-forest-700";
const num = (v) => (v === "" ? null : Number(v));
const numOrNull = (v) => (v === "" || v == null ? null : Number(v));

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
          <input type="number" inputMode="decimal" min="0" max="100" className={inputCls} value={t} onChange={setT} />
        </Field>
        <Field label="Praktik (0–100)">
          <input type="number" inputMode="decimal" min="0" max="100" className={inputCls} value={p} onChange={setP} />
        </Field>
      </div>
    </div>
  );
}

/* ---------------- Pendaftaran / Edit Calon Anggota ---------------- */
export function CaangModal({ edit, onClose }) {
  const [f, setF] = useState(() => edit ?? { npm: "", nama: "", fakultas: "", prodi: "", angkatan: "", mentorNama: getAuth()?.profile?.displayName ?? "" });
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
          <Field label="Nama Mentor * (otomatis dari akun)"><input className={inputCls} placeholder="Mentor" value={f.mentorNama} onChange={set("mentorNama")} /></Field>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded-sm border border-forest-950/20 bg-white px-4 py-3 label-mono text-forest-900 hover:bg-paper-2">Batal</button>
          <button type="submit" className="rounded-sm bg-kuning px-5 py-3 label-mono text-forest-950 hover:brightness-95">Simpan Profile</button>
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
    if (f.runMin === "" && f.pushUp === "" && f.pullUp === "") return null;
    return fisikScore(numOrNull(f.runMin), numOrNull(f.pushUp), numOrNull(f.pullUp));
  }, [f.runMin, f.pushUp, f.pullUp]);

  const preview = useMemo(() => {
    const val = (v) => (v === "" ? null : Number(v));
    const hasAny = ["navdarT","navdarP","taliT","taliP","ppgdT","ppgdP","survivalT","survivalP","buddy","team"].some((k) => val(f[k]) != null) || fisik != null;
    if (!hasAny) return null;
    return weeklyTotal({
      navdarT: val(f.navdarT), navdarP: val(f.navdarP), taliT: val(f.taliT), taliP: val(f.taliP),
      ppgdT: val(f.ppgdT), ppgdP: val(f.ppgdP), survivalT: val(f.survivalT), survivalP: val(f.survivalP),
      buddy: val(f.buddy), team: val(f.team), runMin: val(f.runMin), pushUp: val(f.pushUp), pullUp: val(f.pullUp),
      fisikScore: fisik,
    });
  }, [f, fisik]);

  async function save(e) {
    e.preventDefault();
    if (!f.caangId) return showToast("Pilih calon anggota", "error");
    // Mingguan menilai hanya materi yang diajarkan: minimal 2 materi, tiap
    // materi wajib Teori + Praktik. Tes fisik & buddy/team opsional.
    const materi = [["navdarT", "navdarP", "Navdar"], ["taliT", "taliP", "Tali"], ["ppgdT", "ppgdP", "PPGD"], ["survivalT", "survivalP", "Survival"]];
    let filled = 0;
    for (const [tKey, pKey, label] of materi) {
      const t = f[tKey] === "" ? null : Number(f[tKey]);
      const p = f[pKey] === "" ? null : Number(f[pKey]);
      if ((t == null) !== (p == null)) return showToast(`${label}: isi Teori dan Praktik sekaligus`, "error");
      if (t != null) filled++;
    }
    if (filled < 2) return showToast("Isi minimal 2 materi (Teori & Praktik)", "error");

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
      navdarT: numOrNull(f.navdarT), navdarP: numOrNull(f.navdarP),
      taliT: numOrNull(f.taliT), taliP: numOrNull(f.taliP),
      ppgdT: numOrNull(f.ppgdT), ppgdP: numOrNull(f.ppgdP),
      survivalT: numOrNull(f.survivalT), survivalP: numOrNull(f.survivalP),
      buddy: numOrNull(f.buddy), team: numOrNull(f.team),
      runMin: numOrNull(f.runMin), pushUp: numOrNull(f.pushUp), pullUp: numOrNull(f.pullUp),
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

        <p className="rounded-sm border border-kuning/50 bg-kuning/10 px-3 py-2 text-xs text-forest-900">
          Mingguan hanya menilai materi yang diajarkan: isi <b>minimal 2 materi</b> (Teori &amp; Praktik).
          Materi lain, tes fisik, dan buddy/team <b>opsional</b>.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ScorePair label="🧭 Navigasi Darat" color="text-forest-700" t={f.navdarT} p={f.navdarP} setT={set("navdarT")} setP={set("navdarP")} />
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
            <p className="text-xs font-bold mb-2 text-purple-700">🏃 Penilaian Tes Fisik {fisik != null && <span className="ml-1 rounded bg-kuning/30 px-2 py-0.5 text-forest-950">Skor: {fisik}</span>}</p>
            <div className="grid grid-cols-3 gap-2">
              <Field label="Lari 3Km (Menit)"><input type="number" inputMode="decimal" step="0.1" min="0" className={inputCls} value={f.runMin} onChange={set("runMin")} /></Field>
              <Field label="Push-Up (Reps)"><input type="number" inputMode="numeric" min="0" className={inputCls} value={f.pushUp} onChange={set("pushUp")} /></Field>
              <Field label="Pull-Up (Reps)"><input type="number" inputMode="numeric" min="0" className={inputCls} value={f.pullUp} onChange={set("pullUp")} /></Field>
            </div>
          </div>
        </div>

        <Field label="Catatan Mentor / Rekomendasi Evaluasi">
          <textarea rows="2" className={inputCls} placeholder="Tuliskan perkembangan, kelemahan, atau saran khusus..." value={f.catatan} onChange={set("catatan")} />
        </Field>

        {preview != null && (
          <p className="text-sm text-slate-500">Pratinjau total minggu ini: <b className="text-forest-700">{preview}</b></p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="rounded-sm border border-forest-950/20 bg-white px-4 py-3 label-mono text-forest-900 hover:bg-paper-2">Batal</button>
          <button type="submit" className="rounded-sm bg-kuning px-5 py-3 label-mono text-forest-950 hover:brightness-95">Simpan Evaluasi</button>
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
    ["navdarT", "navdarP", "🧭 Navdar", "text-forest-700"],
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
          <button type="button" onClick={onClose} className="rounded-sm border border-forest-950/20 bg-white px-4 py-3 label-mono text-forest-900 hover:bg-paper-2">Batal</button>
          <button type="submit" className="rounded-sm bg-kuning px-5 py-3 label-mono text-forest-950 hover:brightness-95">Simpan Penilaian</button>
        </div>
      </form>
    </Modal>
  );
}
