#!/usr/bin/env bash

# Guard wrangler D1 commands to always use --remote
wrangler() {
  if [[ "$1" == "d1" ]]; then
    case "$2" in
      execute|export|import|info|list)
        if [[ "$*" != *"--remote"* ]]; then
          echo "Refusing to run 'wrangler d1' without --remote. Use --remote or call 'wdr' wrapper." >&2
          return 1
        fi
        ;;
    esac
  fi
  command wrangler "$@"
}

# Shortcut for D1 with correct config and --remote
alias wdr='wrangler d1 --remote --config remote-mcp-servers/d1-database-improved/wrangler.toml'

echo "Loaded wrangler guard. Use 'wdr' for D1 with --remote enforced."

