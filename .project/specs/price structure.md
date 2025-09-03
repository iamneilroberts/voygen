Perfect—let’s tackle both things:

---

# 🌐 Mock SaaS Pricing Page Copy (Voygen.ai)

**Headline:**
🚀 *Itineraries that sell. Automations that save hours. A travel agent’s secret weapon.*

---

### Starter – \$29/mo

For solo advisors exploring AI-first itineraries.

✅ 10 itineraries/month
✅ AI-assisted trip builder (Claude/GPT-mini)
✅ Client-facing website link (hosted by Voygen.ai)
✅ PDF export
❌ White label branding
❌ Vendor automations

**Best for:** Freelancers, side-hustlers, new agents.

---

### Pro – \$79/mo

For professional agents ready to scale with AI.

✅ Unlimited itineraries
✅ White label (your logo & domain)
✅ Custom proposal templates
✅ Advanced AI proposal drafts (Claude Sonnet)
✅ Cloud-hosted dashboard

**Best for:** Independent advisors who want Travefy-killer workflows.

---

### Pro+ Automation – \$149/mo

For agents who need availability-checked itineraries, not “dreamboards.”

✅ Everything in Pro
✅ Live vendor availability (CPMaxx, VAX, Delta Vacations)
✅ Commission-aware room/rate picking
✅ Availability-first proposal generation
✅ Hotel & flight cache for rapid follow-ups

**Best for:** High-volume agents doing complex trips.

---

### Agency – from \$399/mo

For teams who need visibility, consistency, and automation across the office.

✅ Everything in Pro+
✅ Multi-agent dashboard
✅ Shared CRM-lite with client records
✅ Payment & commission tracking (CPMaxx sync)
✅ Custom domain & branding
✅ Priority support

**Best for:** Agencies with 5+ advisors who need unified reporting and dashboards.

---

*(Later Phase 3 upgrades → \$799+ / \$1,499+ tiers, with deep CRM, accounting, and back-office integration.)*

---

# 🛠️ Making Voygen.ai “SaaS-like” While Still Using Local Components

Right now, you’ve got **two local dependencies**:

* **LibreChat** (chat/orchestration hub)
* **mcp-chrome** (browser automation)

That makes it not-quite SaaS, because:

* Users can’t just log into a web dashboard and go.
* They need a local install (Docker, CLI, etc.) to run browser automation.

Here’s how you can make it “SaaS-like” *from day one*, even before fully cloud-hosting everything:

---

### 1. **Hosted Web Dashboard (SaaS face)**

* You host the web dashboard (LibreChat UI + your orchestrator APIs).
* Each user has a login, trips are saved in your Neon/Postgres DB.
* Looks/feels like SaaS—“log in at voygen.ai.”

---

### 2. **Local Helper (Agent Runner)**

* Instead of users running *everything* locally, you ship a **tiny helper app** (CLI or lightweight tray app) that runs `mcp-chrome` on their machine.
* It connects securely to your hosted dashboard via WebSocket or API key.
* To them, it just feels like the “Chrome connector” they need to install once.

*(Think Zoom desktop app connecting to Zoom’s hosted service.)*

---

### 3. **Hybrid Execution**

* **You host:** The orchestrator, DB, proposal renderer, dashboard.
* **They host:** Only the browser automation piece (until Opera Neon or similar gives you a stable hosted automation option).

This way:

* To the user → It’s SaaS. They log into voygen.ai, create itineraries, run searches.
* Behind the scenes → If they click “Search Hotels,” your server sends a job request to their local `mcp-chrome`.

---

### 4. **Future: Full SaaS**

Once a hosted automation (Opera Neon, Playwright-as-a-service, or your own browser cluster) is viable:

* You absorb the last local dependency.
* No install required → fully cloud SaaS.
* At that point, the local-helper goes away, and you can *actually* be “Travefy replacement with superpowers.”

---

# 🔑 Key Point

👉 **Open-source + BYOK** works like a “try before you buy.”

* Power users self-host, learn the product, contribute feedback.
* Most agents won’t want to mess with Docker/local MCP setup → they’ll pay for hosted convenience.
* Even with mcp-chrome staying local for now, you can package it as a **“Voygen Chrome Helper” installer** → feels like installing Zoom or Dropbox client.

---

Would you like me to sketch how that **Agent Runner / Chrome Helper** should be structured (tech stack, comms between local ↔ hosted), so you can see what the smallest viable version looks like?
