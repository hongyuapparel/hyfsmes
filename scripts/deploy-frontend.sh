#!/bin/sh
set -eu

PROJECT_ROOT="${PROJECT_ROOT:-/www/wwwroot/erp.hyfsmes.com}"
FRONTEND_DIR="${FRONTEND_DIR:-$PROJECT_ROOT/frontend}"
FRONTEND_DIST="${FRONTEND_DIST:-$FRONTEND_DIR/dist}"
WEB_ROOT="${WEB_ROOT:-/www/wwwroot/erp.hyfsmes.com}"
ENABLE_GIT_PULL="${ENABLE_GIT_PULL:-1}"
ENABLE_GIT_PUSH="${ENABLE_GIT_PUSH:-0}"
GIT_BRANCH="${GIT_BRANCH:-main}"

echo "[deploy-frontend] start"
cd "$PROJECT_ROOT"

if [ "$ENABLE_GIT_PULL" = "1" ]; then
  echo "[deploy-frontend] git pull origin $GIT_BRANCH"
  git fetch --all --prune
  git checkout "$GIT_BRANCH"
  git pull --ff-only origin "$GIT_BRANCH"
fi

if [ "$ENABLE_GIT_PUSH" = "1" ]; then
  echo "[deploy-frontend] git push origin $GIT_BRANCH"
  git push origin "$GIT_BRANCH"
fi

cd "$FRONTEND_DIR"
npm install
npm run build

if [ ! -d "$FRONTEND_DIST" ]; then
  echo "[deploy-frontend] build failed: dist not found"
  exit 1
fi

cp -r "$FRONTEND_DIST"/. "$WEB_ROOT"/
echo "[deploy-frontend] published to $WEB_ROOT"
echo "[deploy-frontend] done"
