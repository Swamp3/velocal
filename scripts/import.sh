#!/usr/bin/env bash
set -euo pipefail

API_BASE="${API_BASE:-http://localhost:3000/api}"
CONTAINER="${CONTAINER:-velocal-backend}"
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

TOKEN=$(echo "$LOGIN_JSON" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
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

# ── Snapshot log position ──────────────────────
CAN_READ_LOGS=0
if docker inspect "$CONTAINER" &>/dev/null; then
  LOG_LINES_BEFORE=$(docker logs "$CONTAINER" 2>&1 | wc -l)
  CAN_READ_LOGS=1
fi

# ── Trigger import ─────────────────────────────
if [[ -n "$SOURCE" ]]; then
  IMPORT_BODY="{\"source\":\"${SOURCE}\"}"
  info "Triggering import (source: ${SOURCE})..."
else
  IMPORT_BODY='{}'
  info "Triggering import (all sources)..."
fi
START=$(date +%s)

IMPORT_RAW=$(curl -s -w "\n%{http_code}" \
  -X POST "${API_BASE}/import/trigger" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H 'Content-Type: application/json' \
  -d "$IMPORT_BODY")

END=$(date +%s)
ELAPSED=$((END - START))

IMPORT_HTTP=$(echo "$IMPORT_RAW" | tail -1)
IMPORT_JSON=$(echo "$IMPORT_RAW" | sed '$d')

if [[ "$IMPORT_HTTP" == "409" ]]; then
  MSG=$(echo "$IMPORT_JSON" | grep -o '"message":"[^"]*"' | cut -d'"' -f4)
  warn "Import on cooldown: ${MSG}"
  exit 1
fi

if [[ "$IMPORT_HTTP" != "200" && "$IMPORT_HTTP" != "201" ]]; then
  echo -e "${DIM}${IMPORT_JSON}${NC}"
  fail "Import failed (HTTP ${IMPORT_HTTP})"
fi

CREATED=$(echo "$IMPORT_JSON" | grep -o '"created":[0-9]*' | cut -d: -f2)
UPDATED=$(echo "$IMPORT_JSON" | grep -o '"updated":[0-9]*' | cut -d: -f2)
SKIPPED=$(echo "$IMPORT_JSON" | grep -o '"skipped":[0-9]*' | cut -d: -f2)

CREATED=${CREATED:-0}; UPDATED=${UPDATED:-0}; SKIPPED=${SKIPPED:-0}
HAS_ERROR=0

if [[ "$CREATED" -eq 0 && "$UPDATED" -eq 0 && "$SKIPPED" -eq 0 ]]; then
  HAS_ERROR=1
fi

# ── Summary ────────────────────────────────────
echo ""
echo "─────────────────────────"

if [[ "$HAS_ERROR" -eq 1 ]]; then
  warn "Import returned 0/0/0 (${ELAPSED}s) — possibly failed"
else
  ok "Import complete in ${ELAPSED}s"
fi

echo ""
echo -e "  Created: ${GREEN}${CREATED}${NC}"
echo -e "  Updated: ${YELLOW}${UPDATED}${NC}"
echo -e "  Skipped: ${SKIPPED}"
echo ""

# ── Show backend logs if something looks wrong ─
if [[ "$HAS_ERROR" -eq 1 && "$CAN_READ_LOGS" -eq 1 ]]; then
  warn "Backend logs since import started:"
  echo ""
  docker logs "$CONTAINER" 2>&1 | tail -n +"$((LOG_LINES_BEFORE + 1))" | \
    grep -iE "error|warn|fail|exception|HasMore" --color=always || \
    echo -e "  ${DIM}(no errors/warnings found in logs)${NC}"
  echo ""
fi
