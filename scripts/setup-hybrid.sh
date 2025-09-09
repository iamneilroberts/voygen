#!/usr/bin/env bash
# scripts/setup-hybrid.sh
# Hybrid memory setup for Claude Code:
# - keep auto-doc updates (post-tool-use)
# - disable auto-injection (session_start, precompact, user prompt submit)
# - add lean project memory config + status line meter
# - safe/idempotent; uses jq if available to patch JSON

set -euo pipefail

# --- locations (relative to repo root) ---
REPO_ROOT="$(pwd)"
SCRIPTS_DIR="$REPO_ROOT/scripts"
PROJ_DIR="$REPO_ROOT/.project"
MEM_DIR="$PROJ_DIR/memory"
SEG_DIR="$MEM_DIR/segments"
CLAUDE_DIR="$REPO_ROOT/.claude"
SETTINGS="$CLAUDE_DIR/settings.local.json"
MEM_CONF="$MEM_DIR/memory.config.json"
METER="$SCRIPTS_DIR/memory-budget-meter.sh"
UPDATER="$REPO_ROOT/.project/memory/hooks/segment-updater.py"

# --- helpers ---
need() { command -v "$1" >/dev/null 2>&1 || return 1; }
backup_if_exists() { [[ -f "$1" ]] && cp -f "$1" "$1.bak.$(date +%Y%m%d%H%M%S)"; }

echo ">> Hybrid memory setup starting…"
mkdir -p "$SCRIPTS_DIR" "$CLAUDE_DIR" "$SEG_DIR" "$MEM_DIR/hooks" "$PROJ_DIR"

# 1) Write lean project memory config (no auto-injection)
echo ">> Writing lean memory config: $MEM_CONF"
cat > "$MEM_CONF" <<'JSON'
{
  "memory_system": {
    "enabled": true,
    "auto_update": true,
    "performance_mode": "speed",
    "cache_size": 10
  },
  "hooks": {
    "precompact": false,
    "session_start": false,
    "post_tool_use": true
  }
}
JSON

# 2) Ensure segments exist (placeholders only if missing)
echo ">> Ensuring segments exist in $SEG_DIR"
for seg in architecture domain-models workflows project-profile; do
  f="$SEG_DIR/$seg.json"
  if [[ ! -f "$f" ]]; then
    cat > "$f" <<JSON
{
  "segment": "$seg",
  "tags": ["$seg"],
  "notes": []
}
JSON
  fi
done

# 3) Install status-line token/cost meter
echo ">> Installing status-line meter: $METER"
cat > "$METER" <<'SH'
#!/usr/bin/env bash
# scripts/memory-budget-meter.sh
set -euo pipefail
LOG_FILE="${MCP_COST_HEADERS_LOG:-}"
SEG_DIR="${SEG_DIR:-.project/memory/segments}"
EST_CHARS_PER_TOKEN="${EST_CHARS_PER_TOKEN:-4}"
WARN_TOKENS="${WARN_TOKENS:-12000}"
CRIT_TOKENS="${CRIT_TOKENS:-20000}"
print_estimate () {
  if [[ -d "$SEG_DIR" ]]; then
    total_bytes=$( (find "$SEG_DIR" -maxdepth 1 -type f -name '*.json' -print0 2>/dev/null || true) \
      | xargs -0 stat -c %s 2>/dev/null | awk '{s+=$1} END{print s+0}')
  else total_bytes=0; fi
  tokens=$(( (total_bytes + EST_CHARS_PER_TOKEN - 1) / EST_CHARS_PER_TOKEN ))
  if (( tokens >= CRIT_TOKENS )); then sev="!CRIT"
  elif (( tokens >= WARN_TOKENS )); then sev="!WARN"
  else sev="OK"; fi
  echo "MEM:$sev seg≈${tokens}t (files=$(find "$SEG_DIR" -type f -name '*.json' 2>/dev/null | wc -l | tr -d ' '))"
}
if [[ -n "$LOG_FILE" && -f "$LOG_FILE" ]]; then
  line=$(tac "$LOG_FILE" | grep -m1 -E 'input_tokens|prompt_tokens' || true)
  if [[ -n "$line" ]]; then
    in=$(echo "$line"  | grep -oE '(input_tokens|prompt_tokens)[=: ] *[0-9]+' | tail -n1 | grep -oE '[0-9]+')
    out=$(echo "$line" | grep

SH
