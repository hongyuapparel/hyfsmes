#!/bin/sh
set -eu

PROJECT_ROOT="/www/wwwroot/erp.hyfsmes.com/hyfsmes"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
BACKEND_DIR="$PROJECT_ROOT/backend"
FRONTEND_DIST="$FRONTEND_DIR/dist"
WEB_ROOT="/www/wwwroot/erp.hyfsmes.com"
PM2_APP_NAME="erp-backend"

echo "[deploy-full] start backend"
cd "$BACKEND_DIR"
npm install
npm run build
pm2 restart "$PM2_APP_NAME"

echo "[deploy-full] start frontend"
cd "$FRONTEND_DIR"
npm install
npm run build

if [ ! -d "$FRONTEND_DIST" ]; then
  echo "[deploy-full] build failed: frontend dist not found"
  exit 1
fi

cp -r "$FRONTEND_DIST"/. "$WEB_ROOT"/
pm2 logs "$PM2_APP_NAME" --lines 50
echo "[deploy-full] done"
