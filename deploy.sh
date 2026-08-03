#!/usr/bin/env bash
# Deploy MyQuizz on the VPS. Run it as: /var/www/myquizz/deploy.sh
set -euo pipefail

APP_DIR=/var/www/myquizz
WEB_ROOT=/var/www/myquizz-web

# Stage 1: refresh the repository, then hand over to the version of this script
# that was just pulled.
#
# Bash reads a script incrementally while running it, so a git pull that
# rewrites this very file mid-run can make bash resume at a wrong byte offset
# and execute garbage. Re-exec after pulling avoids that entirely and also
# means every deploy uses the newest deploy logic, not the one from last week.
if [ "${MYQUIZZ_DEPLOY_STAGE:-}" != "run" ]; then
  cd "$APP_DIR"
  echo "==> Pulling latest code"
  git pull origin main

  export MYQUIZZ_DEPLOY_STAGE=run
  exec bash "$APP_DIR/deploy.sh" "$@"
fi

# Stage 2: build everything BEFORE touching production. A failed frontend build
# must not leave a reloaded backend running against a stale frontend.
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
