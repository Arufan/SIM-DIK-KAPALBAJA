import { useEffect, useState } from "react";
import { apiFetch, getAuth } from "../lib/api.js";
import { showToast } from "./toast.jsx";
import { Modal } from "./modals.jsx";

// Admin-only account management. Server data (not offline-synced): the panel
// degrades gracefully to a notice when there is no connection.
const genPassword = () => {
  const abc = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  return Array.from(crypto.getRandomValues(new Uint8Array(10)), (n) => abc[n % abc.length]).join("");
};

function RoleBadge({ role }) {
  return (
    <span className={`rounded-sm px-2 py-0.5 label-mono ${role === "admin" ? "bg-kuning/25 text-forest-950" : "bg-forest-700/15 text-forest-700"}`}>
      {role}
    </span>
  );
}

function AddUserModal({ onClose, onCreated }) {
  const [f, setF] = useState({ username: "", displayName: "", password: genPassword(), role: "mentor" });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await apiFetch("/users", { method: "POST", body: f });
      showToast(`User "${f.username}" dibuat`);
      onCreated();
      onClose();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Tambah User" onClose={onClose}>
      <form onSubmit={save} className="space-y-4">
        <div>
          <label className="label-mono text-forest-900 block mb-1.5">Username *</label>
          <input className="w-full rounded-sm border border-forest-950/25 bg-white px-3.5 py-2.5 text-base text-ink focus:outline-none focus:ring-2 focus:ring-forest-700" placeholder="cth: senior.budi" value={f.username} onChange={set("username")} autoFocus />
        </div>
        <div>
          <label className="label-mono text-forest-900 block mb-1.5">Nama Tampilan *</label>
          <input className="w-full rounded-sm border border-forest-950/25 bg-white px-3.5 py-2.5 text-base text-ink focus:outline-none focus:ring-2 focus:ring-forest-700" placeholder="cth: Senior Budi" value={f.displayName} onChange={set("displayName")} />
        </div>
        <div>
          <label className="label-mono text-forest-900 block mb-1.5">Password *</label>
          <div className="flex gap-2">
            <input className="w-full rounded-sm border border-forest-950/25 bg-white px-3.5 py-2.5 text-base text-ink focus:outline-none focus:ring-2 focus:ring-forest-700 font-mono" value={f.password} onChange={set("password")} />
            <button type="button" onClick={() => setF((p) => ({ ...p, password: genPassword() }))} className="rounded-sm border border-forest-950/20 px-3 label-mono text-forest-900 hover:bg-paper-2 shrink-0" title="Generate password">
              🎲
            </button>
          </div>
        </div>
        <div>
          <label className="label-mono text-forest-900 block mb-1.5">Role *</label>
          <div className="flex gap-2">
            {[["mentor", "Mentor — kelola caang sendiri"], ["admin", "Admin — akses penuh"]].map(([v, label]) => (
              <button
                type="button"
                key={v}
                onClick={() => setF((p) => ({ ...p, role: v }))}
                className={`flex-1 rounded-sm border px-3 py-2.5 label-mono ${f.role === v ? "border-kuning bg-kuning/20 text-forest-950" : "border-forest-950/20 text-sage"}`}
              >
                {v}
              </button>
            ))}
          </div>
          <p className="text-xs text-sage mt-1.5">{f.role === "mentor" ? "Mentor — kelola caang sendiri" : "Admin — akses penuh + user center"}</p>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="rounded-sm border border-forest-950/20 bg-white px-4 py-3 label-mono text-forest-900 hover:bg-paper-2">Batal</button>
          <button type="submit" disabled={busy} className="rounded-sm bg-kuning px-5 py-3 label-mono text-forest-950 hover:brightness-95 disabled:opacity-60">{busy ? "…" : "Buat User →"}</button>
        </div>
      </form>
    </Modal>
  );
}

