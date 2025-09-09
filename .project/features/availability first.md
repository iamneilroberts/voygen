5) “Availability-first” itinerary flow (CE)

Start with themes & structure (what you already outlined in the Vancouver example).

Only when the user says “search packages” or “lock hotels” do you invoke mcp-chrome to pull live availability (Apple/Delta Vacations, VAX, Navitrip).

Normalize to your HotelOption / ActivityOption schema and POST it to the Orchestrator.

Run /facts/refresh → choose L/M/H → render.

Save images at publish time.

6) A pragmatic first milestone (what to build now)

Repo ready (you’re almost there):

docker-compose.yml, orchestrator/, db/d1.sql, templates/proposal.njk, .env.example, GitHub Action (done).

Itinerary editor in LibreChat:

A few query intents: trip.create, trip.add_activity, trip.add_transport, trip.shortlist_hotels, trip.render.

Each intent maps to safe HTTP endpoints in Orchestrator.

Vendor extraction:

One Trisept normalizer (Delta Vacations) and one Navitrip normalizer—just enough fields (name, city, lead_price, refundable, 2–3 rate lines, select deeplink).

Render:

HTML in proposal.njk + optional PDF via Puppeteer.

Photos:

A simple POST /assets/sign that returns a file path (or S3/R2 URL). Save on publish; reference locally in the HTML.

***

6) A pragmatic first milestone (what to build now)

Repo ready (you’re almost there):

docker-compose.yml, orchestrator/, db/d1.sql, templates/proposal.njk, .env.example, GitHub Action (done).

Itinerary editor in LibreChat:

A few query intents: trip.create, trip.add_activity, trip.add_transport, trip.shortlist_hotels, trip.render.

Each intent maps to safe HTTP endpoints in Orchestrator.

Vendor extraction:

One Trisept normalizer (Delta Vacations) and one Navitrip normalizer—just enough fields (name, city, lead_price, refundable, 2–3 rate lines, select deeplink).

Render:

HTML in proposal.njk + optional PDF via Puppeteer.

Photos:

A simple POST /assets/sign that returns a file path (or S3/R2 URL). Save on publish; reference locally in the HTML.
