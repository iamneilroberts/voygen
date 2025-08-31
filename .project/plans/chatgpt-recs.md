Heck yes—let’s turn that “college course” into a **step-by-step build plan** you can actually ship. I’ll keep each feature tight: goal → deliverable → how → paste-ready bits. We’ll assume **one DO droplet + Docker** (LibreChat + your orchestrator), **mcp-chrome** for browser work (Neon later), and **Cloudflare D1 (SQLite)** *or* Postgres. Where it matters, I’ll show the **D1-friendly** way first and note Postgres differences.

---

# 0) Project structure (monorepo-ish)

```
voygen/
  orchestrator/            # your Node/Express API (already created)
    src/
      extractors/          # site-specific scrapers
      intents/             # SQL templates (hybrid query intents)
      render/              # nunjucks -> html -> pdf
    Dockerfile
  db/
    d1.sql                 # SQLite/D1 schema & triggers
    pg.sql                 # Postgres schema (later)
  templates/
    proposal.njk           # Nunjucks template(s)
  assets/
    logos/, photos/        # local or mounted to MinIO later
```

---

# 1) Database schema (hybrid: normalized + fact table)

## Goal

Keep normalized truth for edits; also keep a **`trip_facts`** JSON blob that’s LLM/UI-friendly and **fast** to filter.

## Deliverables

* D1 schema + triggers to refresh `trip_facts` and cache `lead_price_min`.
* Same idea works in Postgres (swap JSON functions and indexes).

## How (Cloudflare D1 / SQLite)

* Use **JSON1** functions.
* Use **triggers** to recompute `trip_facts` (or do it in app code if you prefer).
* Precompute **lead\_price\_min** in a column (SQLite virtual/generated columns struggle with subqueries).

### Paste-ready: `db/d1.sql`

