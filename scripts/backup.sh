#!/usr/bin/env bash
set -euo pipefail

# ──────────────────────────────────────────────
# VeloCal — Backup Docker volumes
# ──────────────────────────────────────────────
# Creates a timestamped .tar.gz archive of the PostgreSQL data volume.
#
# Usage:
#   ./scripts/backup.sh                    # default backup dir: ./backups
#   ./scripts/backup.sh /path/to/backups   # custom backup dir
#   COMPOSE_FILE=docker-compose.prod.yml ./scripts/backup.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="${1:-$PROJECT_DIR/backups}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_FILE="$BACKUP_DIR/velocal_pgdata_$TIMESTAMP.tar.gz"

COMPOSE_PROJECT="$(basename "$PROJECT_DIR")"
VOLUME_NAME="${COMPOSE_PROJECT}_pgdata"

mkdir -p "$BACKUP_DIR"

echo "╭─────────────────────────────────────╮"
echo "│  VeloCal — Volume Backup            │"
echo "╰─────────────────────────────────────╯"
echo ""
echo "  Volume:  $VOLUME_NAME"
echo "  Target:  $BACKUP_FILE"
echo ""

if ! docker volume inspect "$VOLUME_NAME" &>/dev/null; then
  echo "ERROR: Volume '$VOLUME_NAME' not found."
  echo "Available volumes:"
  docker volume ls --format '  - {{.Name}}' | grep -i velocal || echo "  (none matching 'velocal')"
  exit 1
fi

echo "Creating backup..."
docker run --rm \
  -v "$VOLUME_NAME":/data:ro \
  -v "$BACKUP_DIR":/backup \
  alpine \
  tar czf "/backup/velocal_pgdata_$TIMESTAMP.tar.gz" -C /data .

SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo ""
echo "✓ Backup complete: $BACKUP_FILE ($SIZE)"

# Optionally prune old backups (keep last N)
KEEP=${KEEP_BACKUPS:-10}
BACKUP_COUNT=$(find "$BACKUP_DIR" -name 'velocal_pgdata_*.tar.gz' -type f | wc -l | tr -d ' ')

if [ "$BACKUP_COUNT" -gt "$KEEP" ]; then
  REMOVE_COUNT=$((BACKUP_COUNT - KEEP))
  echo ""
  echo "Pruning $REMOVE_COUNT old backup(s) (keeping last $KEEP)..."
  find "$BACKUP_DIR" -name 'velocal_pgdata_*.tar.gz' -type f -print0 \
    | sort -z \
    | head -z -n "$REMOVE_COUNT" \
    | xargs -0 rm -f
  echo "✓ Pruned."
fi
