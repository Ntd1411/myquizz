#!/usr/bin/env bash
# Deploy MyQuizz on the VPS. Run it as: /var/www/myquizz/deploy.sh
set -euo pipefail

APP_DIR=/var/www/myquizz
WEB_ROOT=/var/www/myquizz-web

cd "$APP_DIR"
echo "==> Pulling latest code"
git pull origin main

# Build both sides BEFORE touching production. A failed frontend build must not
# leave a reloaded backend running against a stale frontend.
echo "==> Building backend"
cd "$APP_DIR/backend"
pnpm install --frozen-lockfile
pnpm build

echo "==> Building frontend"
cd "$APP_DIR/frontend"
pnpm install --frozen-lockfile
NODE_OPTIONS=--max-old-space-size=1024 pnpm build

# Both builds succeeded: now publish.
echo "==> Running database migrations"
cd "$APP_DIR/backend"
pnpm db:migrate

echo "==> Reloading API"
pm2 reload myquizz-api --update-env

echo "==> Publishing frontend"
rsync -a --delete "$APP_DIR/frontend/dist/" "$WEB_ROOT/"

echo "==> Deploy completed at $(date '+%Y-%m-%d %H:%M:%S')"
pm2 list
