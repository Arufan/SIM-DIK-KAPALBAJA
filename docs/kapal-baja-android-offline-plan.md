# Plan: SIM-DIK KAPALBAJA — From Google Sites Embed to Offline-First Android App

**Date:** 2026-10-30
**Goal:** Convert the current mentor assessment web app into an Android APK that works fully offline in the field (input/assess members with no signal), then syncs everything to a central database when the device is back online — running on the existing infrastructure (Ubuntu VPS + Cloudflare Tunnel + `.my.id` domain + second VPS with public IP/Tailscale).

---

## 1. What I found on the current site

Explored `https://sites.google.com/ubharajaya.ac.id/sdmkapal/full-page-embed` (login Mentor/kapalbaja). The app is **"SIM-DIK KAPALBAJA"** — *Sistem Monitoring Pendidikan Calon Anggota*, a single-page app embedded 3 iframe levels deep inside Google Sites.

### Features (current)

| Feature | What it does |
|---|---|
| **Login overlay** | Username + password (`kapalbaja`), shows mentor name in header, logout |
| **Dashboard Utama** | Stat cards (total caang, lulus standar, perlu evaluasi, rata-rata angkatan), bar chart "Distribusi Rata-Rata Nilai per Bidang", Top Performer list, link to ranking |
| **Profile & Skill Matrix** | Searchable caang list → profile card (NPM, fakultas/prodi, angkatan, mentor, skor kumulatif), Chart.js **radar** of 6 competencies, progress bars, weekly evaluation history table with edit/delete |
| **Evaluasi Mingguan (1–14)** | Main data-entry table: per caang per week — Navdar/Tali/PPGD/Survival (Teori+Praktik), Buddy & Team, Fisik (Lari 3km menit / Push-Up / Pull-Up), rata-rata, catatan mentor. Filters by name & week. Export PDF |
| **Uji Kompetensi Kampus** | Stage exam records: examiner (penguji), date, T/P scores for Navdar/Tali/PPGD/Survival + MPP, average, keterangan ("Lanjut Ke Diksar"), print rapor |
| **Evaluasi Diksar Penjelajah** | Same structure, result "Lanjut Ke Diklat" |
| **Evaluasi Diklat Penjelajah** | Same structure, result "Anggota Muda" (final designation) |
| **Ranking Standar & Rapor** | Auto-ranked board by accumulated weekly average, status badge (Lulus Standar / Perlu Evaluasi), per-caang **Rapor** modal (printable report card), CSV export |
| **Tambah Caang** | Register member: NPM, nama, fakultas, prodi, angkatan diklat, nama mentor |
| **+ Input Evaluasi** | Global modal for the weekly evaluation form (the core offline form) |

### Technical reality (verified from source + storage)

