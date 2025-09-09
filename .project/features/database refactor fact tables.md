0) Project structure (monorepo-ish)
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

1) Database schema (hybrid: normalized + fact table)
Goal

Keep normalized truth for edits; also keep a trip_facts JSON blob that’s LLM/UI-friendly and fast to filter.

Deliverables

D1 schema + triggers to refresh trip_facts and cache lead_price_min.

Same idea works in Postgres (swap JSON functions and indexes).

How (Cloudflare D1 / SQLite)

Use JSON1 functions.

Use triggers to recompute trip_facts (or do it in app code if you prefer).

Precompute lead_price_min in a column (SQLite virtual/generated columns struggle with subqueries).

Paste-ready: db/d1.sql
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




