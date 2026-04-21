#!/usr/bin/env bash
set -euo pipefail

# ──────────────────────────────────────────────
# VeloCal — Schedule weekly automatic imports
# ──────────────────────────────────────────────
# Installs a scheduled job that runs `scripts/import-cron.sh`. Admin credentials
# are written to a chmod-600 env file that the job sources at runtime.
#
# Supports three scheduler backends:
#   systemd   — Linux user timer (~/.config/systemd/user/velocal-import.{service,timer})
#   launchd   — macOS LaunchAgent (~/Library/LaunchAgents/cc.velocal.import.plist)
#   cron      — POSIX crontab (falls back here when systemd/launchd unavailable)
#
# Usage:
#   ./scripts/setup-import-cron.sh                  # interactive install, auto-detected backend
#   ./scripts/setup-import-cron.sh --systemd        # force systemd
#   ./scripts/setup-import-cron.sh --launchd        # force launchd
#   ./scripts/setup-import-cron.sh --cron           # force cron
#   ./scripts/setup-import-cron.sh --show           # show config + status of every detected backend
#   ./scripts/setup-import-cron.sh --remove         # remove the scheduled job from every backend
#   ./scripts/setup-import-cron.sh --run-now        # trigger the import once, outside the schedule
#
# Env overrides:
#   SCHEDULER            — cron | systemd | launchd (takes precedence over auto-detect)
#   SCHEDULE_DAY         — Sun | Mon | Tue | Wed | Thu | Fri | Sat (default Sat)
#   SCHEDULE_TIME        — HH:MM in 24h local time (default 23:00)
#   CRON_SCHEDULE        — raw cron expression (cron backend only; overrides SCHEDULE_DAY/TIME)
#   CRON_CONFIG          — path to the env file (default ~/.config/velocal/import-cron.env)
#   CRON_LOG             — path to the log file (default <project>/logs/import-cron.log)
#   API_BASE             — backend API base URL (default http://localhost:3000/api)
#   VELOCAL_SOURCE       — specific source; omit to import all

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
IMPORT_CRON_SCRIPT="$SCRIPT_DIR/import-cron.sh"

# Cosmetics
GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[0;33m'; CYAN='\033[0;36m'; DIM='\033[2m'; NC='\033[0m'
info() { echo -e "${CYAN}▸${NC} $1"; }
ok()   { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}⚠${NC} $1"; }
fail() { echo -e "${RED}✗${NC} $1"; exit 1; }

# Paths + identifiers
CRON_CONFIG="${CRON_CONFIG:-$HOME/.config/velocal/import-cron.env}"
CRON_LOG="${CRON_LOG:-$PROJECT_DIR/logs/import-cron.log}"

CRON_MARKER="# velocal-import-cron"
SYSTEMD_UNIT="velocal-import"
SYSTEMD_DIR="$HOME/.config/systemd/user"
SYSTEMD_SERVICE="$SYSTEMD_DIR/${SYSTEMD_UNIT}.service"
SYSTEMD_TIMER="$SYSTEMD_DIR/${SYSTEMD_UNIT}.timer"
LAUNCHD_LABEL="cc.velocal.import"
LAUNCHD_DIR="$HOME/Library/LaunchAgents"
LAUNCHD_PLIST="$LAUNCHD_DIR/${LAUNCHD_LABEL}.plist"

# Schedule defaults (used by every backend; cron can override via CRON_SCHEDULE)
SCHEDULE_DAY="${SCHEDULE_DAY:-Sat}"
SCHEDULE_TIME="${SCHEDULE_TIME:-23:00}"

# ──────────────────────────────────────────────
# Backend detection
# ──────────────────────────────────────────────
backend_available() {
  case "$1" in
    systemd) [[ "$(uname -s)" == "Linux" ]] && command -v systemctl >/dev/null 2>&1 ;;
    launchd) [[ "$(uname -s)" == "Darwin" ]] && command -v launchctl >/dev/null 2>&1 ;;
    cron)    command -v crontab >/dev/null 2>&1 ;;
    *) return 1 ;;
  esac
}

