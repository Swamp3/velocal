#!/usr/bin/env bash
set -euo pipefail

API_BASE="${API_BASE:-http://localhost:3000/api}"
CONTAINER="${CONTAINER:-velocal-backend}"
POLL_INTERVAL="${POLL_INTERVAL:-2}"
POLL_TIMEOUT="${POLL_TIMEOUT:-1800}"
SOURCE="${1:-}"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
DIM='\033[2m'
NC='\033[0m'

info()  { echo -e "${CYAN}▸${NC} $1"; }
ok()    { echo -e "${GREEN}✓${NC} $1"; }
warn()  { echo -e "${YELLOW}⚠${NC} $1"; }
fail()  { echo -e "${RED}✗${NC} $1"; exit 1; }

LOG_PID=""
cleanup() {
  if [[ -n "$LOG_PID" ]] && kill -0 "$LOG_PID" 2>/dev/null; then
    kill "$LOG_PID" 2>/dev/null || true
    wait "$LOG_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

json_field() {
  local json="$1" key="$2"
  echo "$json" | grep -o "\"${key}\":\"[^\"]*\"" | head -1 | cut -d'"' -f4
}

json_number() {
  local json="$1" key="$2"
  echo "$json" | grep -o "\"${key}\":[0-9]*" | head -1 | cut -d: -f2
}

echo ""
echo -e "${CYAN}VeloCal Import${NC}"
echo "─────────────────────────"
echo -e "  API: ${DIM}${API_BASE}${NC}"
if [[ -n "$SOURCE" ]]; then
  echo -e "  Source: ${CYAN}${SOURCE}${NC}"
fi
echo ""

read -rp "Email: " EMAIL
read -rsp "Password: " PASSWORD
echo ""
echo ""

# ── Login ──────────────────────────────────────
info "Logging in as ${EMAIL}..."
LOGIN_BODY=$(curl -s -w "\n%{http_code}" \
  "${API_BASE}/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}")

LOGIN_HTTP=$(echo "$LOGIN_BODY" | tail -1)
LOGIN_JSON=$(echo "$LOGIN_BODY" | sed '$d')

if [[ "$LOGIN_HTTP" != "200" ]]; then
  echo -e "${DIM}${LOGIN_JSON}${NC}"
  fail "Login failed (HTTP ${LOGIN_HTTP})"
fi

TOKEN=$(json_field "$LOGIN_JSON" "accessToken")
if [[ -z "$TOKEN" ]]; then
  fail "Login response did not contain a token."
fi
ok "Logged in successfully"
echo ""

# ── Sources ────────────────────────────────────
info "Fetching available sources..."
SOURCES_RAW=$(curl -s -w "\n%{http_code}" \
  "${API_BASE}/import/sources" \
  -H "Authorization: Bearer ${TOKEN}")

SOURCES_HTTP=$(echo "$SOURCES_RAW" | tail -1)
SOURCES_JSON=$(echo "$SOURCES_RAW" | sed '$d')

if [[ "$SOURCES_HTTP" != "200" ]]; then
  echo -e "${DIM}${SOURCES_JSON}${NC}"
  fail "Failed to fetch sources (HTTP ${SOURCES_HTTP})"
fi

ok "Sources: ${SOURCES_JSON}"
echo ""

# ── Trigger import ─────────────────────────────
if [[ -n "$SOURCE" ]]; then
  IMPORT_BODY="{\"source\":\"${SOURCE}\"}"
  info "Triggering import (source: ${SOURCE})..."
else
  IMPORT_BODY='{}'
  info "Triggering import (all sources)..."
fi
START=$(date +%s)

TRIGGER_RAW=$(curl -s -w "\n%{http_code}" \
  -X POST "${API_BASE}/import/trigger" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H 'Content-Type: application/json' \
  -d "$IMPORT_BODY")

TRIGGER_HTTP=$(echo "$TRIGGER_RAW" | tail -1)
TRIGGER_JSON=$(echo "$TRIGGER_RAW" | sed '$d')

if [[ "$TRIGGER_HTTP" == "409" ]]; then
  MSG=$(json_field "$TRIGGER_JSON" "message")
  warn "Import on cooldown: ${MSG}"
  exit 1
fi

if [[ "$TRIGGER_HTTP" != "200" && "$TRIGGER_HTTP" != "201" && "$TRIGGER_HTTP" != "202" ]]; then
  echo -e "${DIM}${TRIGGER_JSON}${NC}"
  fail "Failed to start import (HTTP ${TRIGGER_HTTP})"
fi

JOB_ID=$(json_field "$TRIGGER_JSON" "id")
if [[ -z "$JOB_ID" ]]; then
  echo -e "${DIM}${TRIGGER_JSON}${NC}"
  fail "Trigger response did not contain a job id"
fi

ok "Job started: ${JOB_ID}"
echo ""

# ── Tail logs live (if docker container available) ─
if docker inspect "$CONTAINER" &>/dev/null; then
  info "Tailing backend logs (${CONTAINER})..."
  echo -e "${DIM}─────────────────────────${NC}"
  docker logs -f --since 1s "$CONTAINER" 2>&1 | sed "s/^/${DIM}│${NC} /" &
  LOG_PID=$!
fi

# ── Poll job status ────────────────────────────
STATUS="running"
JOB_JSON=""
ELAPSED_POLL=0
while [[ "$STATUS" == "running" ]]; do
  sleep "$POLL_INTERVAL"
  ELAPSED_POLL=$((ELAPSED_POLL + POLL_INTERVAL))
  if (( ELAPSED_POLL > POLL_TIMEOUT )); then
    cleanup
    fail "Timed out after ${POLL_TIMEOUT}s waiting for job ${JOB_ID}"
  fi

  JOB_RAW=$(curl -s -w "\n%{http_code}" \
    "${API_BASE}/import/jobs/${JOB_ID}" \
    -H "Authorization: Bearer ${TOKEN}")
  JOB_HTTP=$(echo "$JOB_RAW" | tail -1)
  JOB_JSON=$(echo "$JOB_RAW" | sed '$d')

  if [[ "$JOB_HTTP" != "200" ]]; then
    continue
  fi

  STATUS=$(json_field "$JOB_JSON" "status")
  [[ -z "$STATUS" ]] && STATUS="running"
done

cleanup
LOG_PID=""

END=$(date +%s)
ELAPSED=$((END - START))

echo ""
echo -e "${DIM}─────────────────────────${NC}"
echo ""

if [[ "$STATUS" == "failed" ]]; then
  ERROR_MSG=$(json_field "$JOB_JSON" "error")
  fail "Import failed: ${ERROR_MSG:-unknown error}"
fi

CREATED=$(json_number "$JOB_JSON" "created")
UPDATED=$(json_number "$JOB_JSON" "updated")
SKIPPED=$(json_number "$JOB_JSON" "skipped")
CREATED=${CREATED:-0}; UPDATED=${UPDATED:-0}; SKIPPED=${SKIPPED:-0}

if [[ "$CREATED" -eq 0 && "$UPDATED" -eq 0 && "$SKIPPED" -eq 0 ]]; then
  warn "Import returned 0/0/0 (${ELAPSED}s) — possibly no events fetched"
else
  ok "Import complete in ${ELAPSED}s"
fi

echo ""
echo -e "  Created: ${GREEN}${CREATED}${NC}"
echo -e "  Updated: ${YELLOW}${UPDATED}${NC}"
echo -e "  Skipped: ${SKIPPED}"
echo ""
