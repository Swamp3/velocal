#!/usr/bin/env bash
set -euo pipefail

CONTAINER="${CONTAINER:-velocal-postgres-1}"
DB_USER="${DB_USER:-velocal}"
DB_NAME="${DB_NAME:-velocal}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"

GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILENAME="${DB_NAME}_${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

echo ""
echo -e "${CYAN}VeloCal DB Backup${NC}"
echo "─────────────────────────"
echo -e "Container: ${CYAN}${CONTAINER}${NC}"
echo -e "Database:  ${CYAN}${DB_NAME}${NC}"
echo -e "Output:    ${CYAN}${BACKUP_DIR}/${FILENAME}${NC}"
echo ""

echo -e "${CYAN}▸${NC} Dumping..."
docker exec "$CONTAINER" pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "${BACKUP_DIR}/${FILENAME}"

SIZE=$(du -h "${BACKUP_DIR}/${FILENAME}" | cut -f1)
echo -e "${GREEN}✓${NC} Backup complete (${SIZE})"
echo ""