export default function UserCenter() {
  const [users, setUsers] = useState(null);
  const [modal, setModal] = useState(false);
  const me = getAuth()?.profile;

  async function load() {
    try {
      setUsers(await apiFetch("/users"));
    } catch (err) {
      setUsers([]);
      showToast(err.offline ? "User Center butuh koneksi internet" : err.message, "error");
    }
  }
  useEffect(() => { load(); }, []);

  async function act(fn, okMsg) {
    try {
      await fn();
      if (okMsg) showToast(okMsg);
      load();
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-md border border-forest-950/10 shadow-sm p-4 sm:p-5 flex flex-wrap items-center gap-3">
        <div>
          <h2 className="font-bold text-ink">🔐 User Center</h2>
          <p className="text-xs text-sage">Kelola akun login &amp; permission. Khusus admin.</p>
        </div>
        <button onClick={() => setModal(true)} className="ml-auto rounded-sm bg-kuning px-4 py-2.5 label-mono text-forest-950 hover:brightness-95">
          + Tambah User →
        </button>
      </div>

      {users === null && <div className="bg-white rounded-md border border-forest-950/10 p-6 text-center text-sm text-sage">Memuat…</div>}
      {users?.length === 0 && <div className="bg-white rounded-md border border-forest-950/10 p-6 text-center text-sm text-sage">Tidak bisa memuat data (offline?).</div>}

      <div className="space-y-3">
        {(users ?? []).map((u) => {
          const isMe = u.id === me?.id;
          return (
            <div key={u.id} className={`bg-white rounded-md border shadow-sm p-4 ${u.isActive ? "border-forest-950/10" : "border-red-200 opacity-75"}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-ink font-mono">{u.username}</p>
                    <RoleBadge role={u.role} />
                    {isMe && <span className="rounded-sm bg-paper-2 px-2 py-0.5 label-mono text-sage">anda</span>}
                    {!u.isActive && <span className="rounded-sm bg-red-100 text-red-700 px-2 py-0.5 label-mono">nonaktif</span>}
                  </div>
                  <p className="text-sm text-ink mt-0.5">{u.displayName}</p>
                  <p className="text-xs text-sage mt-0.5">{u.caangCount} caang binaan · dibuat {new Date(u.createdAt).toLocaleDateString("id-ID")}</p>
                </div>
                <div className="text-right shrink-0 label-mono text-sage">#{u.username.slice(0, 2)}</div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    const pw = prompt(`Password baru untuk ${u.username} (min. 8 karakter):`);
                    if (pw === null) return;
                    if (pw.length < 8) return showToast("password minimal 8 karakter", "error");
                    act(() => apiFetch(`/users/${u.id}`, { method: "PATCH", body: { password: pw } }), `Password ${u.username} direset`);
                  }}
                  className="rounded-sm border border-forest-950/20 px-3 py-2 label-mono text-forest-900 hover:bg-paper-2"
                >🔑 Reset PW</button>
                <button
                  disabled={isMe}
                  onClick={() => act(() => apiFetch(`/users/${u.id}`, { method: "PATCH", body: { role: u.role === "admin" ? "mentor" : "admin" } }), "Role diubah")}
                  className="rounded-sm border border-forest-950/20 px-3 py-2 label-mono text-forest-900 hover:bg-paper-2 disabled:opacity-40"
                  title={isMe ? "Tidak bisa mengubah role sendiri" : ""}
                >⭐ {u.role === "admin" ? "→ Mentor" : "→ Admin"}</button>
                <button
                  disabled={isMe}
                  onClick={() => act(() => apiFetch(`/users/${u.id}`, { method: "PATCH", body: { isActive: !u.isActive } }), u.isActive ? "User dinonaktifkan" : "User diaktifkan")}
                  className="rounded-sm border border-forest-950/20 px-3 py-2 label-mono text-forest-900 hover:bg-paper-2 disabled:opacity-40"
                  title={isMe ? "Tidak bisa menonaktifkan diri sendiri" : ""}
                >{u.isActive ? "🚫 Nonaktifkan" : "✅ Aktifkan"}</button>
                <button
                  disabled={isMe}
                  onClick={() => { if (confirm(`Hapus user ${u.username}? Caang binaannya akan lepas (tanpa mentor).`)) act(() => apiFetch(`/users/${u.id}`, { method: "DELETE" }), "User dihapus"); }}
                  className="rounded-sm border border-red-200 bg-red-50 px-3 py-2 label-mono text-red-700 disabled:opacity-40"
                  title={isMe ? "Tidak bisa menghapus diri sendiri" : ""}
                >🗑️ Hapus</button>
              </div>
            </div>
          );
        })}
      </div>

      {modal && <AddUserModal onClose={() => setModal(false)} onCreated={load} />}
    </div>
  );
}
