#!/bin/sh
set -eu

PROJECT_ROOT="${PROJECT_ROOT:-/www/wwwroot/erp.hyfsmes.com}"
FRONTEND_DIR="${FRONTEND_DIR:-$PROJECT_ROOT/frontend}"
BACKEND_DIR="${BACKEND_DIR:-$PROJECT_ROOT/backend}"
FRONTEND_DIST="${FRONTEND_DIST:-$FRONTEND_DIR/dist}"
WEB_ROOT="${WEB_ROOT:-/www/wwwroot/erp.hyfsmes.com}"
PM2_APP_NAME="${PM2_APP_NAME:-erp-backend}"
ENABLE_GIT_PULL="${ENABLE_GIT_PULL:-1}"
ENABLE_GIT_PUSH="${ENABLE_GIT_PUSH:-0}"
GIT_BRANCH="${GIT_BRANCH:-main}"

cd "$PROJECT_ROOT"

if [ "$ENABLE_GIT_PULL" = "1" ]; then
  echo "[deploy-full] git pull origin $GIT_BRANCH"
  git fetch --all --prune
  git checkout "$GIT_BRANCH"
  git pull --ff-only origin "$GIT_BRANCH"
fi

if [ "$ENABLE_GIT_PUSH" = "1" ]; then
  echo "[deploy-full] git push origin $GIT_BRANCH"
  git push origin "$GIT_BRANCH"
fi

echo "[deploy-full] start backend"
cd "$BACKEND_DIR"
npm install --include=dev
npm run build
if pm2 describe "$PM2_APP_NAME" >/dev/null 2>&1; then
  pm2 restart "$PM2_APP_NAME"
else
  pm2 start dist/main.js --name "$PM2_APP_NAME"
fi
pm2 save

echo "[deploy-full] start frontend"
cd "$FRONTEND_DIR"
npm install --include=dev
npm run build

if [ ! -d "$FRONTEND_DIST" ]; then
  echo "[deploy-full] build failed: frontend dist not found"
  exit 1
fi

cp -r "$FRONTEND_DIST"/. "$WEB_ROOT"/
echo "[deploy-full] published frontend to $WEB_ROOT"
pm2 status "$PM2_APP_NAME"
pm2 logs "$PM2_APP_NAME" --lines 50 --nostream
echo "[deploy-full] done"