```sql
-- core
create table if not exists trips (
  id            text primary key,             -- uuid/slug OK
  title         text,
  party         text,                         -- JSON string: [{client_id, name, role, ...}]
  created_at    text default (datetime('now')),
  updated_at    text default (datetime('now'))
);

create table if not exists trip_legs (
  id        integer primary key autoincrement,
  trip_id   text not null references trips(id) on delete cascade,
  city      text not null,
  arrive    text not null,                    -- ISO date
  nights    integer not null,
  prefs     text                              -- JSON string
);

create table if not exists hotel_cache (
  id        integer primary key autoincrement,
  trip_id   text not null,                    -- text for D1, can be trip.id or search key
  city      text,
  json      text not null,                    -- normalized inbound hotel doc
  created_at text default (datetime('now'))
);

create table if not exists rooms_cache (
  id        integer primary key autoincrement,
  trip_id   text not null,
  hotel_key text not null,                    -- e.g., giata-id or site hotel id
  json      text not null,                    -- per-room rates/amenities
  created_at text default (datetime('now'))
);

create table if not exists trip_days (
  id        integer primary key autoincrement,
  trip_id   text not null references trips(id) on delete cascade,
  day_index integer not null,
  date      text,                             -- ISO date
  city      text
);

create table if not exists activities (
  id            integer primary key autoincrement,
  trip_day_id   integer not null references trip_days(id) on delete cascade,
  sort_order    integer not null default 0,
  type          text,
  title         text,
  description_md text,
  location      text,
  start_time    text,
  end_time      text,
  cost_amount   real,
  currency      text,
  tags          text                           -- JSON array string
);

-- facts snapshot + quick filter/sort scalar
create table if not exists trip_facts (
  trip_id       text primary key references trips(id) on delete cascade,
  facts         text not null,                -- JSON string
  lead_price_min real,                        -- cached numeric for ORDER BY filters
  updated_at    text default (datetime('now'))
);

-- proposals store snapshot used to render
create table if not exists proposals (
  id          integer primary key autoincrement,
  trip_id     text not null references trips(id) on delete cascade,
  status      text not null default 'draft',   -- draft/final/sent
  json        text not null,                   -- EXACT payload fed to the template
  created_at  text default (datetime('now'))
);

-- materialize/refresh trip_facts: call after ingest or edits
-- We do it with a view-like CTE inside a trigger-friendly UPDATE.
-- First, a helper table to mark trips that need recompute.
create table if not exists facts_dirty (trip_id text primary key);

-- triggers to mark dirty
create trigger if not exists legs_dirty after insert on trip_legs
begin
  insert into facts_dirty(trip_id) values (new.trip_id)
  on conflict(trip_id) do nothing;
end;
create trigger if not exists legs_dirty_u after update on trip_legs
begin
  insert into facts_dirty(trip_id) values (new.trip_id)
  on conflict(trip_id) do nothing;
end;
create trigger if not exists days_dirty after insert on trip_days
begin
  insert into facts_dirty(trip_id) values (new.trip_id)
  on conflict(trip_id) do nothing;
end;
create trigger if not exists acts_dirty after insert on activities
begin
  insert into facts_dirty(trip_id)
  select trip_id from trip_days where id = new.trip_day_id
  on conflict(trip_id) do nothing;
end;
create trigger if not exists trips_dirty after update on trips
begin
  insert into facts_dirty(trip_id) values (new.id)
  on conflict(trip_id) do nothing;
end;
-- you can add similar triggers on hotel_cache/rooms_cache after ingest if you store trip_id

-- recompute procedure (run from API after ingest/edits):
-- For D1, just run this block with :trip_id bound.
-- It composes facts JSON and computes lead_price_min via json_each.
-- (Doing it in API code is also fine.)
-- language-neutral SQL you call:
--   update trip_facts ...; if changes()=0 then insert ...
-- This makes it idempotent.

-- SQL to refresh one trip (bind :trip_id)
-- 1) compose JSON
with
  t as (select * from trips where id = :trip_id),
  legs as (
    select coalesce(json_group_array(
      json_object(
        'city', city,
        'arrive', arrive,
        'nights', nights,
        'prefs', coalesce(prefs,'{}')
      )
    ), '[]') as legs_json
    from trip_legs where trip_id = :trip_id
  ),
  shortlist as (
    -- order minimal price first if you prefer; here we just group.
    select coalesce(json_group_array(json(json)), '[]') as hotels_json
    from hotel_cache where trip_id = :trip_id
  ),
  rooms as (
    select coalesce(json_group_array(json(json)), '[]') as rooms_json
    from rooms_cache where trip_id = :trip_id
  ),
  days as (
    select coalesce(json_group_array(
      json_object(
        'day', day_index,
        'date', date,
        'city', city,
        'activities', coalesce((
           select json_group_array(
             json_object(
               'type', a.type, 'title', a.title, 'description_md', a.description_md,
               'location', a.location, 'start', a.start_time, 'end', a.end_time,
               'cost', a.cost_amount, 'currency', a.currency,
               'tags', coalesce(a.tags,'[]')
             )
           ) from activities a where a.trip_day_id = d.id
        ), '[]')
      )
    ), '[]') as days_json
    from trip_days d where trip_id = :trip_id
  ),
  composed as (
    select json_object(
      'party', coalesce(t.party,'[]'),
      'legs', (select legs_json from legs),
      'shortlist', (select hotels_json from shortlist),
      'rooms', (select rooms_json from rooms),
      'daily_plan', (select days_json from days)
    ) as facts_json
    from t
  ),
  minprice as (
    select min(cast(json_extract(value,'$.lead_price.amount') as real)) as p
    from json_each(json_extract((select facts_json from composed),'$.shortlist'))
    where json_extract(value,'$.lead_price.amount') is not null
  )
-- 2) upsert into trip_facts
update trip_facts
   set facts = (select facts_json from composed),
       lead_price_min = (select p from minprice),
       updated_at = datetime('now')
 where trip_id = :trip_id;

-- if none updated, insert
insert into trip_facts(trip_id, facts, lead_price_min, updated_at)
select :trip_id, (select facts_json from composed), (select p from minprice), datetime('now')
where (select changes()) = 0;
```

> **Postgres**: same tables; use `jsonb`, replace `json_group_array/json_object` with `jsonb_agg/jsonb_build_object`, and create a **GIN index** on `trip_facts.facts`. For `lead_price_min`, you can either keep the column + trigger or a **generated stored column**.

---

# 2) Extractors

We’ll use **mcp-chrome** `evaluate` to run page-context JS and return structured JSON.

## 2A) Delta Vacations / WAD (Trisept)

**Goal**: Parse room/price/amenity directly from the grid (no extra nav).

