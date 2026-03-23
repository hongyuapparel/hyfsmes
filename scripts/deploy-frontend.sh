#!/bin/sh
set -eu

PROJECT_ROOT="/www/wwwroot/erp.hyfsmes.com/hyfsmes"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
FRONTEND_DIST="$FRONTEND_DIR/dist"
WEB_ROOT="/www/wwwroot/erp.hyfsmes.com"

echo "[deploy-frontend] start"
cd "$FRONTEND_DIR"
npm install
npm run build

if [ ! -d "$FRONTEND_DIST" ]; then
  echo "[deploy-frontend] build failed: dist not found"
  exit 1
fi

cp -r "$FRONTEND_DIST"/. "$WEB_ROOT"/
echo "[deploy-frontend] done"