detect_backend() {
  if [[ -n "${SCHEDULER:-}" ]]; then
    backend_available "$SCHEDULER" || fail "SCHEDULER=$SCHEDULER but it is not available on this system"
    echo "$SCHEDULER"; return
  fi
  for b in systemd launchd cron; do
    backend_available "$b" && { echo "$b"; return; }
  done
  fail "No scheduler backend found. Install one of: systemd, launchd, cron."
}

# ──────────────────────────────────────────────
# Schedule conversion helpers
# ──────────────────────────────────────────────
validate_time() {
  [[ "$1" =~ ^([01][0-9]|2[0-3]):[0-5][0-9]$ ]] || fail "Invalid time '$1' (expected HH:MM)"
}

day_to_cron_dow() {
  case "$(echo "$1" | tr '[:upper:]' '[:lower:]')" in
    sun|sunday) echo 0 ;; mon|monday) echo 1 ;; tue|tuesday) echo 2 ;;
    wed|wednesday) echo 3 ;; thu|thursday) echo 4 ;; fri|friday) echo 5 ;;
    sat|saturday) echo 6 ;;
    *) fail "Invalid day '$1' (expected Sun..Sat)" ;;
  esac
}

day_to_systemd() {
  case "$(echo "$1" | tr '[:upper:]' '[:lower:]')" in
    sun|sunday) echo Sun ;; mon|monday) echo Mon ;; tue|tuesday) echo Tue ;;
    wed|wednesday) echo Wed ;; thu|thursday) echo Thu ;; fri|friday) echo Fri ;;
    sat|saturday) echo Sat ;;
    *) fail "Invalid day '$1'" ;;
  esac
}

to_cron_expression() {
  local day="$1" time="$2"
  local hh="${time%%:*}" mm="${time##*:}" dow
  dow="$(day_to_cron_dow "$day")"
  hh="${hh#0}"; mm="${mm#0}"
  printf '%s %s * * %s' "${mm:-0}" "${hh:-0}" "$dow"
}

# ──────────────────────────────────────────────
# Credentials + config (shared)
# ──────────────────────────────────────────────
read_config_value() {
  local key="$1"
  [[ -f "$CRON_CONFIG" ]] || return 0
  grep -E "^${key}=" "$CRON_CONFIG" 2>/dev/null | tail -1 | sed -E "s/^${key}=//; s/^'//; s/'$//"
}

prompt_credentials() {
  local default_email default_api default_source default_day default_time
  default_email="$(read_config_value VELOCAL_EMAIL)"
  default_api="$(read_config_value API_BASE)"
  default_api="${default_api:-${API_BASE:-http://localhost:3000/api}}"
  default_source="$(read_config_value VELOCAL_SOURCE)"
  default_source="${default_source:-${VELOCAL_SOURCE:-}}"
  default_day="$(read_config_value SCHEDULE_DAY)"
  default_day="${default_day:-$SCHEDULE_DAY}"
  default_time="$(read_config_value SCHEDULE_TIME)"
  default_time="${default_time:-$SCHEDULE_TIME}"

  [[ -f "$CRON_CONFIG" ]] && { warn "Existing config found — press Enter to keep shown values"; echo ""; }

  read -rp "Admin email${default_email:+ [$default_email]}: " EMAIL
  EMAIL="${EMAIL:-$default_email}"
  [[ -z "$EMAIL" ]] && fail "Email is required"

  read -rsp "Admin password (input hidden${default_email:+, Enter to keep existing}): " PASSWORD
  echo ""
  if [[ -z "$PASSWORD" ]]; then
    PASSWORD="$(read_config_value VELOCAL_PASSWORD)"
    [[ -z "$PASSWORD" ]] && fail "Password is required"
    info "Reusing existing password from config"
  fi

  read -rp "API base URL [$default_api]: " API_INPUT
  API_INPUT="${API_INPUT:-$default_api}"

  read -rp "Source (leave blank for all) [${default_source:-all}]: " SRC_INPUT
  SRC_INPUT="${SRC_INPUT:-$default_source}"

  read -rp "Day of week [Sun|Mon|Tue|Wed|Thu|Fri|Sat] [$default_day]: " DAY_INPUT
  DAY_INPUT="${DAY_INPUT:-$default_day}"
  day_to_cron_dow "$DAY_INPUT" >/dev/null

  read -rp "Time (HH:MM, 24h local) [$default_time]: " TIME_INPUT
  TIME_INPUT="${TIME_INPUT:-$default_time}"
  validate_time "$TIME_INPUT"

  SCHEDULE_DAY="$DAY_INPUT"
  SCHEDULE_TIME="$TIME_INPUT"
}

