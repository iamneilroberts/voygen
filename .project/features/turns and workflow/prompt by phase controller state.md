
Short answer: don’t go back to one giant, permanent system prompt.
Do keep your modular prompts, but compile them into one tight system message per turn for the current phase. That gives you the best of both worlds: stability, testability, and small tokens—without the sprawl.

Here’s a practical way to structure it.

Why not “one big prompt”

Brittle & drifty: changes for one workflow affect others.

Hard to test: you can’t A/B or version a single blob.

Security / safety: every turn exposes more instructions than needed.

Token waste: you pay for irrelevant sections each call.

Why keep modular—but compile at runtime

Least privilege: only load the phase/tool rules you need.

Versionable: ship fixes to “Hotel Rooms (v0.7)” without touching Flights.

Deterministic: each phase has its own output schema & checklist.

Cheap: small, phase-scoped system messages.

A simple prompt stack (what to keep in each layer)

Global (always-on, tiny, immutable)

Voice/tone, brand, refusal policy.

“General operating rules” (be concise; never fabricate prices; cite source).

One-line global objective: “Help agents create bookable, profitable proposals.”

Phase Card (one per phase)

Phase goal, entry/exit criteria.

Allowed tools for this phase.

Decision policy: ask vs assume vs act.

Output contract (JSON schema).

Tool Cards (optional, only if called)

How to call; what success looks like; failure fallback.

Data Contracts

The exact schema to return (e.g., ItineraryDraft).

Context Snippets

The small, necessary facts for this step (e.g., shortlist NDJSON).

At runtime, you assemble:
GLOBAL + PHASE + (TOOL if needed) + DATA CONTRACT + CONTEXT

Minimal example (what the model sees this turn)

System (compiled this turn)

Global rules (8–10 lines)

Phase card: “Phase: City Planning → Goal: pick low/med/high hotels from bounded catalog; Exit when 3 picks made or none fit.”

Output contract (JSON schema for ItineraryDraft.by_city[])

Red lines: “Only choose from provided hotel_ids. If none fit within ±20% budget, return alternates[].”

User

TripSpec, city, budget, prefs

Shortlisted HotelOffering[] + RoomOffering[] (NDJSON)

Assistant

Returns compact JSON + short rationale strings

Keep it on track: tiny phase controller state

Have your orchestrator carry a small state object, not more prompt:
{
  "phase": "CITY_PLANNING",
  "step": 2,
  "objective": "Select low/med/high bookable hotels for Paris",
  "constraints": ["use only provided IDs", "prefer refundable", "budget 250 EUR/night ±20%"],
  "success_criteria": ["3 picks with room_code", "1-sentence rationale each"]
}

You don’t show this to the user; you render it into the system message each call. It’s your “finish-line” compass.

Tactics that work well

Checklists in the system message (3–6 bullets).
“Before you respond: (1) used only provided IDs? (2) refundable favored? (3) prices within bounds? (4) JSON validates?”

JSON-first contract: include a tiny json schema. The model tends to obey schemas more than prose.

Critic pass (optional): For high-value steps, run a tiny “self-check” prompt on the JSON to flag violations (budget, missing room_code) before you show results.

Guardrails per phase:

Planning: no prices invented; no external hotels.

Flights: never promise specific fare rules not in input.

Financials: totals = sum(lines) − discounts + fees.

Concrete file layout you can keep using with MCP
/prompts/
  global.txt                 # ~10–15 lines, rarely changes
  phases/
    city_planning_v1.md
    rooms_selection_v1.md
    flights_v1.md
    financials_v1.md
  tools/
    navitrip_rooms_v1.md
    trisept_rooms_v1.md
  contracts/
    itinerary_draft.schema.json
    financials.schema.json

“Compiler” (compile modular → single system message)

TypeScript-ish:
type CompileOpts = {
  phase: 'CITY_PLANNING'|'ROOMS_SELECTION'|'FINANCIALS';
  tool?: 'NAVITRIP'|'TRISEPT';
  contracts: string[];           // filenames
  contextBlobs: string[];        // NDJSON chunks, short summaries
};

export async function compileSystem(opts: CompileOpts) {
  const parts = [];
  parts.push(await load('prompts/global.txt'));
  parts.push(await load(`prompts/phases/${opts.phase.toLowerCase()}_v1.md`));
  if (opts.tool) parts.push(await load(`prompts/tools/${opts.tool.toLowerCase()}_rooms_v1.md`));
  for (const c of opts.contracts) parts.push(await load(`prompts/contracts/${c}`));
  return parts.join('\n\n---\n\n');  // clear separators
}

Then your call looks like:
const system = await compileSystem({
  phase: 'CITY_PLANNING',
  contracts: ['itinerary_draft.schema.json'],
  contextBlobs: [] // you put these in the user message instead
});

