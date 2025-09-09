#!/usr/bin/env bash
# scripts/memory-budget-meter.sh
set -euo pipefail
LOG_FILE="${MCP_COST_HEADERS_LOG:-}"

# Resolve segments directory with sensible fallbacks
if [[ -z "${SEG_DIR:-}" ]]; then
  if [[ -n "${MEMORY_BASE_DIR:-}" ]]; then
    SEG_DIR="${MEMORY_BASE_DIR%/}/segments"
  else
    SEG_DIR=".project/memory/segments"
  fi
fi

# Character-per-token estimate for size→tokens approximation
EST_CHARS_PER_TOKEN="${EST_CHARS_PER_TOKEN:-4}"

# Optional unified budget env var. If provided, derive thresholds
# unless WARN_TOKENS/CRIT_TOKENS are explicitly set.
MEMORY_BUDGET_TOKENS="${MEMORY_BUDGET_TOKENS:-}"
WARN_TOKENS_DEFAULT=12000
CRIT_TOKENS_DEFAULT=20000
if [[ -n "$MEMORY_BUDGET_TOKENS" ]] && [[ "$MEMORY_BUDGET_TOKENS" =~ ^[0-9]+$ ]] && (( MEMORY_BUDGET_TOKENS > 0 )); then
  WARN_TOKENS_DEFAULT=$(( (MEMORY_BUDGET_TOKENS * 60) / 100 ))
  CRIT_TOKENS_DEFAULT=$(( (MEMORY_BUDGET_TOKENS * 85) / 100 ))
fi
WARN_TOKENS="${WARN_TOKENS:-$WARN_TOKENS_DEFAULT}"
CRIT_TOKENS="${CRIT_TOKENS:-$CRIT_TOKENS_DEFAULT}"
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
  line=$(tac "$LOG_FILE" | grep -m1 -E 'input_tokens|prompt_tokens|output_tokens|completion_tokens' || true)
  if [[ -n "$line" ]]; then
    in=$(echo "$line"  | grep -oE '(input_tokens|prompt_tokens)[=: ] *[0-9]+' | tail -n1 | grep -oE '[0-9]+' || true)
    out=$(echo "$line" | grep -oE '(output_tokens|completion_tokens)[=: ] *[0-9]+' | tail -n1 | grep -oE '[0-9]+' || true)
    if [[ -n "${in:-}" || -n "${out:-}" ]]; then
      printf "TOK:"
      [[ -n "${in:-}" ]] && printf "in=%s " "$in"
      [[ -n "${out:-}" ]] && printf "out=%s " "$out"
      printf "| "
    fi
  fi
fi
# Always print the estimate so the status line (when supported) has output
print_estimate
