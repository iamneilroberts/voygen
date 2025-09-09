3) Targeted high-value automations for CPMaxx agents

Deliverables & How

Auto-shortlist (per city): Ingest N hotels, pull rooms (non-refundable + refundable), compute commission%, filter by prefs.

Cancellation window guardrail: Parse modal text; extract free cancel until date; flag in facts.

Commission optimizer: For room with multiple rates, choose refundable within budget or show non-refundable delta.

“Create Hotel Sheet” builder: Decode base64 payload; let agent tweak guests/nights; re-encode and open.

Commission parse (from your sample HTML):
function parseCommission(text: string) {
  const m = text.match(/Commission\s+\$([\d.]+)\s+\(([\d.]+)%\)/i);
  return m ? { amount: Number(m[1]), pct: Number(m[2]) } : null;
}