**Selectors from your snippet**: table rows inside `.avail-grid-table`; hotel name in `<h2>…a[href*='HotelInformation']`; room links and prices in sibling `<td>`s.

**Paste-ready evaluate (TypeScript-ish JS you pass to mcp-chrome):**

```js
(() => {
  const bySel = (el, sel) => Array.from(el.querySelectorAll(sel));
  const hotels = [];
  bySel(document, '.avail-grid-table').forEach(table => {
    const rows = bySel(table, 'tr');
    for (let i=0; i<rows.length-1; i+=2) {
      const head = rows[i];
      const body = rows[i+1];
      const nameA = head.querySelector('h2 a[href*="HotelInformation"]');
      if (!nameA) continue;
      const hotel = {
        name: nameA.textContent.trim(),
        details_link: nameA.getAttribute('onclick') || nameA.href || null,
        location: (head.querySelector('.hotel-location-info')?.textContent || '').trim(),
        rating: (head.querySelector('.hotel-rating-btn .aria-only')?.textContent || '').trim(),
        rooms: []
      };
      bySel(body, '.hotel-avail-room-type-wrap').forEach((rt, idx) => {
        const roomName = rt.textContent.trim().replace(/\s+/g,' ');
        const priceCell = body.querySelectorAll('.hotel-room-col-3 .price .avail-hotel-price strong')[idx];
        const price = priceCell ? priceCell.textContent.replace(/[^\d.]/g,'') : null;
        const addl = body.querySelectorAll('.hotel-room-col-2 .added-value-wrap button')[idx];
        const promo = addl ? addl.textContent.trim() : null;
        hotel.rooms.push({
          room_name: roomName,
          total_price: price ? Number(price) : null,
          promo
        });
      });
      hotels.push(hotel);
    }
  });
  return hotels;
})();
```

## 2B) Navitrip / CPMaxx (search page)

**Goal**: Get per-hotel summary + deeplinks **AND** (optionally) fetch details **without navigating** the browser.

**Selectors from your snippet**: `.property.result`, name in `.property-name`, summary in `.property-description`, amenity icons in `.property-rate-amenity`, plus a **room details page** at `/HotelEngine/hotelDetails/...` and a **“Create Hotel Sheet”** link with a **base64 payload**.

**Evaluate – listing page:**

```js
(() => {
  const cardSel = '.property.result';
  const cards = Array.from(document.querySelectorAll(cardSel));
  return cards.map(c => {
    const name = c.querySelector('.property-name')?.textContent?.trim();
    const desc = c.querySelector('.property-description small')?.textContent?.trim();
    const img = c.querySelector('.property-hotel-image')?.getAttribute('data-background-image')?.split(',')[0];
    const amenities = Array.from(c.querySelectorAll('.property-rate-amenity-name')).map(a => a.textContent.trim());
    const compare = c.querySelector('input.he-hotel-comparison');
    const data = compare ? {
      giata_id: compare.getAttribute('data-giata-id'),
      total_stay: compare.getAttribute('data-total-stay'),
      star_rating: compare.getAttribute('data-star-rating'),
      check_in: compare.getAttribute('data-check-in'),
      check_out: compare.getAttribute('data-check-out')
    } : null;
    const detailsLink = c.querySelector('.select-button')?.getAttribute('href') || null;
    const sheetLink = c.parentElement?.querySelector('a[href*="/HotelSheets/processor/selectRooms/"]')?.getAttribute('href') || null;
    return { name, desc, img, amenities, data, detailsLink, sheetLink };
  });
})();
```

**Decode that base64 “Create Hotel Sheet” (in Node, not the page):**

```ts
function parseSheetPayload(url: string) {
  // .../selectRooms/<hotelId>/<base64>
  const b64 = decodeURIComponent(url.split('/').pop() || '');
  const json = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
  return json; // has checkin/checkout, lat/lng, rooms[], nights, etc.
}
```

**Fetch room-level details WITHOUT full nav (from listing page):**
Because `evaluate` runs in-page (same origin), you can `fetch()` the details HTML and parse:

