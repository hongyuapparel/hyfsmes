#!/bin/sh
set -eu

case "$0" in
  */*) SCRIPT_DIR=${0%/*} ;;
  *) SCRIPT_DIR=. ;;
esac
SCRIPT_DIR="$(CDPATH= cd -- "$SCRIPT_DIR" && pwd)"

run_success_case() (
  curl() {
    case "$*" in
      *'/health/db'*) printf '%s' '{"status":"ok","db":"connected"}' ;;
      *) printf '%s' '{"status":"ok"}' ;;
    esac
  }
  sleep() { :; }
  pm2() { :; }

  BACKEND_HEALTH_ATTEMPTS=1
  . "$SCRIPT_DIR/check-backend-health.sh"
  check_backend_health erp-backend
)

run_failure_case() (
  curl() { return 22; }
  sleep() { :; }
  pm2() { printf 'pm2-diagnostic:%s\n' "$1"; }

  BACKEND_HEALTH_ATTEMPTS=2
  . "$SCRIPT_DIR/check-backend-health.sh"
  if check_backend_health erp-backend; then
    echo 'expected health check to fail' >&2
    return 1
  fi
)

run_success_case
run_failure_case
echo 'check-backend-health tests passed'
