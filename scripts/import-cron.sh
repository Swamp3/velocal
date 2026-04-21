#!/usr/bin/env bash
set -euo pipefail

# ──────────────────────────────────────────────
# VeloCal — Non-interactive import (for cron)
# ──────────────────────────────────────────────
# Runs an import without prompting. Credentials are read from environment
# variables or from a config file passed via $VELOCAL_CRON_ENV.
#
# Required env vars (or config file keys):
#   VELOCAL_EMAIL     — admin email
#   VELOCAL_PASSWORD  — admin password
#
# Optional:
#   API_BASE          — backend API base URL (default http://localhost:3000/api)
#   VELOCAL_SOURCE    — specific source to import; omit to import all
#   POLL_INTERVAL     — seconds between status polls (default 5)
#   POLL_TIMEOUT      — max seconds to wait (default 1800)
#   VELOCAL_CRON_ENV  — path to an env file with the above variables
#
# Exit codes:
#   0  — import completed successfully
#   1  — import failed
#   2  — misconfiguration (missing credentials, etc.)

# Load config file if provided
if [[ -n "${VELOCAL_CRON_ENV:-}" && -f "${VELOCAL_CRON_ENV}" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "${VELOCAL_CRON_ENV}"
  set +a
fi

API_BASE="${API_BASE:-http://localhost:3000/api}"
POLL_INTERVAL="${POLL_INTERVAL:-5}"
POLL_TIMEOUT="${POLL_TIMEOUT:-1800}"
SOURCE="${VELOCAL_SOURCE:-${1:-}}"
EMAIL="${VELOCAL_EMAIL:-}"
PASSWORD="${VELOCAL_PASSWORD:-}"

log() { echo "[$(date -u +'%Y-%m-%dT%H:%M:%SZ')] $1"; }
die() { log "ERROR: $1"; exit "${2:-1}"; }

if [[ -z "$EMAIL" || -z "$PASSWORD" ]]; then
  die "VELOCAL_EMAIL and VELOCAL_PASSWORD must be set (via env or VELOCAL_CRON_ENV file)." 2
fi

json_field() {
  local json="$1" key="$2"
  echo "$json" | grep -o "\"${key}\":\"[^\"]*\"" | head -1 | cut -d'"' -f4
}

json_number() {
  local json="$1" key="$2"
  echo "$json" | grep -o "\"${key}\":[0-9]*" | head -1 | cut -d: -f2
}

log "VeloCal import starting (API=${API_BASE}, source=${SOURCE:-all})"

# ── Login ──────────────────────────────────────
LOGIN_BODY=$(curl -fsS -w "\n%{http_code}" \
  "${API_BASE}/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}" || true)

LOGIN_HTTP=$(echo "$LOGIN_BODY" | tail -1)
LOGIN_JSON=$(echo "$LOGIN_BODY" | sed '$d')

if [[ "$LOGIN_HTTP" != "200" ]]; then
  die "Login failed (HTTP ${LOGIN_HTTP}): ${LOGIN_JSON}"
fi

TOKEN=$(json_field "$LOGIN_JSON" "accessToken")
[[ -z "$TOKEN" ]] && die "Login response did not contain an accessToken"
log "Logged in as ${EMAIL}"

# ── Trigger import ─────────────────────────────
if [[ -n "$SOURCE" ]]; then
  IMPORT_BODY="{\"source\":\"${SOURCE}\"}"
else
  IMPORT_BODY='{}'
fi

START=$(date +%s)
TRIGGER_RAW=$(curl -sS -w "\n%{http_code}" \
  -X POST "${API_BASE}/import/trigger" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H 'Content-Type: application/json' \
  -d "$IMPORT_BODY")

TRIGGER_HTTP=$(echo "$TRIGGER_RAW" | tail -1)
TRIGGER_JSON=$(echo "$TRIGGER_RAW" | sed '$d')

if [[ "$TRIGGER_HTTP" == "409" ]]; then
  MSG=$(json_field "$TRIGGER_JSON" "message")
  log "Import on cooldown or already running: ${MSG}"
  exit 1
fi

if [[ "$TRIGGER_HTTP" != "200" && "$TRIGGER_HTTP" != "201" && "$TRIGGER_HTTP" != "202" ]]; then
  die "Failed to start import (HTTP ${TRIGGER_HTTP}): ${TRIGGER_JSON}"
fi

JOB_ID=$(json_field "$TRIGGER_JSON" "id")
[[ -z "$JOB_ID" ]] && die "Trigger response did not contain a job id: ${TRIGGER_JSON}"
log "Job started: ${JOB_ID}"

# ── Poll job status ────────────────────────────
STATUS="running"
JOB_JSON=""
ELAPSED_POLL=0
while [[ "$STATUS" == "running" ]]; do
  sleep "$POLL_INTERVAL"
  ELAPSED_POLL=$((ELAPSED_POLL + POLL_INTERVAL))
  if (( ELAPSED_POLL > POLL_TIMEOUT )); then
    die "Timed out after ${POLL_TIMEOUT}s waiting for job ${JOB_ID}"
  fi

  JOB_RAW=$(curl -sS -w "\n%{http_code}" \
    "${API_BASE}/import/jobs/${JOB_ID}" \
    -H "Authorization: Bearer ${TOKEN}" || true)
  JOB_HTTP=$(echo "$JOB_RAW" | tail -1)
  JOB_JSON=$(echo "$JOB_RAW" | sed '$d')

  [[ "$JOB_HTTP" != "200" ]] && continue

  STATUS=$(json_field "$JOB_JSON" "status")
  [[ -z "$STATUS" ]] && STATUS="running"
done

END=$(date +%s)
ELAPSED=$((END - START))

if [[ "$STATUS" == "failed" ]]; then
  ERROR_MSG=$(json_field "$JOB_JSON" "error")
  die "Import failed after ${ELAPSED}s: ${ERROR_MSG:-unknown error}"
fi

CREATED=$(json_number "$JOB_JSON" "created"); CREATED=${CREATED:-0}
UPDATED=$(json_number "$JOB_JSON" "updated"); UPDATED=${UPDATED:-0}
SKIPPED=$(json_number "$JOB_JSON" "skipped"); SKIPPED=${SKIPPED:-0}

log "Import complete in ${ELAPSED}s — created=${CREATED} updated=${UPDATED} skipped=${SKIPPED}"
exit 0
