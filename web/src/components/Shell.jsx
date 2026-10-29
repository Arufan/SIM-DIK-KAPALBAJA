import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../lib/db.js";
import { clearAuth, getAuth } from "../lib/api.js";
import { useSyncStatus, sync, saveRecord, deleteRecord } from "../lib/sync.js";
import { showToast, ToastHost } from "./toast.jsx";
import { CaangModal, WeeklyEvalModal, StageModal } from "./modals.jsx";
import { RaporModal } from "./Ranking.jsx";
import Dashboard from "./Dashboard.jsx";
import Profile from "./Profile.jsx";
import WeeklyEvals from "./WeeklyEvals.jsx";
import StageEvals from "./StageEvals.jsx";
import Ranking from "./Ranking.jsx";

function SyncBadge() {
  const { pending, lastSync, online, syncing } = useSyncStatus();
  const label = !online
    ? "Offline — data aman di perangkat"
    : syncing
      ? "Menyinkronkan…"
      : pending > 0
        ? `${pending} perubahan belum tersinkron`
        : lastSync
          ? `Tersinkron ${new Date(lastSync).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`
          : "Belum tersinkron";
  const color = !online ? "bg-slate-200 text-slate-600" : pending > 0 || syncing ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700";
  return (
    <button
      onClick={() => sync()}
      title="Klik untuk sinkron sekarang"
      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${color} print:hidden`}
    >
      <span className={`w-2 h-2 rounded-full ${!online ? "bg-slate-400" : pending > 0 || syncing ? "bg-amber-500 animate-pulse" : "bg-emerald-500"}`} />
      {label}
    </button>
  );
}

export const TABS = [
  { id: "dashboard", label: "Dashboard Utama", icon: "📊" },
  { id: "profile", label: "Profile & Skill Matrix", icon: "🗂️" },
  { id: "mingguan", label: "Evaluasi Mingguan (14 Mgg)", icon: "📝" },
  { id: "uji_kampus", label: "Uji Kompetensi Kampus", icon: "🎓" },
  { id: "diksar", label: "Evaluasi Diksar Penjelajah", icon: "✅" },
  { id: "diklat", label: "Evaluasi Diklat Penjelajah", icon: "⛰️" },
  { id: "ranking", label: "Ranking Standar & Rapor", icon: "🏆" },
];

function InstallButton() {
  const [ev, setEv] = useState(null);
  useEffect(() => {
    const h = (e) => { e.preventDefault(); setEv(e); };
    window.addEventListener("beforeinstallprompt", h);
    return () => window.removeEventListener("beforeinstallprompt", h);
  }, []);
  if (!ev) return null;
  return (
    <button
      onClick={async () => { await ev.prompt(); setEv(null); }}
      className="rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold px-3 py-1.5 hover:bg-emerald-200 print:hidden"
      title="Pasang aplikasi ke home screen — bekerja offline"
    >
      📲 Install
    </button>
  );
}

export default function Shell({ profile, onLogout }) {
  const [tab, setTab] = useState("dashboard");
  const [modal, setModal] = useState(null); // { type: "caang" | "eval" | "stage", ... }
  const [selectedCaangId, setSelectedCaangId] = useState(null);
  const { online } = useSyncStatus();

  const caangCount = useLiveQuery(() => db.caang.filter((c) => !c.deletedAt).count(), [], 0);

  async function handleLogout() {
    if (!confirm("Logout dari sistem? Data offline tetap tersimpan di perangkat.")) return;
    clearAuth();
    onLogout();
  }

  const tabProps = {
    setTab,
    selectedCaangId,
    setSelectedCaangId,
    openModal: setModal,
  };

  return (
    <div className="min-h-full flex flex-col">
      {/* header */}
      <header className="bg-white px-4 sm:px-6 py-3 flex items-center gap-3 shadow-sm print:hidden">
        <div className="w-11 h-11 rounded-full bg-[#14532d] border-4 border-amber-400 flex items-center justify-center shrink-0">
          <svg viewBox="0 0 24 24" className="w-6 h-6 text-amber-400" fill="currentColor">
            <path d="M3 14l2-6h14l2 6-9 4-9-4zm2 6h14v2H5v-2z" />
          </svg>
        </div>
        <h1 className="font-serif font-bold text-2xl sm:text-3xl text-slate-900 tracking-wide">SDM KAPAL BAJA</h1>
        <div className="ml-auto flex items-center gap-2">
          <InstallButton />
          <SyncBadge />
          <div className="hidden sm:flex items-center gap-1.5 rounded-full bg-emerald-900 text-white text-xs font-semibold px-3 py-1.5">
            <span>👤</span> {profile.displayName}
          </div>
          <button onClick={handleLogout} className="rounded-full bg-red-700 text-white text-xs font-semibold px-3 py-1.5 hover:bg-red-800">
            Logout
          </button>
        </div>
      </header>

      {/* action bar */}
      <div className="bg-[#14532d] px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-end gap-2 print:hidden">
        {!online && <span className="text-xs text-amber-300 mr-auto">Mode offline — input tetap jalan, sinkron otomatis nanti</span>}
        <button
          onClick={() => setModal({ type: "caang" })}
          className="rounded-full bg-emerald-600 text-white text-sm font-semibold px-4 py-1.5 hover:bg-emerald-500"
        >
          ➕ Tambah Caang
        </button>
        <button
          onClick={() => setModal({ type: "eval" })}
          className="rounded-full bg-amber-500 text-white text-sm font-semibold px-4 py-1.5 hover:bg-amber-400"
        >
          ✍️ + Input Evaluasi
        </button>
      </div>

      {/* tabs */}
      <nav className="bg-white border-b border-slate-200 px-2 sm:px-4 overflow-x-auto thin-scroll print:hidden">
        <div className="flex space-x-1 min-w-max">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`py-3 px-3 text-sm font-medium border-b-2 whitespace-nowrap ${
                tab === t.id ? "border-emerald-700 text-emerald-800" : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              <span className="mr-1">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto">
        {tab === "dashboard" && <Dashboard {...tabProps} />}
        {tab === "profile" && <Profile {...tabProps} />}
        {tab === "mingguan" && <WeeklyEvals {...tabProps} />}
        {tab === "uji_kampus" && <StageEvals {...tabProps} stage="uji_kampus" />}
        {tab === "diksar" && <StageEvals {...tabProps} stage="diksar" />}
        {tab === "diklat" && <StageEvals {...tabProps} stage="diklat" />}
        {tab === "ranking" && <Ranking {...tabProps} />}
      </main>

      {modal?.type === "caang" && <CaangModal {...modal} onClose={() => setModal(null)} />}
      {modal?.type === "eval" && <WeeklyEvalModal {...modal} onClose={() => setModal(null)} />}
      {modal?.type === "stage" && <StageModal {...modal} onClose={() => setModal(null)} />}
      {modal?.type === "rapor" && <RaporModal {...modal} onClose={() => setModal(null)} />}
      <ToastHost />
    </div>
  );
}
