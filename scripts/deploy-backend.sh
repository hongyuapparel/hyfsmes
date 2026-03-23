#!/bin/sh
set -eu

PROJECT_ROOT="/www/wwwroot/erp.hyfsmes.com/hyfsmes"
BACKEND_DIR="$PROJECT_ROOT/backend"
PM2_APP_NAME="erp-backend"

echo "[deploy-backend] start"
cd "$BACKEND_DIR"
npm install
npm run build
pm2 restart "$PM2_APP_NAME"
pm2 logs "$PM2_APP_NAME" --lines 50
echo "[deploy-backend] done"

