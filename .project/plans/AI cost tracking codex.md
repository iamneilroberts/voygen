“Reverse proxy / worker”—and will it work with your plan?

A reverse proxy is a server you own that sits between your app and the model API. Your Cloudflare Worker is exactly that: it forwards Anthropic requests, parses usage, writes D1 rows, and adds x-voygent-* headers your UI can read.

So yes—your Worker-based cost tracker integrates perfectly with the Exact token mode of the meter. Just have the UI grab those headers (or call the Worker’s tiny lookup endpoints), and/or have the meter tail your Worker log file. This matches the architecture in your attached “AI cost tracking” plan. 

AI cost tracking upgraded

Tip: point the status-line meter at your header log:

export MCP_COST_HEADERS_LOG="$HOME/.codex/mcp_cost_headers.log"


…and keep the Worker emitting x-voygent-* headers (as in your plan). 

AI cost tracking upgraded
