import { useEffect, useState } from "react";
import { clearAuth, getAuth } from "../lib/api.js";
import { useSyncStatus, sync, resyncAll, pushAllLocal, getRejectionDetails, discardRejected } from "../lib/sync.js";
import { showToast, ToastHost } from "./toast.jsx";
import { CaangModal, WeeklyEvalModal, StageModal } from "./modals.jsx";
import { RaporModal, StageRaporModal } from "./Ranking.jsx";
import Dashboard from "./Dashboard.jsx";
import Profile from "./Profile.jsx";
import WeeklyEvals from "./WeeklyEvals.jsx";
import Tahapan from "./Tahapan.jsx";
import Ranking from "./Ranking.jsx";
import UserCenter from "./UserCenter.jsx";

function SyncBadge({ compact = false }) {
  const { pending, lastSync, online, syncing, lastError } = useSyncStatus();
  const label = !online
    ? "OFFLINE"
    : lastError
      ? "SYNC GAGAL"
      : syncing
        ? "SINKRON…"
        : pending > 0
          ? `${pending} PENDING`
          : lastSync
            ? `SYNC ${new Date(lastSync).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`
            : "BELUM SYNC";
  const cls = !online
    ? "bg-white/10 text-white/70 border-white/20"
    : lastError
      ? "bg-red-500/20 text-red-200 border-red-400/50"
      : pending > 0 || syncing
        ? "bg-kuning/20 text-kuning border-kuning/50"
        : "bg-forest-700/40 text-emerald-200 border-emerald-300/30";
  return (
    <button
      onClick={() => sync()}
      title={lastError ? `Gagal: ${lastError.message}` : "Klik untuk sinkron sekarang"}
      className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-sm border px-2.5 sm:px-3 label-mono ${cls} print:hidden`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${!online ? "bg-white/40" : "bg-kuning animate-pulse"}`} />
      {compact ? (pending > 0 ? pending : "") : label}
    </button>
  );
}


