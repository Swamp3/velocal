#!/usr/bin/env bash
# Import a JSON file of events that was collected outside the app.
# Usage: ./scripts/import-file.sh events.json
# Format: see docs/IMPORTING.md ("Importing your own data").
set -euo pipefail

API_BASE="${API_BASE:-http://localhost:3000/api}"
POLL_INTERVAL="${POLL_INTERVAL:-2}"
POLL_TIMEOUT="${POLL_TIMEOUT:-600}"
FILE="${1:-}"

[[ -n "$FILE" && -r "$FILE" ]] || { echo "Usage: $0 events.json" >&2; exit 1; }

json_field() { echo "$1" | grep -o "\"$2\":\"[^\"]*\"" | head -1 | cut -d'"' -f4; }
json_number() { echo "$1" | grep -o "\"$2\":[0-9]*" | head -1 | cut -d: -f2; }

echo "VeloCal event import: ${FILE} → ${API_BASE}"
read -rp "Admin email: " EMAIL
read -rsp "Password: " PASSWORD
echo

LOGIN=$(curl -s -w "\n%{http_code}" "${API_BASE}/auth/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}")
[[ "$(echo "$LOGIN" | tail -1)" == "200" ]] || { echo "Login failed" >&2; exit 1; }
TOKEN=$(json_field "$(echo "$LOGIN" | sed '$d')" accessToken)

RESP=$(curl -s -w "\n%{http_code}" -X POST "${API_BASE}/import/events" \
  -H "Authorization: Bearer ${TOKEN}" -H 'Content-Type: application/json' --data-binary "@${FILE}")
HTTP=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
if [[ "$HTTP" == "400" ]]; then
  echo "The file has errors, nothing was imported:" >&2
  echo "$BODY" | python3 -c 'import sys,json; [print(" -", m) for m in json.load(sys.stdin).get("message", [])]' 2>/dev/null || echo "$BODY" >&2
  exit 1
fi
[[ "$HTTP" == "202" ]] || { echo "Import not started (HTTP ${HTTP}): ${BODY}" >&2; exit 1; }

JOB=$(json_field "$BODY" id)
STATUS=running; WAITED=0
while [[ "$STATUS" == "running" ]]; do
  sleep "$POLL_INTERVAL"; WAITED=$((WAITED + POLL_INTERVAL))
  (( WAITED > POLL_TIMEOUT )) && { echo "Timed out waiting for job ${JOB}" >&2; exit 1; }
  JOB_JSON=$(curl -s "${API_BASE}/import/jobs/${JOB}" -H "Authorization: Bearer ${TOKEN}")
  STATUS=$(json_field "$JOB_JSON" status); STATUS=${STATUS:-running}
done

[[ "$STATUS" == "completed" ]] || { echo "Import failed: $(json_field "$JOB_JSON" error)" >&2; exit 1; }
echo "Done. Created: $(json_number "$JOB_JSON" created), updated: $(json_number "$JOB_JSON" updated), skipped: $(json_number "$JOB_JSON" skipped)"