write_config() {
  info "Writing config to ${CRON_CONFIG}..."
  mkdir -p "$(dirname "$CRON_CONFIG")"
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
    echo "SCHEDULE_DAY='${SCHEDULE_DAY}'"
    echo "SCHEDULE_TIME='${SCHEDULE_TIME}'"
  } > "$CRON_CONFIG"
  chmod 600 "$CRON_CONFIG"
  ok "Config written (chmod 600)"

  mkdir -p "$(dirname "$CRON_LOG")"
  touch "$CRON_LOG"
}

# ──────────────────────────────────────────────
# Cron backend
# ──────────────────────────────────────────────
cron_current() { crontab -l 2>/dev/null || true; }

cron_remove() {
  local tab; tab="$(cron_current)"
  if [[ -z "$tab" ]] || ! grep -qF "$CRON_MARKER" <<<"$tab"; then
    return 1
  fi
  grep -vF "$CRON_MARKER" <<<"$tab" | crontab -
}

cron_install() {
  local expr
  expr="${CRON_SCHEDULE:-$(to_cron_expression "$SCHEDULE_DAY" "$SCHEDULE_TIME")}"
  local cmd="VELOCAL_CRON_ENV='${CRON_CONFIG}' '${IMPORT_CRON_SCRIPT}' >> '${CRON_LOG}' 2>&1"
  cron_remove || true
  {
    local tab; tab="$(cron_current)"
    [[ -n "$tab" ]] && printf '%s\n' "$tab"
    printf '%s %s %s\n' "$expr" "$cmd" "$CRON_MARKER"
  } | crontab -
  ok "Installed crontab entry: ${DIM}${expr}${NC}"
}

cron_show() {
  local entry; entry="$(cron_current | grep -F "$CRON_MARKER" || true)"
  if [[ -n "$entry" ]]; then
    ok "crontab entry:"
    echo -e "  ${DIM}${entry}${NC}"
  else
    warn "no crontab entry"
  fi
}

# ──────────────────────────────────────────────
# systemd user backend
# ──────────────────────────────────────────────
systemd_install() {
  mkdir -p "$SYSTEMD_DIR"
  local oncal; oncal="$(day_to_systemd "$SCHEDULE_DAY") ${SCHEDULE_TIME}"

  cat > "$SYSTEMD_SERVICE" <<EOF
[Unit]
Description=VeloCal automatic event import
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
Environment=VELOCAL_CRON_ENV=${CRON_CONFIG}
ExecStart=${IMPORT_CRON_SCRIPT}
StandardOutput=append:${CRON_LOG}
StandardError=append:${CRON_LOG}
EOF

  cat > "$SYSTEMD_TIMER" <<EOF
[Unit]
Description=Run VeloCal import weekly

[Timer]
OnCalendar=${oncal}
Persistent=true
Unit=${SYSTEMD_UNIT}.service

[Install]
WantedBy=timers.target
EOF

  systemctl --user daemon-reload
  systemctl --user enable --now "${SYSTEMD_UNIT}.timer" >/dev/null
  ok "Installed systemd timer: ${DIM}OnCalendar=${oncal}${NC}"

  if command -v loginctl >/dev/null 2>&1; then
    if ! loginctl show-user "$USER" 2>/dev/null | grep -q 'Linger=yes'; then
      warn "User lingering is disabled — timer will stop when you log out."
      echo -e "  ${DIM}Enable with: sudo loginctl enable-linger ${USER}${NC}"
    fi
  fi
}

systemd_remove() {
  local removed=1
  if [[ -f "$SYSTEMD_TIMER" || -f "$SYSTEMD_SERVICE" ]]; then
    systemctl --user disable --now "${SYSTEMD_UNIT}.timer" 2>/dev/null || true
    rm -f "$SYSTEMD_TIMER" "$SYSTEMD_SERVICE"
    systemctl --user daemon-reload 2>/dev/null || true
    removed=0
  fi
  return "$removed"
}

