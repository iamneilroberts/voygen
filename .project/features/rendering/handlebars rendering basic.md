proposals.json — “snapshot used to render”

When you generate a proposal, you pass a structured payload into your Nunjucks template (chosen hotels/rooms, flights, ground, tours, financials, prose). Save that exact payload in proposals.json.

Why:

Auditability / reproducibility: months later, you can regenerate the same PDF/HTML, even if prices or templates changed.

Diffs: compare draft v1 vs v2 (what changed? room? price?).

Fast re-render: change a hero photo or toggle “agent notes” and re-render without requerying suppliers.

It’s not the live truth; it’s the exact data used for that render.