```js
(async () => {
  const links = Array.from(document.querySelectorAll('.select-button'))
    .map(a => a.getAttribute('href'))
    .filter(Boolean)
    .slice(0, 8); // cap for perf

  async function fetchDetail(href) {
    const res = await fetch(href, { credentials: 'include' });
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const rooms = Array.from(doc.querySelectorAll('.hotel-engine-room')).map(r => {
      const rname = r.querySelector('.hotel-engine-room-name')?.textContent.trim();
      const price = r.querySelector('.hotel-engine-room-footer .per-night')?.textContent.replace(/[^\d.]/g,'');
      const total = r.querySelector('.hotel-engine-room-footer .selling-price')?.textContent.replace(/[^\d.]/g,'');
      const rates = Array.from(r.querySelectorAll('.rate-options')).map(ro => {
        const label = ro.querySelector('.rate-option-label')?.textContent.trim();
        const nightly = ro.querySelector('[data-nightly]')?.getAttribute('data-nightly')?.replace(/[^\d.]/g,'');
        const taxes = ro.querySelector('[data-taxes-fees]')?.getAttribute('data-taxes-fees')?.replace(/[^\d.]/g,'');
        const refundable = /Free cancellation|Standard Rate/.test(ro.textContent);
        return { label, nightly: nightly?Number(nightly):null, taxes: taxes?Number(taxes):null, refundable };
      });
      return { room_name: rname, per_night: price?Number(price):null, total: total?Number(total):null, rates };
    });
    return { href, rooms };
  }

  const out = [];
  for (const href of links) {
    try { out.push(await fetchDetail(href)); } catch (e) { out.push({ href, error: String(e) }); }
  }
  return out;
})();
```

## 2C) VAX

VAX layouts vary, but typical anchors: table/grid with hotel rows and “View Rooms” inline. Strategy:

* Grab **hotel rows** with name, city, star; parse room blocks under the same row.
* Many fields live in **data attributes** or **hidden inputs**; enumerate them.

**Skeleton evaluate (fill selectors as you encounter them):**

```js
(() => {
  const rows = Array.from(document.querySelectorAll('[data-hotel-row], .hotelRow, tr.hotel'));
  return rows.map(r => {
    const name = r.querySelector('a[href*="HotelInformation"]')?.textContent?.trim() ||
                 r.querySelector('[data-hotel-name]')?.textContent?.trim();
    const city = r.querySelector('.city, [data-city]')?.textContent?.trim();
    const stars = r.querySelector('.rating, .stars')?.textContent?.trim();
    const rooms = Array.from(r.querySelectorAll('.room, [data-room]')).map(rr => {
      const roomName = rr.querySelector('.roomName, [data-room-name]')?.textContent?.trim();
      const price = rr.querySelector('.price, [data-price]')?.textContent?.replace(/[^\d.]/g,'');
      const refundable = /Free cancellation|Refundable/i.test(rr.textContent);
      return { roomName, price: price?Number(price):null, refundable };
    });
    return { name, city, stars, rooms };
  });
})();
```

---

# 3) Targeted high-value automations for CPMaxx agents

**Deliverables & How**

* **Auto-shortlist (per city):** Ingest N hotels, pull **rooms** (non-refundable + refundable), compute **commission%**, filter by `prefs`.
* **Cancellation window guardrail:** Parse modal text; extract **free cancel until** date; flag in facts.
* **Commission optimizer:** For room with multiple rates, choose **refundable within budget** or show **non-refundable delta**.
* **“Create Hotel Sheet” builder:** Decode base64 payload; let agent tweak guests/nights; re-encode and open.

**Commission parse (from your sample HTML):**

```ts
function parseCommission(text: string) {
  const m = text.match(/Commission\s+\$([\d.]+)\s+\(([\d.]+)%\)/i);
  return m ? { amount: Number(m[1]), pct: Number(m[2]) } : null;
}
```

---

# 4) “Travel Agent Skill Pack” (Neon later, mcp-chrome now)

**Macros to bundle:**

* `expand_trisept_rooms`: click all “View All Room Options”.
* `navitrip_collect_details`: on results page, fetch top K detail pages in background (evaluate + fetch).
* `vax_expand_inline`: click “View Rooms”, then scrape.
* `decode_sheet_link`: return JSON for the base64 selectRooms link.

You can expose these as **MCP tools** from your orchestrator: the client asks MCP, your server sends **evaluate** scripts to mcp-chrome.

---

# 5) Availability-first itinerary generation