systemd_show() {
  if [[ -f "$SYSTEMD_TIMER" ]]; then
    local oncal next_run
    oncal="$(grep -E '^OnCalendar=' "$SYSTEMD_TIMER" | sed 's/^OnCalendar=//')"
    next_run="$(systemctl --user list-timers "${SYSTEMD_UNIT}.timer" --no-legend --no-pager 2>/dev/null | awk '{print $1, $2}')"
    ok "systemd timer:"
    echo -e "  ${DIM}OnCalendar=${oncal}${NC}"
    [[ -n "$next_run" ]] && echo -e "  ${DIM}Next run: ${next_run}${NC}"
  else
    warn "no systemd timer"
  fi
}

# ──────────────────────────────────────────────
# launchd backend (macOS LaunchAgent)
# ──────────────────────────────────────────────
launchd_install() {
  mkdir -p "$LAUNCHD_DIR"
  local dow hh mm
  dow="$(day_to_cron_dow "$SCHEDULE_DAY")"
  hh="${SCHEDULE_TIME%%:*}"; mm="${SCHEDULE_TIME##*:}"
  hh="${hh#0}"; mm="${mm#0}"
  : "${hh:=0}"; : "${mm:=0}"

  cat > "$LAUNCHD_PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${LAUNCHD_LABEL}</string>
    <key>ProgramArguments</key>
    <array>
        <string>${IMPORT_CRON_SCRIPT}</string>
    </array>
    <key>EnvironmentVariables</key>
    <dict>
        <key>VELOCAL_CRON_ENV</key>
        <string>${CRON_CONFIG}</string>
    </dict>
    <key>StartCalendarInterval</key>
    <dict>
        <key>Weekday</key>
        <integer>${dow}</integer>
        <key>Hour</key>
        <integer>${hh}</integer>
        <key>Minute</key>
        <integer>${mm}</integer>
    </dict>
    <key>StandardOutPath</key>
    <string>${CRON_LOG}</string>
    <key>StandardErrorPath</key>
    <string>${CRON_LOG}</string>
    <key>RunAtLoad</key>
    <false/>
</dict>
</plist>
EOF

  launchctl bootout "gui/$(id -u)/${LAUNCHD_LABEL}" 2>/dev/null || true
  launchctl bootstrap "gui/$(id -u)" "$LAUNCHD_PLIST"
  ok "Installed LaunchAgent: ${DIM}${LAUNCHD_LABEL} (Weekday=${dow} ${SCHEDULE_TIME})${NC}"
}

launchd_remove() {
  local removed=1
  if [[ -f "$LAUNCHD_PLIST" ]]; then
    launchctl bootout "gui/$(id -u)/${LAUNCHD_LABEL}" 2>/dev/null || true
    rm -f "$LAUNCHD_PLIST"
    removed=0
  fi
  return "$removed"
}

launchd_show() {
  if [[ -f "$LAUNCHD_PLIST" ]]; then
    ok "LaunchAgent:"
    echo -e "  ${DIM}${LAUNCHD_PLIST}${NC}"
    if launchctl print "gui/$(id -u)/${LAUNCHD_LABEL}" >/dev/null 2>&1; then
      echo -e "  ${DIM}State: loaded${NC}"
    else
      warn "plist present but agent not loaded"
    fi
  else
    warn "no LaunchAgent"
  fi
}

# ──────────────────────────────────────────────
# Dispatch
# ──────────────────────────────────────────────
install_backend() {
  case "$1" in
    cron)    cron_install ;;
    systemd) systemd_install ;;
    launchd) launchd_install ;;
    *) fail "Unknown backend: $1" ;;
  esac
}

