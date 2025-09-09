Recommended control loop (robust + cheap)

Assemble per-turn system from:

Tiny global rules

Phase card (goal, exit criteria, allowed tools)

Output contract (JSON schema excerpt)

Send request with that system, the user/context payload, and your tool definitions.

Model returns JSON (plus brief rationale).

Run deterministic validators (server code).

If fail: either auto-fix (simple cases) or re-ask model with validator errors.

Only then persist/render.

This keeps the assistant “on rails” toward the phase finish line while staying modular and testable.

Minimal example of a “verify” tool contract
Tool definition sent to Claude
{
  "name": "verify_availability_plan",
  "description": "Verify picks use provided hotel_ids/room_codes and fit budget/refundability constraints.",
  "input_schema": {
    "type": "object",
    "properties": {
      "itinerary": { "type": "object" },
      "constraints": {
        "type":"object",
        "properties":{
          "hotel_ids":{"type":"array","items":{"type":"string"}},
          "budget":{"type":"number"},
          "budget_pct_tolerance":{"type":"number"},
          "require_refundable":{"type":"boolean"}
        },
        "required":["hotel_ids","budget","budget_pct_tolerance","require_refundable"]
      }
    },
    "required":["itinerary","constraints"]
  }
}

Handler (server) runs checks and returns:
{ "ok": false, "errors": [
  {"path":"by_city[0].picks[2]","msg":"room_code missing"},
  {"path":"by_city[0].picks[1]","msg":"price 22% above budget"}
]}
Your system message tells Claude: “After you produce the itinerary JSON, call verify_availability_plan. If ok:false, fix and re-emit JSON.”

TL;DR

Don’t keep one giant prompt. Compile a small, phase-specific system message each turn and send it via the Claude Messages API system field (your orchestrator builds it; store phase state server-side).

Yes, tools can be ‘verify’ steps—ideally deterministic validators you implement—and optionally an LLM critic tool for fuzzier checks.

This pattern keeps the assistant focused, cheap, and reliable, while remaining vendor-agnostic (works with LibreChat + MCP or your own thin proxy).

