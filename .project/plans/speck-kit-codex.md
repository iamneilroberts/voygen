Spec-Kit with Codex? Yes.

Your Spec-Kit plan (spec-driven flow: /specify → /plan → /tasks → /validate) drops right into Codex. Store specs under .project/specs/…, version with git, and expose a couple of helpers (e.g., scripts/spec-phase set plan) that also update the status_line badge above. The file you shared already lays out directory structure, commands, and MCP tie-ins—Codex is a great fit. 

spec-kit-claude-code-implementa…

Quick Codex glue (commands as tiny shell wrappers so you can run them from the palette):

# scripts/specify.sh
#!/usr/bin/env bash
set -euo pipefail
mkdir -p .project/specs/active
f=".project/specs/active/$(date +%Y-%m-%d)_functional-spec.md"
printf "# Functional Spec\n\n" > "$f"
echo "Created $f"
echo "specify" > .project/specs/.phase


(Repeat for plan, tasks, validate to keep your phase badge current.)
