#!/usr/bin/env bash
# Check and import a JSON file of events collected outside the app.
# Usage: ./scripts/import-file.sh events.json
# Format: docs/IMPORT-FILE-FORMAT.md. The admin page (Admin → Imports → Import file) does the same.
set -euo pipefail

API_BASE="${API_BASE:-http://localhost:3000/api}"
POLL_INTERVAL="${POLL_INTERVAL:-2}"
POLL_TIMEOUT="${POLL_TIMEOUT:-1800}"
FILE="${1:-}"

[[ -n "$FILE" && -r "$FILE" ]] || { echo "Usage: $0 events.json" >&2; exit 1; }
command -v python3 >/dev/null || { echo "python3 is required" >&2; exit 1; }
NAME=$(basename "$FILE")

json_field() { echo "$1" | grep -o "\"$2\":\"[^\"]*\"" | head -1 | cut -d'"' -f4; }

echo "VeloCal event import: ${FILE} → ${API_BASE}"
read -rp "Admin email: " EMAIL
read -rsp "Password: " PASSWORD
echo

LOGIN=$(curl -s -w "\n%{http_code}" "${API_BASE}/auth/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}")
[[ "$(echo "$LOGIN" | tail -1)" == "200" ]] || { echo "Login failed" >&2; exit 1; }
TOKEN=$(json_field "$(echo "$LOGIN" | sed '$d')" accessToken)

# ── Check (nothing is written) ──
CHECK=$(curl -s -w "\n%{http_code}" -X POST "${API_BASE}/import/events/check?fileName=${NAME}" \
  -H "Authorization: Bearer ${TOKEN}" -H 'Content-Type: application/json' --data-binary "@${FILE}")
[[ "$(echo "$CHECK" | tail -1)" == "200" ]] || { echo "Check failed: $(echo "$CHECK" | sed '$d')" >&2; exit 1; }
STATE=$(echo "$CHECK" | sed '$d' | python3 -c '
import json, sys
d = json.load(sys.stdin)
r = d["report"]
s = r["summary"]
err = sys.stderr
print("New {create}, changed {update}, unchanged {unchanged}, skipped {skip}, invalid {invalid}".format(**s), file=err)
print("Errors {errors}, warnings {warnings}".format(**s), file=err)
for i in r["fileIssues"]:
    print("  [{}] {}".format(i["severity"], i["message"]), file=err)
for e in r["entries"]:
    for i in e["issues"]:
        if i["severity"] != "info":
            print("  [{}] #{} {}: {}".format(i["severity"], e["index"], e["name"] or e["externalId"], i["message"]), file=err)
print("errors" if not d["canImport"] else ("warnings" if d["needsConfirmation"] else "ok"))
')
if [[ "$STATE" == "errors" ]]; then
  echo "The file has errors. Nothing was imported. Fix the file and run again." >&2
  exit 1
fi
if [[ "$STATE" == "warnings" ]]; then
  read -rp "Import despite the warnings above? [y/N] " ANSWER
  [[ "$ANSWER" == "y" || "$ANSWER" == "Y" ]] || { echo "Cancelled. Nothing was imported."; exit 0; }
fi

# ── Import ──
RESP=$(curl -s -w "\n%{http_code}" -X POST "${API_BASE}/import/events?fileName=${NAME}&acceptWarnings=true" \
  -H "Authorization: Bearer ${TOKEN}" -H 'Content-Type: application/json' --data-binary "@${FILE}")
HTTP=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
[[ "$HTTP" == "202" ]] || { echo "Import not started (HTTP ${HTTP}): $(json_field "$BODY" message)" >&2; exit 1; }

JOB=$(json_field "$BODY" id)
STATUS=running; WAITED=0
while [[ "$STATUS" == "running" ]]; do
  sleep "$POLL_INTERVAL"; WAITED=$((WAITED + POLL_INTERVAL))
  (( WAITED > POLL_TIMEOUT )) && { echo "Timed out waiting for job ${JOB}" >&2; exit 1; }
  JOB_JSON=$(curl -s "${API_BASE}/import/jobs/${JOB}" -H "Authorization: Bearer ${TOKEN}")
  STATUS=$(json_field "$JOB_JSON" status); STATUS=${STATUS:-running}
done

[[ "$STATUS" == "completed" ]] || { echo "Import failed: $(json_field "$JOB_JSON" error)" >&2; exit 1; }
echo "$JOB_JSON" | python3 -c 'import json,sys; r=json.load(sys.stdin)["result"]; print("Done. Created {created}, updated {updated}, skipped {skipped}.".format(**r))'
echo "Report: Admin → Imports, or ${API_BASE}/import/jobs/${JOB}/report"
