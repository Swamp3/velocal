#!/usr/bin/env bash
set -euo pipefail

# ──────────────────────────────────────────────
# VeloCal — PostgreSQL logical dump (pg_dump)
# ──────────────────────────────────────────────
# Creates a SQL dump of the database using pg_dump inside the running
# postgres container. Unlike the volume backup, this is a logical backup
# that can be restored into any PostgreSQL instance.
#
# Usage:
#   ./scripts/pg-dump.sh                    # default: ./backups
#   ./scripts/pg-dump.sh /path/to/backups   # custom dir

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="${1:-$PROJECT_DIR/backups}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
DUMP_FILE="$BACKUP_DIR/velocal_dump_$TIMESTAMP.sql.gz"

DB_USER="${DB_USER:-velocal}"
DB_NAME="${DB_NAME:-velocal}"

mkdir -p "$BACKUP_DIR"

echo "╭─────────────────────────────────────╮"
echo "│  VeloCal — pg_dump Backup           │"
echo "╰─────────────────────────────────────╯"
echo ""
echo "  Database: $DB_NAME"
echo "  Target:   $DUMP_FILE"
echo ""

CONTAINER=$(docker compose -f "$PROJECT_DIR/docker-compose.yml" ps -q postgres 2>/dev/null \
  || docker compose -f "$PROJECT_DIR/docker-compose.yml" -f "$PROJECT_DIR/docker-compose.prod.yml" ps -q postgres 2>/dev/null)

if [ -z "$CONTAINER" ]; then
  echo "ERROR: postgres container is not running."
  echo "Start it first: docker compose up postgres -d"
  exit 1
fi

echo "Running pg_dump..."
docker exec "$CONTAINER" pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$DUMP_FILE"

SIZE=$(du -h "$DUMP_FILE" | cut -f1)
echo ""
echo "✓ Dump complete: $DUMP_FILE ($SIZE)"
echo ""
echo "To restore:"
echo "  gunzip -c $DUMP_FILE | docker exec -i <postgres-container> psql -U $DB_USER $DB_NAME"
