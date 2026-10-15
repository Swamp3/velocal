#!/usr/bin/env bash
set -euo pipefail

# ──────────────────────────────────────────────
# VeloCal — Restore Docker volume from backup
# ──────────────────────────────────────────────
# Restores a .tar.gz backup into its Docker volume:
#   velocal_pgdata_*.tar.gz   -> PostgreSQL data volume (postgres must be stopped)
#   velocal_uploads_*.tar.gz  -> uploads volume (images, GPX routes)
#
# Usage:
#   ./scripts/restore.sh ./backups/velocal_pgdata_20260326_120000.tar.gz
#   ./scripts/restore.sh ./backups/velocal_uploads_20260326_120000.tar.gz
#
# WARNING: This replaces all existing data in the volume.
# The postgres container MUST be stopped before restoring.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

COMPOSE_PROJECT="$(basename "$PROJECT_DIR")"
VOLUME_NAME="${COMPOSE_PROJECT}_pgdata"

if [ $# -lt 1 ]; then
  echo "Usage: $0 <backup-file.tar.gz>"
  echo ""
  echo "Available backups:"
  find "$PROJECT_DIR/backups" \( -name 'velocal_pgdata_*.tar.gz' -o -name 'velocal_uploads_*.tar.gz' \) -type f -exec basename {} \; 2>/dev/null \
    | sort \
    | while read -r f; do echo "  $f"; done
  exit 1
fi

BACKUP_FILE="$1"
KIND=pgdata
case "$(basename "$BACKUP_FILE")" in
  velocal_uploads_*) KIND=uploads; VOLUME_NAME="${COMPOSE_PROJECT}_uploads" ;;
  velocal_pgdata_*) ;;
  *) echo "ERROR: Unrecognised backup name (expected velocal_pgdata_* or velocal_uploads_*)."; exit 1 ;;
esac

if [ ! -f "$BACKUP_FILE" ]; then
  echo "ERROR: Backup file not found: $BACKUP_FILE"
  exit 1
fi

echo "╭─────────────────────────────────────╮"
echo "│  VeloCal — Volume Restore           │"
echo "╰─────────────────────────────────────╯"
echo ""
echo "  Volume:  $VOLUME_NAME"
echo "  Source:  $BACKUP_FILE"
echo ""

# Check if postgres is running
if [ "$KIND" = pgdata ] && docker compose -f "$PROJECT_DIR/docker-compose.prod.yml" \
  ps --status running 2>/dev/null | grep -q postgres; then
  echo "ERROR: The postgres container is still running."
  echo "Stop services first:"
  echo "  docker compose -f docker-compose.prod.yml down"
  exit 1
fi

BACKUP_DIR="$(cd "$(dirname "$BACKUP_FILE")" && pwd)"
BACKUP_BASENAME="$(basename "$BACKUP_FILE")"

echo "⚠  This will REPLACE all data in volume '$VOLUME_NAME'."
read -rp "Continue? [y/N] " confirm
if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
  echo "Aborted."
  exit 0
fi

echo ""
echo "Restoring..."

docker run --rm \
  -v "$VOLUME_NAME":/data \
  -v "$BACKUP_DIR":/backup:ro \
  alpine \
  sh -c "rm -rf /data/* && tar xzf /backup/$BACKUP_BASENAME -C /data"

echo ""
echo "✓ Restore complete. Start services:"
echo "  docker compose -f docker-compose.prod.yml up -d"