function ResyncButton() {
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  async function fire() {
    if (!armed) { setArmed(true); setTimeout(() => setArmed(false), 3000); return; }
    setArmed(false);
    setBusy(true);
    try {
      await resyncAll();
      showToast('Sinkron ulang selesai');
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  }
  return (
    <button
      onClick={fire}
      disabled={busy}
      title='Sinkron ulang penuh: bangun ulang data lokal dari server (perbaiki jika jumlah data berbeda antar perangkat)'
      className={`inline-flex h-9 items-center justify-center rounded-sm border px-2.5 label-mono print:hidden ${armed ? "border-red-400 bg-red-500/20 text-red-200" : "border-white/20 bg-white/5 text-white/70 hover:text-kuning hover:border-kuning/60"}`}
    >
      {busy ? '…' : '↻'}
    </button>
  );
}

function RejectionDialog({ info, onClose }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-end sm:items-center sm:justify-center sm:p-4 print:hidden">
      <div className="w-full sm:max-w-lg bg-paper rounded-t-xl sm:rounded-md shadow-2xl flex flex-col max-h-[90dvh]">
        <div className="flex items-center justify-between px-5 py-3 border-b shrink-0">
          <h2 className="font-bold text-ink text-base">Data ditolak server ({info.count})</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl w-9 h-9 flex items-center justify-center">✕</button>
        </div>
        <div className="p-5 overflow-y-auto thin-scroll space-y-2" style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}>
          <p className="text-xs text-sage">Baris berikut tidak bisa disinkronkan (mis. induk caang-nya sudah dihapus di perangkat ini). Bisa dibuang dari perangkat agar tidak muncul lagi.</p>
          {(info.items ?? []).map((item, i) => (
            <div key={i} className="rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-xs">
              <div className="font-mono text-ink">{item.table ?? "?"} · {String(item.id).slice(0, 18)}</div>
              <div className="text-red-700 mt-0.5">{(item.errors ?? []).join(" · ") || "ditolak"}</div>
            </div>
          ))}
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={onClose} className="rounded-sm border border-forest-950/20 bg-white px-4 py-3 label-mono text-forest-900 hover:bg-paper-2">Tutup</button>
            <button
              onClick={async () => {
                setBusy(true);
                try {
                  const n = await discardRejected();
                  showToast(n + " data dibuang dari perangkat");
                  onClose();
                } catch (e) {
                  showToast(e.message, "error");
                } finally {
                  setBusy(false);
                }
              }}
              disabled={busy}
              className="rounded-sm bg-red-600 px-4 py-3 label-mono text-white hover:bg-red-700 disabled:opacity-60"
            >
              {busy ? "…" : "Buang dari perangkat"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PushAllButton() {
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rejection, setRejection] = useState(null);
  async function fire() {
    if (!armed) { setArmed(true); setTimeout(() => setArmed(false), 3000); return; }
    setArmed(false);
    setBusy(true);
    try {
      const n = await pushAllLocal();
      showToast("Mengirim " + n + " baris lokal ke server…");
      const info = await getRejectionDetails();
      if (info?.items?.length) setRejection(info);
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
    <button
      onClick={fire}
      disabled={busy}
      title="Kirim ulang SEMUA data lokal ke server — untuk data yang tertahan/tidak tersinkron (ketuk 2x)"
      className={"inline-flex h-9 items-center justify-center rounded-sm border px-2.5 label-mono print:hidden " + (armed ? "border-red-400 bg-red-500/20 text-red-200" : "border-white/20 bg-white/5 text-white/70 hover:text-kuning hover:border-kuning/60")}
    >
      {busy ? "…" : "⇪"}
    </button>
    {rejection && <RejectionDialog info={rejection} onClose={() => setRejection(null)} />}
    </>
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
      className="inline-flex h-9 items-center justify-center rounded-sm border border-kuning/60 bg-kuning/10 px-2.5 label-mono text-kuning hover:bg-kuning/20 print:hidden"
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

const ADMIN_TAB = { id: "users", label: "User Center", short: "User", icon: "🔐" };

export default function Shell({ profile, onLogout }) {
  const [tab, setTab] = useState("dashboard");
  const [modal, setModal] = useState(null); // { type: "caang" | "eval" | "stage" | "rapor", ... }
  const [selectedCaangId, setSelectedCaangId] = useState(null);
  const { online } = useSyncStatus();
  const isAdmin = profile.role === "admin";
  const tabs = isAdmin ? [...TABS, ADMIN_TAB] : TABS;

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
        <img src="/logo_kb.png" alt="Logo Kapal Baja" className="w-9 h-9 sm:w-11 sm:h-11 rounded-full object-cover shrink-0" />
        <div className="leading-tight min-w-0">
          <h1 className="font-display font-bold uppercase text-lg sm:text-3xl text-white tracking-wide">SDM Kapal Baja</h1>
          <p className="label-mono text-kuning/90 hidden sm:block">Sistem Monitoring Diklat · Ubhara Jaya</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <InstallButton />
          <PushAllButton />
          <ResyncButton />
          <span className="sm:hidden"><SyncBadge compact /></span>
          <span className="hidden sm:block"><SyncBadge /></span>
          <div className="hidden md:flex items-center gap-1.5 rounded-sm border border-white/20 bg-white/5 px-3 py-1.5 label-mono text-white/90">
            {profile.displayName}
          </div>
          <button onClick={handleLogout} className="inline-flex h-9 items-center justify-center rounded-sm border border-white/20 bg-white/5 sm:bg-kuning sm:border-kuning sm:text-forest-950 label-mono px-2.5 sm:px-3 text-white/80 sm:hover:brightness-95">
            <span className="sm:hidden">⎋</span><span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      {/* action bar — always visible (field users on portrait phones need it) */}
      <div className="flex flex-wrap bg-forest-950 px-3 sm:px-6 py-2 items-center justify-end gap-2 border-b border-white/10 print:hidden">
        <span className="label-mono text-kuning/80 mr-auto hidden sm:inline">{!online ? "Mode offline — input tetap jalan" : ""}</span>
        <button onClick={() => setModal({ type: "caang" })} className="inline-flex h-10 items-center justify-center rounded-sm bg-kuning px-3 sm:px-4 label-mono text-forest-950 hover:brightness-95">
          + Tambah Caang <span className="hidden sm:inline">→</span>
        </button>
        <button onClick={() => setModal({ type: "eval" })} className="inline-flex h-10 items-center justify-center rounded-sm border border-white/25 bg-white/5 px-3 sm:px-4 label-mono text-white hover:border-kuning/60 hover:text-kuning">
          + Input Evaluasi <span className="hidden sm:inline">→</span>
        </button>
      </div>

      {/* top tabs — desktop */}
      <nav className="hidden md:block bg-forest-950 border-b border-white/10 px-4 overflow-x-auto thin-scroll print:hidden">
        <div className="flex space-x-1 min-w-max">
          {tabs.map((t) => (
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
        {tab === "users" && isAdmin && <UserCenter />}
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
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-forest-950 border-t border-white/10 grid print:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)", gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
      >
        {tabs.map((t) => (
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
      {modal?.type === "stage_rapor" && <StageRaporModal {...modal} onClose={() => setModal(null)} />}
      <ToastHost />
    </div>
  );
}
