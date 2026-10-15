#!/usr/bin/env bash
set -euo pipefail

# ──────────────────────────────────────────────
# VeloCal — Backup Docker volumes
# ──────────────────────────────────────────────
# Creates timestamped archives of everything the app stores:
#   velocal_dump_*.sql.gz       consistent SQL dump (pg_dump, while the DB runs)
#   velocal_pgdata_*.tar.gz     raw copy of the PostgreSQL data volume
#   velocal_uploads_*.tar.gz    uploaded files: event/community images and GPX routes
#
# NOT included (keep them separately and securely): the .env file with the
# secrets (DB_PASSWORD, JWT_SECRET, RESEND_API_KEY, ...). Backups stay on this
# machine unless you copy them off-site.
#
# Usage:
#   ./scripts/backup.sh                    # default backup dir: ./backups
#   ./scripts/backup.sh /path/to/backups   # custom backup dir

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

UPLOADS_VOLUME="${COMPOSE_PROJECT}_uploads"
UPLOADS_FILE="$BACKUP_DIR/velocal_uploads_$TIMESTAMP.tar.gz"
if ! docker volume inspect "$UPLOADS_VOLUME" &>/dev/null; then
  echo "ERROR: Volume '$UPLOADS_VOLUME' not found (uploaded images and GPX files)."
  exit 1
fi

# 1) Consistent logical dump. A raw copy of a running database can be
#    inconsistent, so this one is the file to restore from.
echo "Creating SQL dump..."
"$SCRIPT_DIR/pg-dump.sh" "$BACKUP_DIR"

# 2) Uploaded files (images, GPX routes).
echo "Backing up uploads..."
docker run --rm \
  -v "$UPLOADS_VOLUME":/data:ro \
  -v "$BACKUP_DIR":/backup \
  alpine \
  tar czf "/backup/velocal_uploads_$TIMESTAMP.tar.gz" -C /data .
echo "✓ Uploads: $UPLOADS_FILE ($(du -h "$UPLOADS_FILE" | cut -f1))"

# 3) Raw database volume.
echo "Creating volume backup..."
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
for PATTERN in 'velocal_pgdata_*.tar.gz' 'velocal_uploads_*.tar.gz' 'velocal_dump_*.sql.gz'; do
  BACKUP_COUNT=$(find "$BACKUP_DIR" -name "$PATTERN" -type f | wc -l | tr -d ' ')
  if [ "$BACKUP_COUNT" -gt "$KEEP" ]; then
    REMOVE_COUNT=$((BACKUP_COUNT - KEEP))
    echo ""
    echo "Pruning $REMOVE_COUNT old $PATTERN (keeping last $KEEP)..."
    find "$BACKUP_DIR" -name "$PATTERN" -type f -print0 \
      | sort -z \
      | head -z -n "$REMOVE_COUNT" \
      | xargs -0 rm -f
    echo "✓ Pruned."
  fi
done