- Single inline HTML/JS file (~63 KB of vanilla JS), **Tailwind CDN, Chart.js, html2pdf.js** — all from CDN (no internet = app doesn't even render properly).
- **No backend at all**: zero `fetch`/XHR/API calls. Login is a client-side string comparison (`pass === 'kapalbaja'`).
- **No persistence**: members & evaluations live in in-memory seed arrays (`caangData`, `evaluasiData`, `ujiKampusData`, `diksarData`, `diklatData` — 3 dummy caang). The **only** localStorage key is `kb_active_mentor`. **Anything a mentor inputs today is silently lost on page refresh.**
- Google Sites embed blocks PWA features (service worker scope, install, offline cache) — the app must move to its own domain regardless.

> **Consequence:** the rebuild isn't "port and add offline" — it's "port the UI (which is good and familiar to mentors) onto a real local-first architecture with a real backend."

---

## 2. Target architecture

```
┌─────────────────────────── Android APK (Capacitor) ───────────────────────────┐
│  SPA (React + Vite + Tailwind — same look as today)                           │
│  ├─ UI screens: dashboard / profile+radar / weekly eval / 3 stage exams /     │
│  │              ranking / rapor (all rendered from local DB)                  │
│  ├─ Local DB: IndexedDB via Dexie.js (tables mirror server schema)            │
│  ├─ Outbox queue: every create/update/delete → local DB + pending_sync row    │
│  └─ Sync engine: push outbox → pull changes; triggers: app open,              │
│       connectivity regained, periodic, manual "Sync now" (pending badge)      │
└──────────────┬────────────────────────────────────────────────────────────────┘
               │ HTTPS + JWT
┌──────────────▼────────────────────────────────────────────────────────────────┐
│  API server (Node.js + Express + Prisma)  ← Cloudflare Tunnel (no public IP   │
│  SQLite (WAL) or PostgreSQL                     needed, free SSL)             │
│  domain: sdm.<your-domain>.my.id                                              │
└──────────────┬────────────────────────────────────────────────────────────────┘
               │ Tailscale (private)
┌──────────────▼────────────────────────────────────────────────────────────────┐
│  VPS #2 (public IP): admin SSH jump/exit node, nightly DB backup target,      │
│  Uptime Kuma monitoring, optional staging                                     │
└───────────────────────────────────────────────────────────────────────────────┘
```

**Why Capacitor (recommended) over alternatives:**
- **Capacitor wrap of the SPA**: bundles all assets *inside* the APK → truly offline from first launch, native plugins (secure token storage, file share for PDF rapor, camera/GPS later), one codebase = web + APK. UI is already web — the fastest path that keeps the familiar design.
- *TWA/Bubblewrap* (PWA-signed APK): simpler, but first launch needs network and offline storage is WebView-limited — weaker fit for an outdoor club.
- *Flutter / Kotlin native*: full rewrite of UI for no benefit at this scale.

**Why custom lightweight sync over heavy solutions (CouchDB/PowerSync):** data volume is tiny (a club: dozens–few hundred caang, 14 weekly evals each, 3 stage exams each). A ~200-line outbox + cursor sync is easy to own and debug.

---

## 3. Offline sync design (the heart of the project)

**Principles**
1. **Local-first**: every screen reads/writes the local DB only. Nothing in the UI blocks on network. No internet = full CRUD.
2. **Client-generated IDs**: UUIDv4 for every record → no ID collisions between devices.
3. **Outbox pattern**: a mutation is "saved" the moment it's in the local DB; a `pending_sync` flag (+ `updated_at`, `device_id`) marks it for push.
4. **Soft deletes** (`deleted_at`) so deletes sync too.
5. **Derived scores stored, not recomputed at read time across devices**: compute `fisik_score`, weekly total, cumulative average, rank on write (same formula as today: calcFisikScore, calcEvalSummary) and store them — guarantees all devices and the server agree.

**Sync flow**
- `POST /api/sync/push` — batch of `{table, op, row}` changes + `device_id`. Server upserts by UUID. Response: per-row `accepted` / `conflict`.
- `GET /api/sync/pull?since=<cursor>` — all rows changed since cursor (excluding rows echoed from the same device) + new cursor.
- **Conflict rule:** last-write-wins per record by `updated_at` (server clock as tiebreak). Uniqueness guard: one weekly eval per (caang, week) — on collision keep the newer edit. For a club's workflow (one mentor per batch of caang) this is more than sufficient; no need for field-level merge in v1.
- **Triggers:** app launch · `online` event + successful ping · every 15 min if outbox non-empty · manual sync button with a "N perubahan belum tersinkron" badge.
- **UX:** each screen shows a subtle sync state (green "Tersinkron", amber "N pending", grey "Offline — data aman di perangkat").

**Offline login**
- Real auth server-side (bcrypt/argon2 hashes, roles). On first successful login, a long-lived refresh token (≈60 days) is stored in secure storage; while offline the app opens in "offline mode" with the cached identity. If the token was revoked, sync (not login) fails and asks for re-login.

---

## 4. Data model (v1)

```
users            id, username, password_hash, display_name, role(admin|mentor), is_active
caang            id UUID, npm, nama, fakultas, prodi, angkatan, mentor_id → users,
                 status(aktif|lulus_standar|perlu_evaluasi|anggota_muda), audit + soft-delete
weekly_evals     id UUID, caang_id, week_no(1–14), tanggal,
                 navdar_t, navdar_p, tali_t, tali_p, ppgd_t, ppgd_p,
                 survival_t, survival_p, buddy, team,
                 run_min, push_up, pull_up, fisik_score*,
                 avg*, catatan, mentor_id, audit + soft-delete
                 UNIQUE(caang_id, week_no)
stage_evals      id UUID, caang_id, stage(uji_kampus|diksar|diklat), penguji, tanggal,
                 navdar_t/p, tali_t/p, ppgd_t/p, survival_t/p, mpp_t/p,
                 rata*, keterangan, audit + soft-delete
sync_state       device_id, last_pulled_at, cursor   (per device)
audit_log        optional v2: who changed what, when (useful for disputes)
```
*`fisik_score`, `avg`, ranking = stored derived values, computed identically on client and server.

Migration: one-time script inserts the 3 seed caang (or real member list from the committee) — the current site has no historical data to migrate (it resets on refresh).

---

## 5. Infrastructure mapping (what each piece you have is for)

| Asset | Role |
|---|---|
| **VPS #1 (Ubuntu)** | Runs API + DB via Docker Compose (app + Caddy OR bare Node + Cloudflare client). Cloudflare Tunnel outbound → never needs a public port opened, free auto-SSL, hides server IP. |
| **`.my.id` domain on Cloudflare** | `sdm.<domain>.my.id` → public hostname of the tunnel (mentors' apps talk to this). `staging.<domain>.my.id` for test builds. Also serves the APK download page. |
| **Cloudflare Tunnel + dashboard** | Add later (free): rate-limit / Access policy on admin routes; caching off for API. |
| **VPS #2 (public IP + Tailscale)** | Both VPSes join the tailnet → SSH admin access to VPS#1 without exposing SSH; nightly `sqlite3 .backup`/`pg_dump` pushed here (and/or Cloudflare R2); Uptime Kuma monitors the tunnel URL and alerts (Telegram/WA gateway). |
| **Google Sites page** | Keep as info/landing page; replace the embed with a link + APK download + PWA install instructions. (PWA stays available on the domain for iPhone/PC users for free — same codebase.) |

---

## 6. Stack decisions (recommended + alternatives)

| Layer | Recommendation | Alternatives |
|---|---|---|
| Frontend | **React + Vite + Tailwind** (copy the current look 1:1; shadcn-style components optional) | Vue 3; or stay framework-free with Vite + vanilla modules (smallest, but state/sync code gets messier) |
| Local DB | **Dexie.js (IndexedDB)** — works in browser PWA *and* Capacitor WebView, zero native build pain | `@capacitor-community/sqlite` if you want stricter schema on device |
| Backend | **Node.js 22 + Express + Prisma + SQLite (WAL)** — single file DB, trivially backed up, plenty for this size | Laravel (if you prefer PHP); PostgreSQL if multi-school growth is planned |
| Auth | JWT access (15 min) + refresh (60 d) in `capacitor-secure-storage-plugin`; roles admin/mentor | Cloudflare Access for admin UI in front |
| APK | **Capacitor 7** (`appId: id.my.kapalbaja.sdm`), signed keystore, direct APK distribution first | Play Store later ($25 one-time) |
| PDF/CSV | Keep html2pdf approach via `capacitor-file-sharer` (share rapor PDF to WhatsApp — mentors will love this) | print-handoff |
| Deploy | Docker Compose on VPS#1 + `cloudflared` as a service; GitHub Actions builds APK on tag push | bare systemd |

---

## 7. Phased roadmap

### Phase 0 — Decisions & scaffolding (½ day)
- Confirm stack choices above + open questions (§9).
- Create repo `sim-dik-kapalbaja` (monorepo: `api/`, `web/`, `android/`), DNS `sdm.<domain>.my.id`, tunnel up, Docker Compose skeleton, DB backups cron to VPS#2 over Tailscale.

### Phase 1 — Backend + auth + data (3–5 days)
- Prisma schema (§4), REST: `/auth/login|refresh`, `/caang` CRUD, `/evals/weekly`, `/evals/stage`, `/sync/push|pull`, `/health`.
- Roles & validation; seed script; Postman/HTTP-file smoke tests.
- **Exit test:** create caang + weekly eval via API from outside (through the tunnel).

### Phase 2 — Offline-first web app (5–8 days)
- Port the existing UI screens (they're already good) against **local Dexie first**; port scoring formulas verbatim from current source (calcFisikScore, averages, ranking, status thresholds) into a shared module used by client *and* server (keeps parity).
- Login (online) → cached identity; every list/form works with airplane mode on.
- **Exit test:** full mentor workflow in airplane mode; kill/reopen app — nothing lost.

### Phase 3 — Sync engine (3–5 days)
- Outbox + push/pull + cursors + LWW conflicts; sync badge & manual sync; "last synced" timestamp.
- **Exit test (two devices):** device A offline creates eval, device B offline edits same caang, both reconnect → converged, no duplicates, newest edit wins; delete syncs.

### Phase 4 — APK + distribution (2–4 days)
- Capacitor init, icons/splash (existing logo), keystore + signing, versionCode bump flow.
- Download page on the domain (APK v1.0.0), short "install & first login" guide for mentors (Bahasa Indonesia).
- **Exit test:** install on a real low-end phone, field-style test: airplane mode on at basecamp, input 5 evals, back online at city → all synced.

### Phase 5 — Hardening & rollout (2–3 days)
- Nightly backup + restore drill (a backup you never restored is not a backup), Uptime Kuma alerts, rate limiting, error logging (self-hosted GlitchTip or console-to-file), CF Access on admin endpoints.
- Seed real angkatan data, 1 training session with mentors, pilot with 1 angkatan, then switch Google Sites embed to point at the new app.

**Total: roughly 3–5 weeks part-time** (MVP = Phases 1–4; Phase 5 can overlap the pilot).

---

## 8. Security notes (current → new)

| Today | New system |
|---|---|
| Password compared in client JS, shared by everyone | Per-user accounts, argon2/bcrypt hashes, roles; mentor sees/edits own caang, admin sees all |
| No persistence, no audit | Server-side audit trail, soft deletes, backups |
| Data inside Google/embed iframes | First-party domain via Cloudflare (TLS, hidden origin), tokens in secure storage |

---

## 9. Open questions (need your call before Phase 1)

1. **Accounts:** one shared login per mentor, or individual accounts? (Recommend individual — needed for the audit trail and "mentor sees own caang".)
2. **Do caang/anggota get a read-only view later** (see own rapor)? Cheap to add to the same app with a role.
3. **Play Store** needed, or direct APK download is enough for now?
4. **Photo attachments** for evaluations (e.g., documentation of praktik)? → adds file storage (Cloudflare R2 free tier is fine). Easy v2.
5. Confirm **scoring rules** — are the current formulas (Tes Fisik from lari/push-up/pull-up, lulus threshold, ranking) official, or should the committee ratify them during migration?

---

## 10. Risks & mitigations

- **WebView IndexedDB edge cases** on very old/broken devices → test on a cheap real device in Phase 4; SQLite plugin is the fallback.
- **Clock skew** on phones affecting LWW → server stamps `server_updated_at` on accept; client clock only orders its own outbox.
- **Mentors sharing one phone/account** → individual accounts in v1 avoids ambiguous data ownership.
- **Tunnel outage** → app keeps working offline (by design); monitoring alerts on VPS#2; API restarts via Docker `restart: unless-stopped`.
- **Scope creep** (SaaS for other clubs, GPS, gamification) → park behind v2; v1 ships the workflow mentors already know.
