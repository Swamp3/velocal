#!/usr/bin/env bash
set -euo pipefail

# ──────────────────────────────────────────────
# VeloCal — Schedule weekly automatic imports
# ──────────────────────────────────────────────
# Installs a crontab entry that runs `scripts/import-cron.sh` every Saturday
# night. Admin credentials are written to a chmod-600 env file that the cron
# job sources at runtime.
#
# Usage:
#   ./scripts/setup-import-cron.sh            # interactive setup
#   ./scripts/setup-import-cron.sh --remove   # remove the cron entry + config
#   ./scripts/setup-import-cron.sh --show     # show current config + cron entry
#
# Overridable via env:
#   CRON_SCHEDULE   — cron expression (default "0 23 * * 6" = Sat 23:00)
#   CRON_CONFIG     — path to the env file (default ~/.config/velocal/import-cron.env)
#   CRON_LOG        — path to the log file (default <project>/logs/import-cron.log)
#   API_BASE        — backend API base URL (default http://localhost:3000/api)
#   VELOCAL_SOURCE  — specific source; omit to import all

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
IMPORT_CRON_SCRIPT="$SCRIPT_DIR/import-cron.sh"

CRON_SCHEDULE="${CRON_SCHEDULE:-0 23 * * 6}"
CRON_CONFIG="${CRON_CONFIG:-$HOME/.config/velocal/import-cron.env}"
CRON_LOG="${CRON_LOG:-$PROJECT_DIR/logs/import-cron.log}"
CRON_MARKER="# velocal-import-cron"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
DIM='\033[2m'
NC='\033[0m'

info() { echo -e "${CYAN}▸${NC} $1"; }
ok()   { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}⚠${NC} $1"; }
fail() { echo -e "${RED}✗${NC} $1"; exit 1; }

current_crontab() {
  crontab -l 2>/dev/null || true
}

remove_existing() {
  local tab
  tab=$(current_crontab)
  if [[ -z "$tab" ]] || ! echo "$tab" | grep -qF "$CRON_MARKER"; then
    return 1
  fi
  echo "$tab" | grep -vF "$CRON_MARKER" | crontab -
  return 0
}

show() {
  echo ""
  echo -e "${CYAN}VeloCal Import Cron — Status${NC}"
  echo "─────────────────────────"
  echo ""
  echo -e "  Config: ${DIM}${CRON_CONFIG}${NC}"
  echo -e "  Log:    ${DIM}${CRON_LOG}${NC}"
  echo -e "  Script: ${DIM}${IMPORT_CRON_SCRIPT}${NC}"
  echo ""
  if [[ -f "$CRON_CONFIG" ]]; then
    ok "Config file exists"
    # shellcheck disable=SC1090
    ( set -a; source "$CRON_CONFIG"; set +a
      echo -e "  API_BASE:       ${API_BASE:-<unset>}"
      echo -e "  VELOCAL_EMAIL:  ${VELOCAL_EMAIL:-<unset>}"
      echo -e "  VELOCAL_SOURCE: ${VELOCAL_SOURCE:-<all sources>}"
    )
  else
    warn "No config file at ${CRON_CONFIG}"
  fi
  echo ""
  local entry
  entry=$(current_crontab | grep -F "$CRON_MARKER" || true)
  if [[ -n "$entry" ]]; then
    ok "Crontab entry installed:"
    echo -e "  ${DIM}${entry}${NC}"
  else
    warn "No crontab entry installed"
  fi
  echo ""
}

remove() {
  echo ""
  echo -e "${CYAN}VeloCal Import Cron — Remove${NC}"
  echo "─────────────────────────"
  echo ""
  if remove_existing; then
    ok "Crontab entry removed"
  else
    warn "No crontab entry found"
  fi
  if [[ -f "$CRON_CONFIG" ]]; then
    read -rp "Delete credentials file ${CRON_CONFIG}? [y/N] " REPLY
    if [[ "$REPLY" =~ ^[Yy]$ ]]; then
      rm -f "$CRON_CONFIG"
      ok "Config deleted"
    fi
  fi
  echo ""
}

