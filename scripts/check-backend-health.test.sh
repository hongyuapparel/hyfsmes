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

run_delayed_success_case() (
  health_test_counter_file="$SCRIPT_DIR/.health-test-counter.$$"
  trap 'rm -f "$health_test_counter_file"' EXIT
  printf '%s\n' 0 >"$health_test_counter_file"
  curl() {
    health_test_calls="$(cat "$health_test_counter_file")"
    health_test_calls=$((health_test_calls + 1))
    printf '%s\n' "$health_test_calls" >"$health_test_counter_file"
    if [ "$health_test_calls" -le 4 ]; then
      return 7
    fi
    case "$*" in
      *'/health/db'*) printf '%s' '{"status":"ok","db":"connected"}' ;;
      *) printf '%s' '{"status":"ok"}' ;;
    esac
  }
  sleep() { :; }
  pm2() { :; }

  BACKEND_HEALTH_ATTEMPTS=3
  . "$SCRIPT_DIR/check-backend-health.sh"
  check_backend_health erp-backend
)

run_success_case
run_delayed_success_case
run_failure_case
echo 'check-backend-health tests passed'
