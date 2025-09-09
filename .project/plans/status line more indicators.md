More things you can show in status_line

Add any of these as type="command" entries (each prints one short line). Pick 2–4 max so the bar stays readable.

Git branch + dirty flag

# scripts/sl-git.sh
#!/usr/bin/env bash
b=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '?')
dirty=$(git status --porcelain 2>/dev/null | wc -l)
echo "git:${b}${dirty:+*}${dirty:+(${dirty})}"


Last test result (cached)

# scripts/sl-tests.sh
#!/usr/bin/env bash
f=.project/.last_test.txt
[[ -f $f ]] && cat "$f" || echo "tests:—"
# (append to the file from your test runner: echo "tests:pass (132)" > $f)


D1 spend today (your cost logger)

# scripts/sl-spend-today.sh
#!/usr/bin/env bash
set -euo pipefail
DB="${VOYGENT_D1_DB:-voygent_usage}"
usd=$(wrangler d1 execute "$DB" --json --command \
'SELECT ROUND(COALESCE(SUM(cost_usd),0), 4) usd
 FROM usage_events
 WHERE ts >= strftime("%s","now","start of day")*1000;' \
| jq -r '.[0].results[0].usd' 2>/dev/null || echo "0.0000")
echo "spend:$${usd}"


MCP health ping (up/down)

# scripts/sl-mcp-health.sh
#!/usr/bin/env bash
ok=()
for name in mcp-chrome d1-database github-mcp project-memory; do
  # quick heuristic: process table for local, or curl for HTTP
  if [[ "$name" == "mcp-chrome" || "$name" == "project-memory" ]]; then
    pgrep -fl "$name" >/dev/null && ok+=("$name") || true
  else
    curl -sSf --max-time 1 "https://${name}.example/ping" >/dev/null 2>&1 && ok+=("$name") || true
  fi
done
echo "mcp:${#ok[@]}↑"


Spec-Kit phase badge

# scripts/sl-spec-phase.sh
#!/usr/bin/env bash
f=.project/specs/.phase
[[ -f $f ]] && p=$(cat "$f") || p="—"
echo "spec:$p"
# (write one of: specify | plan | tasks | validate)


Then in ~/.codex/config.toml:

[status_line]
type = "command"
command = "scripts/memory-budget-meter.sh"

[[status_line.extra]]
type = "command"
command = "scripts/sl-git.sh"

[[status_line.extra]]
type = "command"
command = "scripts/sl-spend-today.sh"

[[status_line.extra]]
type = "command"
command = "scripts/sl-spec-phase.sh"
