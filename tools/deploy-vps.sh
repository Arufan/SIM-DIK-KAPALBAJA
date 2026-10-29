#!/usr/bin/env bash
# One-shot deploy for SIM-DIK on the VPS. Safe to re-run.
set -e
cd /home/blackcopay/simdik-kapalbaja

if [ ! -f .env ]; then
  cat > .env <<ENVEOF
JWT_ACCESS_SECRET=$(openssl rand -hex 48)
JWT_REFRESH_SECRET=$(openssl rand -hex 48)
SEED_ADMIN_USERNAME=admin
SEED_ADMIN_PASSWORD=Kb-$(openssl rand -hex 6)
VITE_API_URL=https://mentor.kapalbaja.web.id
ENVEOF
  chmod 600 .env
  echo "[env] created .env with fresh secrets"
else
  echo "[env] .env already exists — keeping it"
fi

echo "[deploy] building + starting containers (this takes a few minutes)…"
docker compose up -d --build 2>&1 | tail -4

sleep 4
echo "[health] $(curl -s --max-time 5 http://127.0.0.1:8080/health)"
echo "[web]    $(curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://127.0.0.1:8081/ || true) (web via 8081 if mapped)"

# Let the existing cloudflared connector reach these containers by name
docker network connect simdik-kapalbaja_default cloudflared 2>/dev/null && echo "[tunnel] cloudflared joined simdik network" || echo "[tunnel] cloudflared already connected"

echo "[dns-from-tunnel] $(docker exec cloudflared getent hosts simdik-web 2>/dev/null || echo 'getent unavailable in image')"

echo "[admin] $(grep SEED_ADMIN_PASSWORD .env)"
