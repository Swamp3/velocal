# Backups & Restore

Scripts in `scripts/` back up and restore everything the app stores.

## What `backup.sh` saves

One run writes three files with the same timestamp:

| File | Content | Use |
| --- | --- | --- |
| `velocal_dump_*.sql.gz` | SQL dump via `pg_dump` | **Preferred way to restore the database**: consistent even while the app runs |
| `velocal_pgdata_*.tar.gz` | raw PostgreSQL data volume | fast same-version restore; a copy of a running DB can be inconsistent, prefer the dump |
| `velocal_uploads_*.tar.gz` | `uploads` volume | event/community/news images and GPX routes |

**Not included:** the `.env` file (database password, `JWT_SECRET`, mail key). Store it separately and securely. Backups land in `./backups` on the same machine, so copy them off-site (second server, NAS, object storage) as well.

## Run a backup

```bash
# Backup to ./backups/ (default)
./scripts/backup.sh

# Backup to custom directory
./scripts/backup.sh /mnt/nas/velocal-backups

# Keep only the last 5 backups (default: 10)
KEEP_BACKUPS=5 ./scripts/backup.sh
```

## Volume restore

Restores a database volume (`velocal_pgdata_*`) or the uploads volume (`velocal_uploads_*`). For the database the **postgres container must be stopped**.

```bash
# Stop services first
docker compose -f docker-compose.prod.yml down

# Restore (interactive confirmation prompt)
./scripts/restore.sh ./backups/velocal_pgdata_20260326_120000.tar.gz

# Start services again
docker compose -f docker-compose.prod.yml up -d
```

## SQL dump (logical backup via pg_dump)

Creates a compressed SQL dump. Portable across PostgreSQL versions. Useful for migrations or importing into a different environment.

```bash
# Dump while postgres is running
./scripts/pg-dump.sh

# Custom output dir
./scripts/pg-dump.sh /mnt/nas/velocal-backups
```

Restore a SQL dump:

```bash
gunzip -c ./backups/velocal_dump_20260326_120000.sql.gz \
  | docker exec -i $(docker compose -f docker-compose.prod.yml ps -q postgres) psql -U velocal velocal
```

## Copying volumes between machines

To move the database to another host without the scripts:

```bash
# On source: export the volume
docker run --rm -v velocal_pgdata:/data:ro -v $(pwd):/backup alpine \
  tar czf /backup/pgdata-export.tar.gz -C /data .

# Transfer the archive (scp, rsync, etc.)
scp pgdata-export.tar.gz user@target-host:~/

# On target: import into the volume
docker volume create velocal_pgdata
docker run --rm -v velocal_pgdata:/data -v $(pwd):/backup alpine \
  sh -c "rm -rf /data/* && tar xzf /backup/pgdata-export.tar.gz -C /data"
```

## Backup schedule (cron)

Add a cron job for automated backups:

```bash
# Daily at 3 AM, keep last 14 backups
0 3 * * * cd /path/to/velocal && KEEP_BACKUPS=14 ./scripts/backup.sh >> /var/log/velocal-backup.log 2>&1
```
