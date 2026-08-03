#!/bin/sh
set -eu

PROJECT_ROOT="${PROJECT_ROOT:-/www/wwwroot/erp.hyfsmes.com}"
BACKEND_DIR="${BACKEND_DIR:-$PROJECT_ROOT/backend}"
PM2_APP_NAME="${PM2_APP_NAME:-erp-backend}"
ENABLE_GIT_PULL="${ENABLE_GIT_PULL:-1}"
ENABLE_GIT_PUSH="${ENABLE_GIT_PUSH:-0}"
GIT_BRANCH="${GIT_BRANCH:-main}"

echo "[deploy-backend] start"
cd "$PROJECT_ROOT"

if [ "$ENABLE_GIT_PULL" = "1" ]; then
  echo "[deploy-backend] git pull origin $GIT_BRANCH"
  git fetch --all --prune
  git checkout "$GIT_BRANCH"
  git pull --ff-only origin "$GIT_BRANCH"
fi

if [ "$ENABLE_GIT_PUSH" = "1" ]; then
  echo "[deploy-backend] git push origin $GIT_BRANCH"
  git push origin "$GIT_BRANCH"
fi

. "$PROJECT_ROOT/scripts/check-backend-health.sh"

cd "$BACKEND_DIR"
npm install --include=dev
npm run build
if pm2 describe "$PM2_APP_NAME" >/dev/null 2>&1; then
  pm2 restart "$PM2_APP_NAME"
else
  pm2 start dist/main.js --name "$PM2_APP_NAME"
fi
pm2 save
check_backend_health "$PM2_APP_NAME"
pm2 status "$PM2_APP_NAME"
echo "[deploy-backend] done"
