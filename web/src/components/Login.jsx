import { useState } from "react";
import { login } from "../lib/api.js";
import { sync } from "../lib/sync.js";
import { showToast } from "./toast.jsx";

function Logo({ size = "w-14 h-14" }) {
  return (
    <div className={`${size} rounded-full bg-[#14532d] flex items-center justify-center shrink-0 border-4 border-amber-400`}>
      <svg viewBox="0 0 24 24" className="w-3/5 h-3/5 text-amber-400" fill="currentColor">
        <path d="M3 14l2-6h14l2 6-9 4-9-4zm2 6h14v2H5v-2z" />
      </svg>
    </div>
  );
}

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
    <div className="min-h-full flex items-center justify-center bg-gradient-to-br from-[#14532d] via-[#166534] to-[#052e16] p-4 print:hidden">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8">
        <div className="flex flex-col items-center gap-3 mb-6">
          <Logo size="w-20 h-20" />
          <h1 className="text-2xl font-bold font-serif text-[#14532d]">LOGIN MENTOR KAPALBAJA</h1>
          <p className="text-sm text-slate-500 text-center">Sistem Monitoring Pendidikan Calon Anggota</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Username Mentor</label>
            <input
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              placeholder="Masukkan Username / Nama Mentor"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Password</label>
            <input
              type="password"
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              placeholder="Masukkan Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-[#14532d] text-white font-semibold py-3 hover:bg-emerald-800 disabled:opacity-60"
          >
            {busy ? "Memproses…" : "Masuk Sistem Mentor"}
          </button>
        </form>
        <p className="mt-5 text-center text-xs text-slate-400">
          Data tersimpan aman di perangkat dan otomatis sinkron saat online.
        </p>
      </div>
    </div>
  );
}
