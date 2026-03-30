#!/usr/bin/env bash
set -euo pipefail

CONTAINER="${CONTAINER:-velocal-postgres-1}"
DB_USER="${DB_USER:-velocal}"
DB_NAME="${DB_NAME:-velocal}"

RED='\033[0;31m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
GREEN='\033[0;32m'
NC='\033[0m'

echo ""
echo -e "${RED}⚠  DATABASE FLUSH${NC}"
echo "─────────────────────────"
echo -e "Container: ${CYAN}${CONTAINER}${NC}"
echo -e "Database:  ${CYAN}${DB_NAME}${NC}"
echo ""
echo -e "${YELLOW}This will DROP ALL TABLES and data. This cannot be undone.${NC}"
echo ""
read -rp "Type 'flush' to confirm: " CONFIRM

if [[ "$CONFIRM" != "flush" ]]; then
  echo "Aborted."
  exit 1
fi

echo ""
read -rp "Are you absolutely sure? (y/N): " SURE
if [[ "$SURE" != "y" && "$SURE" != "Y" ]]; then
  echo "Aborted."
  exit 1
fi

echo ""
echo -e "${CYAN}▸${NC} Dropping all tables..."

docker exec "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c "
  DO \$\$
  DECLARE r RECORD;
  BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
      EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
    END LOOP;
  END \$\$;
"

echo -e "${GREEN}✓${NC} All tables dropped."
echo ""
echo -e "${CYAN}▸${NC} Restarting backend to re-run migrations and seeders..."
docker restart "${CONTAINER/postgres/backend}" > /dev/null 2>&1 || true

echo -e "${GREEN}✓${NC} Done. Backend will recreate the schema on startup."
echo ""
