#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STRAVA_DIR="$(dirname "$SCRIPT_DIR")/strava-stats"

cd "$SCRIPT_DIR"

echo "==> Pulling latest changes (velocal)..."
git pull

echo "==> Pulling latest changes (strava-stats / caddy)..."
git -C "$STRAVA_DIR" pull

echo "==> Stopping dev environment..."
docker compose -p velocal-dev down --remove-orphans

echo "==> Stopping prod environment..."
docker compose -p velocal-prod -f docker-compose.prod.yml down --remove-orphans

echo "==> Building and starting prod environment..."
docker compose -p velocal-prod -f docker-compose.prod.yml up -d --build

echo "==> Building and starting dev environment..."
docker compose -p velocal-dev up -d --build

echo "==> Restarting Caddy..."
docker compose -f "$STRAVA_DIR/docker-compose.yml" --project-directory "$STRAVA_DIR" up -d --force-recreate caddy

echo "==> Done. Running containers:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "velocal|caddy"
