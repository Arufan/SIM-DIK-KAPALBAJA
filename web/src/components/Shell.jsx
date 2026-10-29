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
    ? "OFFLINE · DATA AMAN"
    : syncing
      ? "SINKRONISASI…"
      : pending > 0
        ? `${pending} BELUM TERSINKRON`
        : lastSync
          ? `TERSINKRON ${new Date(lastSync).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`
          : "BELUM TERSINKRON";
  const cls = !online
    ? "bg-white/10 text-white/70 border-white/20"
    : pending > 0 || syncing
      ? "bg-kuning/20 text-kuning border-kuning/50"
      : "bg-forest-700/40 text-emerald-200 border-emerald-300/30";
  return (
    <button
      onClick={() => sync()}
      title="Klik untuk sinkron sekarang"
      className={`flex items-center gap-1.5 rounded-sm border px-3 py-1.5 label-mono ${cls} print:hidden`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${!online ? "bg-white/40" : pending > 0 || syncing ? "bg-kuning animate-pulse" : "bg-kuning"}`} />
      {label}
    </button>
  );
}

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
      className="rounded-sm border border-kuning/60 bg-kuning/10 px-3 py-1.5 label-mono text-kuning hover:bg-kuning/20 print:hidden"
      title="Pasang aplikasi ke home screen — bekerja offline"
    >
      📲 Install
    </button>
  );
}

export const TABS = [
  { id: "dashboard", label: "Dashboard", icon: "📊" },
  { id: "profile", label: "Profile & Skill", icon: "🗂️" },
  { id: "mingguan", label: "Evaluasi Mingguan", icon: "📝" },
  { id: "uji_kampus", label: "Uji Kampus", icon: "🎓" },
  { id: "diksar", label: "Diksar", icon: "✅" },
  { id: "diklat", label: "Diklat", icon: "⛰️" },
  { id: "ranking", label: "Ranking & Rapor", icon: "🏆" },
];

export default function Shell({ profile, onLogout }) {
  const [tab, setTab] = useState("dashboard");
  const [modal, setModal] = useState(null); // { type: "caang" | "eval" | "stage" | "rapor", ... }
  const [selectedCaangId, setSelectedCaangId] = useState(null);
  const { online } = useSyncStatus();

  async function handleLogout() {
    if (!confirm("Logout dari sistem? Data offline tetap tersimpan di perangkat.")) return;
    clearAuth();
    onLogout();
  }

  const tabProps = { setTab, selectedCaangId, setSelectedCaangId, openModal: setModal };

  return (
    <div className="min-h-full flex flex-col">
      {/* header */}
      <header className="bg-forest-950 px-4 sm:px-6 py-3 flex items-center gap-3 border-b-2 border-kuning print:hidden">
        <div className="w-11 h-11 rounded-full bg-forest-900 border-[3px] border-kuning flex items-center justify-center shrink-0">
          <svg viewBox="0 0 24 24" className="w-6 h-6 text-kuning" fill="currentColor">
            <path d="M3 14l2-6h14l2 6-9 4-9-4zm2 6h14v2H5v-2z" />
          </svg>
        </div>
        <div className="leading-tight">
          <h1 className="font-display font-bold uppercase text-2xl sm:text-3xl text-white tracking-wide">SDM Kapal Baja</h1>
          <p className="label-mono text-kuning/90 hidden sm:block">Sistem Monitoring Diklat · Ubhara Jaya</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <InstallButton />
          <SyncBadge />
          <div className="hidden md:flex items-center gap-1.5 rounded-sm border border-white/20 bg-white/5 px-3 py-1.5 label-mono text-white/90">
            {profile.displayName}
          </div>
          <button onClick={handleLogout} className="rounded-sm border border-kuning/60 bg-kuning text-forest-950 label-mono px-3 py-1.5 hover:brightness-95">
            Logout
          </button>
        </div>
      </header>

      {/* action bar */}
      <div className="bg-forest-950 px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-end gap-2 border-b border-white/10 print:hidden">
        {!online && <span className="label-mono text-kuning/80 mr-auto">Mode offline — input tetap jalan</span>}
        <button
          onClick={() => setModal({ type: "caang" })}
          className="rounded-sm bg-kuning px-4 py-2 label-mono text-forest-950 hover:brightness-95"
        >
          + Tambah Caang →
        </button>
        <button
          onClick={() => setModal({ type: "eval" })}
          className="rounded-sm border border-white/25 bg-white/5 px-4 py-2 label-mono text-white hover:border-kuning/60 hover:text-kuning"
        >
          + Input Evaluasi →
        </button>
      </div>

      {/* tabs */}
      <nav className="bg-forest-950 border-b border-white/10 px-2 sm:px-4 overflow-x-auto thin-scroll print:hidden">
        <div className="flex space-x-1 min-w-max">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`py-3 px-3 label-mono whitespace-nowrap border-b-2 ${
                tab === t.id
                  ? "border-kuning text-kuning"
                  : "border-transparent text-white/60 hover:text-white"
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
