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
- [x] Phase 2 — offline-first web app (all 7 screens, Dexie local DB, outbox sync, offline badge; E2E: input while API down → auto-sync on reconnect)
- [x] Phase 3 — sync engine (server push/pull + client outbox/cursor/LWW)
- [ ] Phase 4 — Capacitor APK + distribution
- [ ] Phase 5 — hardening + pilot rollout

## Quick start (full local dev)

```bash
# 1. API in Docker (production image, SQLite volume, seeded admin/kapalbaja)
docker compose -f docker-compose.dev.yml up -d --build   # http://localhost:8080

# 2. Web app
cd web
npm install
npm run dev                                              # http://localhost:5173
```

Login `admin` / `kapalbaja` (dev seed). Stop the API container to demo offline mode:
input still saves locally, the badge shows pending changes, and everything syncs
automatically when the API is reachable again.

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
