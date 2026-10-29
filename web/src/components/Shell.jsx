import { useEffect, useState } from "react";
import { clearAuth, getAuth } from "../lib/api.js";
import { useSyncStatus, sync } from "../lib/sync.js";
import { showToast, ToastHost } from "./toast.jsx";
import { CaangModal, WeeklyEvalModal, StageModal } from "./modals.jsx";
import { RaporModal } from "./Ranking.jsx";
import Dashboard from "./Dashboard.jsx";
import Profile from "./Profile.jsx";
import WeeklyEvals from "./WeeklyEvals.jsx";
import Tahapan from "./Tahapan.jsx";
import Ranking from "./Ranking.jsx";

function SyncBadge({ compact = false }) {
  const { pending, lastSync, online, syncing } = useSyncStatus();
  const label = !online
    ? "OFFLINE"
    : syncing
      ? "SINKRON…"
      : pending > 0
        ? `${pending} PENDING`
        : lastSync
          ? `SYNC ${new Date(lastSync).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`
          : "BELUM SYNC";
  const cls = !online
    ? "bg-white/10 text-white/70 border-white/20"
    : pending > 0 || syncing
      ? "bg-kuning/20 text-kuning border-kuning/50"
      : "bg-forest-700/40 text-emerald-200 border-emerald-300/30";
  return (
    <button
      onClick={() => sync()}
      title="Klik untuk sinkron sekarang"
      className={`flex items-center gap-1.5 rounded-sm border px-2.5 sm:px-3 py-1.5 label-mono ${cls} print:hidden`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${!online ? "bg-white/40" : "bg-kuning animate-pulse"}`} />
      {compact ? (pending > 0 ? pending : "") : label}
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
      className="rounded-sm border border-kuning/60 bg-kuning/10 px-2.5 sm:px-3 py-1.5 label-mono text-kuning hover:bg-kuning/20 print:hidden"
      title="Pasang aplikasi ke home screen — bekerja offline"
    >
      📲<span className="hidden sm:inline"> Install</span>
    </button>
  );
}

// id, top label, mobile short label, icon
export const TABS = [
  { id: "dashboard", label: "Dashboard", short: "Beranda", icon: "📊" },
  { id: "mingguan", label: "Evaluasi Mingguan", short: "Mingguan", icon: "📝" },
  { id: "tahapan", label: "Ujian Tahapan", short: "Tahapan", icon: "🧗" },
  { id: "profile", label: "Profile & Skill", short: "Profil", icon: "🗂️" },
  { id: "ranking", label: "Ranking & Rapor", short: "Ranking", icon: "🏆" },
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
      {/* header — compact on mobile */}
      <header className="bg-forest-950 px-3 sm:px-6 py-2.5 sm:py-3 flex items-center gap-2.5 sm:gap-3 border-b-2 border-kuning print:hidden">
        <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-forest-900 border-[3px] border-kuning flex items-center justify-center shrink-0">
          <svg viewBox="0 0 24 24" className="w-5 h-5 sm:w-6 sm:h-6 text-kuning" fill="currentColor">
            <path d="M3 14l2-6h14l2 6-9 4-9-4zm2 6h14v2H5v-2z" />
          </svg>
        </div>
        <div className="leading-tight min-w-0">
          <h1 className="font-display font-bold uppercase text-lg sm:text-3xl text-white tracking-wide">SDM Kapal Baja</h1>
          <p className="label-mono text-kuning/90 hidden sm:block">Sistem Monitoring Diklat · Ubhara Jaya</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <InstallButton />
          <span className="sm:hidden"><SyncBadge compact /></span>
          <span className="hidden sm:block"><SyncBadge /></span>
          <div className="hidden md:flex items-center gap-1.5 rounded-sm border border-white/20 bg-white/5 px-3 py-1.5 label-mono text-white/90">
            {profile.displayName}
          </div>
          <button onClick={handleLogout} className="rounded-sm border border-white/20 bg-white/5 sm:bg-kuning sm:border-kuning sm:text-forest-950 label-mono px-2.5 sm:px-3 py-1.5 text-white/80 sm:hover:brightness-95">
            <span className="sm:hidden">⎋</span><span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      {/* action bar — desktop only; mobile uses the FAB */}
      <div className="hidden sm:flex bg-forest-950 px-6 py-2.5 items-center justify-end gap-2 border-b border-white/10 print:hidden">
        {!online && <span className="label-mono text-kuning/80 mr-auto">Mode offline — input tetap jalan</span>}
        <button onClick={() => setModal({ type: "caang" })} className="rounded-sm bg-kuning px-4 py-2 label-mono text-forest-950 hover:brightness-95">
          + Tambah Caang →
        </button>
        <button onClick={() => setModal({ type: "eval" })} className="rounded-sm border border-white/25 bg-white/5 px-4 py-2 label-mono text-white hover:border-kuning/60 hover:text-kuning">
          + Input Evaluasi →
        </button>
      </div>

      {/* top tabs — desktop */}
      <nav className="hidden md:block bg-forest-950 border-b border-white/10 px-4 overflow-x-auto thin-scroll print:hidden">
        <div className="flex space-x-1 min-w-max">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`py-3 px-3 label-mono whitespace-nowrap border-b-2 ${
                tab === t.id ? "border-kuning text-kuning" : "border-transparent text-white/60 hover:text-white"
              }`}
            >
              <span className="mr-1">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      <main className="flex-1 p-3 sm:p-6 max-w-7xl w-full mx-auto pb-28 sm:pb-6">
        {tab === "dashboard" && <Dashboard {...tabProps} />}
        {tab === "mingguan" && <WeeklyEvals {...tabProps} />}
        {tab === "tahapan" && <Tahapan {...tabProps} />}
        {tab === "profile" && <Profile {...tabProps} />}
        {tab === "ranking" && <Ranking {...tabProps} />}
      </main>

      {/* FAB — the #1 field action in the thumb zone */}
      <button
        onClick={() => setModal({ type: "eval" })}
        aria-label="Input Evaluasi"
        className="md:hidden fixed right-4 bottom-20 z-40 w-14 h-14 rounded-full bg-kuning text-forest-950 text-3xl font-bold shadow-xl shadow-forest-950/40 flex items-center justify-center active:scale-95 transition-transform print:hidden"
        style={{ marginBottom: "env(safe-area-inset-bottom)" }}
      >
        +
      </button>

      {/* bottom tab bar — mobile */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-forest-950 border-t border-white/10 grid grid-cols-5 print:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex flex-col items-center gap-0.5 py-2 label-mono !text-[9px] !tracking-normal ${
              tab === t.id ? "text-kuning" : "text-white/55"
            }`}
          >
            <span className="text-lg leading-none">{t.icon}</span>
            {t.short}
          </button>
        ))}
      </nav>

      {modal?.type === "caang" && <CaangModal {...modal} onClose={() => setModal(null)} />}
      {modal?.type === "eval" && <WeeklyEvalModal {...modal} onClose={() => setModal(null)} />}
      {modal?.type === "stage" && <StageModal {...modal} onClose={() => setModal(null)} />}
      {modal?.type === "rapor" && <RaporModal {...modal} onClose={() => setModal(null)} />}
      <ToastHost />
    </div>
  );
}
