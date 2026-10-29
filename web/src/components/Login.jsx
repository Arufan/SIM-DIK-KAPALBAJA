import { useState } from "react";
import { login } from "../lib/api.js";
import { sync } from "../lib/sync.js";
import { showToast } from "./toast.jsx";

function Logo({ size = "w-14 h-14" }) {
  return (
    <div className={`${size} rounded-full bg-forest-900 flex items-center justify-center shrink-0 border-4 border-kuning`}>
      <svg viewBox="0 0 24 24" className="w-3/5 h-3/5 text-kuning" fill="currentColor">
        <path d="M3 14l2-6h14l2 6-9 4-9-4zm2 6h14v2H5v-2z" />
      </svg>
    </div>
  );
}

const inputCls =
  "w-full rounded-sm border border-forest-950/20 bg-white px-3.5 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-forest-700 focus:border-forest-700";

export default function Login({ onDone }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const profile = await login(username.trim(), password);
      showToast(`Login Berhasil! Selamat datang, ${profile.displayName}`);
      sync();
      onDone(profile);
    } catch (err) {
      setError(err.offline ? "Tidak ada koneksi. Login pertama kali butuh internet." : err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-full bg-forest-950 relative overflow-hidden print:hidden">
      {/* contour/grid backdrop, like the site hero */}
      <div
        className="absolute inset-0 opacity-[0.14]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(244,213,47,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(244,213,47,0.5) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage: "radial-gradient(ellipse 80% 70% at 50% 40%, black 30%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(ellipse 80% 70% at 50% 40%, black 30%, transparent 75%)",
        }}
      />
      <div className="relative min-h-full flex items-center justify-center p-4">
        <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          {/* hero copy */}
          <div className="hidden lg:block">
            <span className="inline-block bg-kuning px-2.5 py-1 label-mono text-forest-950 mb-5">UKM Kapal Baja</span>
            <h2 className="font-display font-bold uppercase text-5xl text-white leading-[0.95]">
              Jelajah lebih jauh,
              <br />
              catat setiap
              <br />
              <span className="text-kuning">langkahnya.</span>
            </h2>
            <p className="mt-5 text-white/70 max-w-md text-sm leading-relaxed border-l-2 border-kuning pl-4">
              Sistem Monitoring Pendidikan Calon Anggota — input penilaian di lapangan
              tanpa sinyal, tersinkron otomatis saat kembali online.
            </p>
          </div>

          {/* form card */}
          <div className="w-full max-w-md justify-self-end bg-paper rounded-md shadow-2xl p-8">
            <div className="flex items-center gap-3 mb-6">
              <Logo />
              <div>
                <h1 className="font-display font-bold uppercase text-xl text-forest-950 leading-tight">
                  Login Mentor
                </h1>
                <p className="label-mono text-sage">Kapalbaja · Ubhara Jaya</p>
              </div>
            </div>
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="label-mono text-forest-900 block mb-1.5">Username Mentor</label>
                <input className={inputCls} placeholder="Masukkan Username / Nama Mentor" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
              </div>
              <div>
                <label className="label-mono text-forest-900 block mb-1.5">Password</label>
                <input type="password" className={inputCls} placeholder="Masukkan Password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-sm px-3 py-2">{error}</p>}
              <button type="submit" disabled={busy} className="w-full rounded-sm bg-kuning text-forest-950 label-mono py-3 hover:brightness-95 disabled:opacity-60">
                {busy ? "Memproses…" : "Masuk Sistem →"}
              </button>
            </form>
            <p className="mt-5 text-center text-xs text-sage">
              Data tersimpan aman di perangkat dan otomatis sinkron saat online.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
