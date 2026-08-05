#!/bin/sh

# Shared post-restart health check for backend and full deployments.
# Historical PM2 error logs are printed only when the new process fails health checks.
check_backend_health() {
  health_app_name="$1"
  health_base_url="${BACKEND_HEALTH_BASE_URL:-http://127.0.0.1:3000}"
  # Production startup runs schema guards and seed checks before Nest begins
  # listening. Give that bootstrap work up to two minutes before declaring the
  # deployment unhealthy.
  health_attempts="${BACKEND_HEALTH_ATTEMPTS:-60}"
  health_delay_seconds="${BACKEND_HEALTH_DELAY_SECONDS:-2}"
  health_attempt=1

  while [ "$health_attempt" -le "$health_attempts" ]; do
    health_body="$(curl --fail --silent --max-time 5 "$health_base_url/health" 2>/dev/null || true)"
    health_db_body="$(curl --fail --silent --max-time 5 "$health_base_url/health/db" 2>/dev/null || true)"

    case "$health_body" in
      *'"status":"ok"'*) health_api_ok=1 ;;
      *) health_api_ok=0 ;;
    esac
    case "$health_db_body" in
      *'"status":"ok"'*) health_db_status_ok=1 ;;
      *) health_db_status_ok=0 ;;
    esac
    case "$health_db_body" in
      *'"db":"connected"'*) health_db_connected=1 ;;
      *) health_db_connected=0 ;;
    esac

    if [ "$health_api_ok" = "1" ] && [ "$health_db_status_ok" = "1" ] && [ "$health_db_connected" = "1" ]; then
      echo "[health] backend and database are ready"
      return 0
    fi

    echo "[health] waiting for backend ($health_attempt/$health_attempts)"
    health_attempt=$((health_attempt + 1))
    sleep "$health_delay_seconds"
  done

  echo "[health] backend failed readiness checks: $health_base_url/health and /health/db" >&2
  echo "[health] last /health response: ${health_body:-<empty>}" >&2
  echo "[health] last /health/db response: ${health_db_body:-<empty>}" >&2
  pm2 status "$health_app_name" || true
  echo "[health] PM2 history follows for context; entries may predate this deployment" >&2
  pm2 logs "$health_app_name" --lines 50 --nostream --timestamp || true
  return 1
}