**Idea**: Start with **dates locked** and **availability** known; then apply style/theme.

**Flow**:

1. Normalize TripSpec → cities/dates/prefs.
2. For each city: run extractor → build shortlist (≤ 6) with **at least one refundable**.
3. Compute **lead\_price\_min** per city and **commission range**.
4. Pick **L/M/H** trio per city aligning with style tags (quaint/historic/walkable).
5. Save to `trip_facts`; render proposal.

---

# 6) Availability-first proposal pipeline (end-to-end)

1. `/ingest/hotels` → write `hotel_cache`.
2. `/ingest/rooms` → write `rooms_cache`.
3. **refresh facts** SQL (above) → update `trip_facts` + `lead_price_min`.
4. `/plan/city` → pick L/M/H using prefs + refundable.
5. `/proposal/render` → Nunjucks → HTML → PDF (save images at publish).
6. `/proposal/send` (later) → email/link.

---

# 7) “Three pillars” minimal viable architecture (mcp-chrome)

```
[Agent UI: LibreChat]
        |
    (MCP)
        |
[Orchestrator API] —— calls ——> [mcp-chrome evaluate]
        |                         (in user’s browser)
        |—— Neon/D1 (facts, cache)
        |—— Nunjucks -> HTML -> PDF
```

---

# 8) Flow at a glance (MVP)

```
TripSpec -> extract city A,B,C -> shortlist+rooms -> facts -> choose L/M/H
-> render draft -> agent tweaks -> publish (save photos, freeze snapshot) -> send
```

---

# 9) Navitrip/CPMaxx: get room+amenity+pricing **without** full navigation

* From the **results page**, use `evaluate` to **fetch** each details URL (same-origin) and parse HTML with `DOMParser` (snippet above). That avoids page loads and keeps you on the results.

---

# 10) Apple/Delta Vacations (Trisept): details are in the grid

* Use the **table** parser (above); no background fetch needed.

---

# 11) Putting it together (no extra “detail search”)

* For each city, in one pass:

  * Navitrip: results → background fetch 6 detail pages → merge.
  * Trisept: results grid parse.
  * VAX: results inline parse.
* Merge into common `HotelOption`:

```ts
type HotelOption = {
  site: 'navitrip'|'trisept'|'vax',
  name: string, city?: string, giata_id?: string, img?: string,
  lead_price?: { amount:number, currency?:string },
  refundable?: boolean,
  rates: Array<{ label:string, nightly?:number, total?:number, taxes?:number, refundable?:boolean }>,
  commission?: { amount?:number, pct?:number },
  amenities?: string[],
  details_link?: string,
  sheet_link?: string
};
```

---

# 12) Phase-by-phase plan (practical)

**Phase 0 (today/tomorrow)**

* D1 schema & refresh SQL wired to `/api/refresh_facts/:tripId`.
* Trisept extractor.
* Render stack (Nunjucks→HTML; PDF later).
* Minimal proposal template (one city) + image saver.

**Phase 1**

* Navitrip extractor (listing + background details).
* L/M/H selector + refundable bias.
* Multi-city proposal.

**Phase 2**

* VAX extractor.
* Commission optimizer + cancellation guardrails.
* Save photos at **publish**.

**Phase 3**

* Intent catalog (templated queries) + facts-query fallback + admin ad-hoc SQL.
* PDF export (Puppeteer) and email sharing.

---

# 13) High-level flow (MVP checklist)

* [ ] `/ingest/hotels` (accept array of `HotelOption` → `hotel_cache`)
* [ ] `/ingest/rooms`  (accept array of rooms per hotel → `rooms_cache`)
* [ ] `refresh_facts(tripId)` → run the D1 SQL block
* [ ] `/plan/city` → pick L/M/H from facts
* [ ] `/proposal/render` → save snapshot → html(+pdf)

---

# 14) What to build first (smallest slice that sells)

1. **One city** Trisept flow → shortlist 3 rooms (L/M/H) → render pretty HTML → send link.
2. Add **Navitrip** details background fetch.
3. Add **refundable / commission** logic.

---

# 15) The rendering stack that “just works”

**Install in `orchestrator`**

```bash
npm i nunjucks html-minifier-terser
```

**`orchestrator/src/render/render.ts`**

