#!/usr/bin/env bash
# Deploy MyQuizz on the VPS. Run it as: bash /var/www/myquizz/deploy.sh
set -euo pipefail

APP_DIR=/var/www/myquizz
WEB_ROOT=/var/www/myquizz-web
BRANCH=main

# Stage 1: force the working tree to match origin, then hand over to the version
# of this script that was just fetched.
#
# git reset --hard is used instead of git pull on purpose. The server working
# tree is disposable: git is the only source of truth here, so a stray local
# edit (even something as small as a changed file mode) must never be able to
# abort an automated deploy. Anything not committed is discarded.
#
# Bash also reads a script incrementally while running it, so rewriting this
# very file mid-run can make bash resume at a wrong byte offset. Re-exec after
# syncing avoids that and guarantees the newest deploy logic is the one used.
if [ "${MYQUIZZ_DEPLOY_STAGE:-}" != "run" ]; then
  cd "$APP_DIR"
  echo "==> Syncing with origin/$BRANCH"
  git fetch origin "$BRANCH"

  if ! git diff --quiet HEAD || ! git diff --cached --quiet; then
    echo "    Local modifications found, discarding them:"
    git status --porcelain
  fi

  git reset --hard "origin/$BRANCH"
  echo "    Now at $(git rev-parse --short HEAD) $(git log -1 --pretty=%s)"

  export MYQUIZZ_DEPLOY_STAGE=run
  exec bash "$APP_DIR/deploy.sh" "$@"
fi

# Stage 2: build everything BEFORE touching production. A failed frontend build
# must not leave a reloaded backend running against a stale frontend.
echo "==> Building backend"
cd "$APP_DIR/backend"
# --prod=false is required rather than cosmetic: NODE_ENV is production on this
# box, so a plain install resolves to dependencies only and typescript is a
# devDependency. Without this flag the build below dies with "tsc: not found".
pnpm install --frozen-lockfile --prod=false
pnpm build

echo "==> Building frontend"
cd "$APP_DIR/frontend"
# Same reason: the frontend build tooling also lives in devDependencies.
pnpm install --frozen-lockfile --prod=false
NODE_OPTIONS=--max-old-space-size=1024 pnpm build

# Both builds succeeded: now publish.
#
# Migrations run from the compiled output, never through tsx. tsx is a
# devDependency, so keeping it out of the production run path means a future
# production-only install cannot break the deploy.
echo "==> Running database migrations"
cd "$APP_DIR/backend"
pnpm db:migrate:prod

# Give the ranking columns a value before traffic arrives. The backfill in
# migration 005 fills question_count and play_count but deliberately not
# hot_score, so without this step the feed sorts by "hot_score desc, id desc"
# while every score is still 0, which silently degrades to newest-first. The
# in-app scheduler repairs it seconds after boot, but not when
# SCORING_INTERVAL_MINUTES=0.
echo "==> Scoring quizzes"
pnpm db:score:prod

# startOrReload keeps the very first deploy working: plain reload fails when the
# process does not exist yet, while start fails when it already does.
echo "==> Starting or reloading API"
pm2 startOrReload "$APP_DIR/ecosystem.config.cjs" --update-env
# Persist the process list so pm2 resurrects the app after a server reboot.
pm2 save

echo "==> Publishing frontend"
rsync -a --delete "$APP_DIR/frontend/dist/" "$WEB_ROOT/"

echo "==> Deploy completed at $(date '+%Y-%m-%d %H:%M:%S')"
pm2 list