install() {
  echo ""
  echo -e "${CYAN}VeloCal Import Cron — Setup${NC}"
  echo "─────────────────────────"
  echo ""
  echo "Schedules ./scripts/import-cron.sh to run automatically."
  echo -e "  Default schedule: ${CYAN}${CRON_SCHEDULE}${NC} ${DIM}(Saturday 23:00, local time)${NC}"
  echo -e "  Config file:      ${DIM}${CRON_CONFIG}${NC}"
  echo -e "  Log file:         ${DIM}${CRON_LOG}${NC}"
  echo ""

  [[ -x "$IMPORT_CRON_SCRIPT" ]] || fail "${IMPORT_CRON_SCRIPT} is missing or not executable"
  command -v crontab >/dev/null 2>&1 || fail "crontab command not found"

  local default_email=""
  local default_api="${API_BASE:-http://localhost:3000/api}"
  local default_source="${VELOCAL_SOURCE:-}"
  if [[ -f "$CRON_CONFIG" ]]; then
    # shellcheck disable=SC1090
    ( source "$CRON_CONFIG" >/dev/null 2>&1 || true )
    default_email=$(grep -E '^VELOCAL_EMAIL=' "$CRON_CONFIG" 2>/dev/null | cut -d= -f2- | tr -d '"' || true)
    local cfg_api cfg_src
    cfg_api=$(grep -E '^API_BASE=' "$CRON_CONFIG" 2>/dev/null | cut -d= -f2- | tr -d '"' || true)
    cfg_src=$(grep -E '^VELOCAL_SOURCE=' "$CRON_CONFIG" 2>/dev/null | cut -d= -f2- | tr -d '"' || true)
    [[ -n "$cfg_api" ]] && default_api="$cfg_api"
    [[ -n "$cfg_src" ]] && default_source="$cfg_src"
    warn "Existing config found — values will be reused unless overridden"
    echo ""
  fi

  read -rp "Admin email${default_email:+ [$default_email]}: " EMAIL
  EMAIL="${EMAIL:-$default_email}"
  [[ -z "$EMAIL" ]] && fail "Email is required"

  read -rsp "Admin password (input hidden): " PASSWORD
  echo ""
  [[ -z "$PASSWORD" ]] && fail "Password is required"

  read -rp "API base URL [$default_api]: " API_INPUT
  API_INPUT="${API_INPUT:-$default_api}"

  read -rp "Source (leave blank for all) [${default_source:-all}]: " SRC_INPUT
  SRC_INPUT="${SRC_INPUT:-$default_source}"

  read -rp "Cron schedule [$CRON_SCHEDULE]: " SCHED_INPUT
  SCHED_INPUT="${SCHED_INPUT:-$CRON_SCHEDULE}"

  echo ""

  info "Writing config to ${CRON_CONFIG}..."
  mkdir -p "$(dirname "$CRON_CONFIG")"
  # Escape single quotes in password for safe single-quoted shell assignment.
  local pw_escaped="${PASSWORD//\'/\'\\\'\'}"
  {
    echo "# VeloCal automatic import — generated $(date -u +'%Y-%m-%dT%H:%M:%SZ')"
    echo "# Sourced by scripts/import-cron.sh via VELOCAL_CRON_ENV."
    echo "VELOCAL_EMAIL='${EMAIL}'"
    echo "VELOCAL_PASSWORD='${pw_escaped}'"
    echo "API_BASE='${API_INPUT}'"
    if [[ -n "$SRC_INPUT" ]]; then
      echo "VELOCAL_SOURCE='${SRC_INPUT}'"
    else
      echo "# VELOCAL_SOURCE unset — import all sources"
    fi
  } > "$CRON_CONFIG"
  chmod 600 "$CRON_CONFIG"
  ok "Config written (chmod 600)"

  mkdir -p "$(dirname "$CRON_LOG")"
  touch "$CRON_LOG"

  info "Updating crontab..."
  remove_existing || true

  local cron_cmd
  cron_cmd="VELOCAL_CRON_ENV='${CRON_CONFIG}' '${IMPORT_CRON_SCRIPT}' >> '${CRON_LOG}' 2>&1"
  local new_tab
  new_tab=$(current_crontab)
  {
    [[ -n "$new_tab" ]] && printf '%s\n' "$new_tab"
    printf '%s %s %s\n' "$SCHED_INPUT" "$cron_cmd" "$CRON_MARKER"
  } | crontab -
  ok "Crontab entry installed"

  echo ""
  echo -e "  Schedule: ${CYAN}${SCHED_INPUT}${NC}"
  echo -e "  Runs:     ${DIM}${cron_cmd}${NC}"
  echo -e "  Log:      ${DIM}${CRON_LOG}${NC}"
  echo ""
  echo "Test it now with:"
  echo -e "  ${DIM}VELOCAL_CRON_ENV='${CRON_CONFIG}' '${IMPORT_CRON_SCRIPT}'${NC}"
  echo ""
  echo "Show status: ./scripts/setup-import-cron.sh --show"
  echo "Remove:      ./scripts/setup-import-cron.sh --remove"
  echo ""
}

case "${1:-}" in
  --show|-s|show)   show ;;
  --remove|-r|remove) remove ;;
  --help|-h|help)
    grep -E '^# ' "$0" | sed 's/^# \{0,1\}//'
    ;;
  ''|install)       install ;;
  *) fail "Unknown option: $1 (use --show, --remove, or no args to install)" ;;
esac
