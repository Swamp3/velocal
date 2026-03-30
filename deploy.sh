#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STRAVA_DIR="$(dirname "$SCRIPT_DIR")/strava-stats"
ENV="${1:-dev}"

CYAN='\033[0;36m'
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

info() { echo -e "${CYAN}▸${NC} $1"; }
ok()   { echo -e "${GREEN}✓${NC} $1"; }
fail() { echo -e "${RED}✗${NC} $1"; exit 1; }

cd "$SCRIPT_DIR"

case "$ENV" in
  dev)
    PROJECT="velocal-dev"
    COMPOSE_ARGS=""
    ;;
  prod)
    PROJECT="velocal-prod"
    COMPOSE_ARGS="-f docker-compose.prod.yml"
    ;;
  all)
    echo -e "${CYAN}Deploying both environments${NC}"
    echo ""
    "$0" prod
    echo ""
    "$0" dev
    exit 0
    ;;
  *)
    echo "Usage: $0 [dev|prod|all]  (default: dev)"
    exit 1
    ;;
esac

echo ""
echo -e "${CYAN}Deploying ${ENV}${NC} (project: ${PROJECT})"
echo "─────────────────────────"
echo ""

info "Pulling latest changes..."
git pull

info "Stopping ${ENV} environment..."
docker compose -p "$PROJECT" $COMPOSE_ARGS down --remove-orphans

info "Building and starting ${ENV}..."
docker compose -p "$PROJECT" $COMPOSE_ARGS up -d --build

if [[ "$ENV" == "prod" ]]; then
  info "Restarting Caddy..."
  docker compose -f "$STRAVA_DIR/docker-compose.yml" \
    --project-directory "$STRAVA_DIR" up -d --force-recreate caddy
fi

echo ""
ok "Deploy complete (${ENV})"
echo ""
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "${PROJECT}|caddy" || true
echo ""
