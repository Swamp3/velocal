#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

CYAN='\033[0;36m'
GREEN='\033[0;32m'
NC='\033[0m'

info() { echo -e "${CYAN}▸${NC} $1"; }
ok()   { echo -e "${GREEN}✓${NC} $1"; }

cd "$SCRIPT_DIR"

echo ""
echo -e "${CYAN}VeloCal Deploy${NC}"
echo "─────────────────────────"
echo ""

info "Pulling latest changes..."
git pull

info "Stopping environment..."
docker compose -f docker-compose.prod.yml down --remove-orphans

info "Building and starting..."
docker compose -f docker-compose.prod.yml up -d --build

echo ""
ok "Deploy complete"
echo ""
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "velocal|caddy" || true
echo ""