```ts
import nunjucks from 'nunjucks';
import { minify } from 'html-minifier-terser';
import fs from 'fs/promises';
import path from 'path';

const env = new nunjucks.Environment(
  new nunjucks.FileSystemLoader(path.resolve(process.cwd(), '../templates')),
  { autoescape: true }
);

export async function renderProposal(payload: any) {
  const html = env.render('proposal.njk', payload);
  const min = await minify(html, { collapseWhitespace:true, removeComments:true, minifyCSS:true, minifyJS:true });
  const out = path.resolve(process.cwd(), '../../assets/proposals', `${payload.trip.slug || payload.trip.id}.html`);
  await fs.mkdir(path.dirname(out), { recursive: true });
  await fs.writeFile(out, min, 'utf8');
  return { path: out, html: min };
}
```

**`templates/proposal.njk` (tiny starter)**

```njk
<!doctype html><html><head>
<meta charset="utf-8"><title>{{ trip.title }}</title>
<style>
  body{font-family:system-ui,Segoe UI,Arial;margin:0;padding:24px;line-height:1.45;}
  .city{margin:24px 0;padding:16px;border:1px solid #eee;border-radius:12px;}
  .hotel{margin:12px 0;padding:12px;border:1px solid #f1f1f1;border-radius:10px;}
  .price{font-weight:bold}
</style>
</head><body>
<h1>{{ trip.title }}</h1>
<p>Party: {{ trip.party | safe }}</p>

{% for leg in legs %}
  <div class="city">
    <h2>{{ leg.city }} — {{ leg.nights }} nights (arrive {{ leg.arrive }})</h2>
    {% for h in leg.picks or [] %}
      <div class="hotel">
        <h3>{{ h.name }}</h3>
        <p>{{ h.desc }}</p>
        {% if h.lead_price %}<p class="price">From ${{ h.lead_price.amount }}</p>{% endif %}
        {% if h.rates %}<ul>
          {% for r in h.rates %}
            <li>{{ r.label }}{% if r.refundable %} (refundable){% endif %}{% if r.total %} — ${{ r.total }}{% endif %}</li>
          {% endfor %}
        </ul>{% endif %}
      </div>
    {% endfor %}
  </div>
{% endfor %}

</body></html>
```

> PDF (Puppeteer) can wait; when ready, add a container with `puppeteer` and write PDF from the rendered HTML.

---

# 16) Save photos? **Yes—at publish time**

* During `/proposal/render?final=1`, **download** the hero images you referenced and store locally (or to MinIO/S3 later) with **content hash** filenames to dedupe.

```ts
import crypto from 'crypto';
import { createWriteStream } from 'fs';
import fetch from 'node-fetch';

export async function saveImage(url: string, dir: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${url} ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const ext = (res.headers.get('content-type')||'image/jpeg').includes('png') ? 'png' : 'jpg';
  const hash = crypto.createHash('sha1').update(buf).digest('hex').slice(0,20);
  const name = `${hash}.${ext}`;
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(`${dir}/${name}`, buf);
  return name;
}
```

---

# 17) “No matching intent” fallback + dev/admin ad-hoc

**Tables (D1):**

```sql
create table if not exists intent_logs (
  id integer primary key autoincrement,
  created_at text default (datetime('now')),
  env text not null,                -- dev/admin/prod
  query_text text,
  matched_intent text,
  match_status text not null,       -- matched | generic | facts | adhoc | none
  params text,                      -- JSON
  notes text
);

create table if not exists adhoc_sql_runs (
  id integer primary key autoincrement,
  created_at text default (datetime('now')),
  env text not null,
  nl_query text,
  sql_text text,
  row_count integer,
  duration_ms integer,
  error text,
  result_sample text               -- JSON
);
```

**Workflow you’ll feel in dev**

* Try **intent** → else **facts query** (`trip_facts.facts @> …` via JSON1) → else **adhoc** (dev-only endpoint) → log → promote to new intent.

---

## Want me to generate:

* a **/api/ingest/hotels** and **/api/ingest/rooms** stub that writes caches + calls the D1 refresh SQL?
* the **facts query** endpoint for D1 using `json_extract/json_each`?
* a small **L/M/H selector** that reads `trip_facts` and returns picks per city?

Say the word and I’ll paste those next so you can tick off the first full flow (Trisept-only MVP) today.

