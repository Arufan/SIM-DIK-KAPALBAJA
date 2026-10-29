# SIM-DIK KAPALBAJA

Sistem Monitoring Pendidikan Calon Anggota — UKM Kapal Baja, Universitas Bhayangkara Jakarta Raya.

Offline-first mentor assessment app: mentors input weekly evaluations (Minggu 1–14), stage exams
(Uji Kompetensi Kampus → Diksar → Diklat), and print rapor — fully offline in the field —
then everything syncs to a central database when back online.

- **Plan / roadmap:** [`docs/kapal-baja-android-offline-plan.md`](docs/kapal-baja-android-offline-plan.md)

## Monorepo layout

| Path | What |
|---|---|
| `api/` | Node.js + Express + Prisma (SQLite) — auth, CRUD, offline sync endpoints |
| `web/` | React + Vite + Tailwind SPA — same UI as the original Google Sites embed, backed by a local Dexie (IndexedDB) database with an outbox sync engine |
| `android/` | Capacitor wrapper → signed APK (assets bundled, works offline from first launch) |
| `docs/` | Architecture plan, decisions, API contract |

## Status

- [x] Phase 0 — repo scaffold, plan
- [x] Phase 1 — backend API + auth + data model + offline sync (smoke: `npm run smoke` in `api/`, 24 checks)
- [ ] Phase 2 — offline-first web app
- [ ] Phase 3 — sync engine on the client (server side done: `/sync/push`, `/sync/pull`)
- [ ] Phase 4 — Capacitor APK + distribution
- [ ] Phase 5 — hardening + pilot rollout

## Quick start (API)

```bash
cd api
cp .env.example .env          # then edit JWT secrets
npm install
npx prisma migrate dev        # creates SQLite DB
npm run seed                  # admin user + sample data
npm run dev                   # http://localhost:8080/health
```

## Deployment (VPS + Cloudflare Tunnel)

See plan §5. `docker compose up -d --build` runs the API; `cloudflared` publishes it at
`sdm.<domain>.my.id` with automatic TLS. Backups ship nightly to the Tailscale peer.