show_all() {
  echo ""
  echo -e "${CYAN}VeloCal Import Scheduler — Status${NC}"
  echo "─────────────────────────"
  echo ""
  echo -e "  Config: ${DIM}${CRON_CONFIG}${NC}"
  echo -e "  Log:    ${DIM}${CRON_LOG}${NC}"
  echo -e "  Script: ${DIM}${IMPORT_CRON_SCRIPT}${NC}"
  echo ""
  if [[ -f "$CRON_CONFIG" ]]; then
    ok "Config file exists"
    local cfg_email cfg_api cfg_src cfg_day cfg_time
    cfg_email="$(read_config_value VELOCAL_EMAIL)"
    cfg_api="$(read_config_value API_BASE)"
    cfg_src="$(read_config_value VELOCAL_SOURCE)"
    cfg_day="$(read_config_value SCHEDULE_DAY)"
    cfg_time="$(read_config_value SCHEDULE_TIME)"
    echo -e "  API_BASE:       ${cfg_api:-<unset>}"
    echo -e "  VELOCAL_EMAIL:  ${cfg_email:-<unset>}"
    echo -e "  VELOCAL_SOURCE: ${cfg_src:-<all sources>}"
    echo -e "  Schedule:       ${cfg_day:-?} ${cfg_time:-?}"
  else
    warn "No config file at ${CRON_CONFIG}"
  fi
  echo ""

  for b in cron systemd launchd; do
    if backend_available "$b"; then
      echo -e "${CYAN}[${b}]${NC}"
      case "$b" in
        cron)    cron_show ;;
        systemd) systemd_show ;;
        launchd) launchd_show ;;
      esac
      echo ""
    fi
  done
}

remove_all() {
  echo ""
  echo -e "${CYAN}VeloCal Import Scheduler — Remove${NC}"
  echo "─────────────────────────"
  echo ""
  local any=1
  if backend_available cron && cron_remove; then
    ok "Removed crontab entry"; any=0
  fi
  if backend_available systemd && systemd_remove; then
    ok "Removed systemd timer"; any=0
  fi
  if backend_available launchd && launchd_remove; then
    ok "Removed LaunchAgent"; any=0
  fi
  (( any == 0 )) || warn "Nothing to remove"

  if [[ -f "$CRON_CONFIG" ]]; then
    read -rp "Delete credentials file ${CRON_CONFIG}? [y/N] " REPLY
    if [[ "$REPLY" =~ ^[Yy]$ ]]; then
      rm -f "$CRON_CONFIG"
      ok "Config deleted"
    fi
  fi
  echo ""
}

run_now() {
  [[ -f "$CRON_CONFIG" ]] || fail "No config at $CRON_CONFIG — run install first"
  [[ -x "$IMPORT_CRON_SCRIPT" ]] || fail "${IMPORT_CRON_SCRIPT} is missing or not executable"
  info "Running import now (output → ${CRON_LOG})..."
  VELOCAL_CRON_ENV="$CRON_CONFIG" "$IMPORT_CRON_SCRIPT" | tee -a "$CRON_LOG"
}

install_flow() {
  local backend="${1:-$(detect_backend)}"
  backend_available "$backend" || fail "Backend '$backend' is not available on this system"

  echo ""
  echo -e "${CYAN}VeloCal Import Scheduler — Setup${NC}"
  echo "─────────────────────────"
  echo ""
  echo -e "  Backend:     ${CYAN}${backend}${NC}"
  echo -e "  Config file: ${DIM}${CRON_CONFIG}${NC}"
  echo -e "  Log file:    ${DIM}${CRON_LOG}${NC}"
  echo ""

  [[ -x "$IMPORT_CRON_SCRIPT" ]] || fail "${IMPORT_CRON_SCRIPT} is missing or not executable"

  prompt_credentials
  echo ""
  write_config
  install_backend "$backend"
  echo ""
  echo "Test it now:"
  echo -e "  ${DIM}./scripts/setup-import-cron.sh --run-now${NC}"
  echo ""
  echo -e "Status: ${DIM}./scripts/setup-import-cron.sh --show${NC}"
  echo -e "Remove: ${DIM}./scripts/setup-import-cron.sh --remove${NC}"
  echo ""
}

case "${1:-}" in
  --show|-s|show)       show_all ;;
  --remove|-r|remove)   remove_all ;;
  --run-now|run-now)    run_now ;;
  --cron)               install_flow cron ;;
  --systemd)            install_flow systemd ;;
  --launchd)            install_flow launchd ;;
  --help|-h|help)
    awk '
      /^# ─/ && !started { started=1 }
      started && /^#/ { sub(/^# ?/, ""); print; next }
      started { exit }
    ' "$0"
    ;;
  ''|install)           install_flow ;;
  *) fail "Unknown option: $1 (use --show, --remove, --run-now, --cron, --systemd, --launchd, or no args)" ;;
esac
