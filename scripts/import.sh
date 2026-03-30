#!/usr/bin/env bash
set -euo pipefail

API_BASE="${API_BASE:-http://localhost:3000/api}"
CONTAINER="${CONTAINER:-velocal-backend-1}"

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

SOURCES=$(echo "$SOURCES_JSON" | tr -d '[]"' | tr ',' ' ')
ok "Sources: ${SOURCES}"
echo ""

# ── Snapshot log position ──────────────────────
LOG_LINES_BEFORE=$(docker logs "$CONTAINER" 2>&1 | wc -l)

# ── Import each source ─────────────────────────
TOTAL_CREATED=0
TOTAL_UPDATED=0
TOTAL_SKIPPED=0
HAS_ERROR=0

for SOURCE in $SOURCES; do
  info "Importing ${SOURCE}..."
  START=$(date +%s)

  IMPORT_RAW=$(curl -s -w "\n%{http_code}" \
    -X POST "${API_BASE}/import/trigger" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H 'Content-Type: application/json' \
    -d "{\"source\":\"${SOURCE}\"}")

  END=$(date +%s)
  ELAPSED=$((END - START))

  IMPORT_HTTP=$(echo "$IMPORT_RAW" | tail -1)
  IMPORT_JSON=$(echo "$IMPORT_RAW" | sed '$d')

  if [[ "$IMPORT_HTTP" == "409" ]]; then
    MSG=$(echo "$IMPORT_JSON" | grep -o '"message":"[^"]*"' | cut -d'"' -f4)
    warn "${SOURCE}: cooldown — ${MSG}"
    HAS_ERROR=1
    continue
  fi

  if [[ "$IMPORT_HTTP" != "200" && "$IMPORT_HTTP" != "201" ]]; then
    echo -e "  ${RED}✗${NC} ${SOURCE}: HTTP ${IMPORT_HTTP}"
    echo -e "  ${DIM}${IMPORT_JSON}${NC}"
    HAS_ERROR=1
    continue
  fi

  CREATED=$(echo "$IMPORT_JSON" | grep -o '"created":[0-9]*' | cut -d: -f2)
  UPDATED=$(echo "$IMPORT_JSON" | grep -o '"updated":[0-9]*' | cut -d: -f2)
  SKIPPED=$(echo "$IMPORT_JSON" | grep -o '"skipped":[0-9]*' | cut -d: -f2)

  CREATED=${CREATED:-0}; UPDATED=${UPDATED:-0}; SKIPPED=${SKIPPED:-0}
  TOTAL_CREATED=$((TOTAL_CREATED + CREATED))
  TOTAL_UPDATED=$((TOTAL_UPDATED + UPDATED))
  TOTAL_SKIPPED=$((TOTAL_SKIPPED + SKIPPED))

  if [[ "$CREATED" -eq 0 && "$UPDATED" -eq 0 && "$SKIPPED" -eq 0 ]]; then
    warn "${SOURCE}: 0 created, 0 updated, 0 skipped (${ELAPSED}s) — possibly failed, check logs below"
    HAS_ERROR=1
  else
    ok "${SOURCE}: ${CREATED} created, ${UPDATED} updated, ${SKIPPED} skipped (${ELAPSED}s)"
  fi
done

# ── Summary ────────────────────────────────────
echo ""
echo "─────────────────────────"
echo -e "  Created: ${GREEN}${TOTAL_CREATED}${NC}"
echo -e "  Updated: ${YELLOW}${TOTAL_UPDATED}${NC}"
echo -e "  Skipped: ${TOTAL_SKIPPED}"
echo ""

# ── Show backend logs if something looks wrong ─
if [[ "$HAS_ERROR" -eq 1 ]]; then
  warn "Something may have gone wrong. Backend logs since import started:"
  echo ""
  docker logs "$CONTAINER" 2>&1 | tail -n +"$((LOG_LINES_BEFORE + 1))" | \
    grep -iE "error|warn|fail|exception|HasMore" --color=always || \
    echo -e "  ${DIM}(no errors/warnings found in logs)${NC}"
  echo ""
fi
