# Proposal Rendering System Overview

This document summarizes the recommended architecture and templates for
generating travel proposals with consistency, low LLM token cost, and
scalability.

------------------------------------------------------------------------

## Core Principle

-   **LLM outputs only data and prose** (JSON, Markdown).
-   **Templates handle layout** (Nunjucks/Handlebars).
-   **Renderer merges content → HTML → PDF** (Puppeteer).
-   **Keep HTML** for preview/sharing; **PDF** for delivery.

------------------------------------------------------------------------

## Responsibilities Breakdown

### LLM (Claude or similar)

-   Outputs structured JSON + Markdown prose:
    -   City `headline`, `fit_bullets[]`, `narrative_md`.
    -   Picks: hotel_id, room/rate info, refundable/cancel text,
        commission private data.
    -   Flights, ground, tours: details only, no HTML.
    -   Free-form extras: narrative, tips, FAQs.

### Templates (Nunjucks/Handlebars)

-   Define consistent brand look.
-   Slots for each section (city, hotel, flights, ground, tours,
    financials, next steps, insurance, free panels).
-   Hide/show agent-only sections with a flag.

### Renderer (Node.js)

-   Convert Markdown prose → HTML (with sanitization).
-   Inject into Nunjucks templates.
-   Render final HTML.
-   Print to PDF (Puppeteer).
-   Return `{html, pdf}` for storage or sharing.

------------------------------------------------------------------------

## Data Models (Schemas)

### TripSpec

``` ts
export type TripSpec = {
  party: { adults: number; children: number };
  legs: { city: string; arrive: string; nights: number }[];
  prefs: { styles: string[]; budget_per_night: number; refundable: boolean; breakfast: boolean };
};
```

### HotelOffering & RoomOffering

``` ts
export type HotelOffering = {
  id: string; name: string; city: string;
  star_rating?: number; tags: string[];
  lead_price?: { amount: number; currency: string };
  image?: string; deeplinks?: { select_hotel?: string };
};
export type RoomRate = {
  label: string; refundable: boolean;
  nightly?: number; total?: number; taxes_fees?: number; currency?: string;
  commission?: { amount?: number; percent?: number };
  policy_html?: string; select_url?: string;
};
export type RoomOffering = {
  hotel_id: string; room_code?: string; name: string; rates: RoomRate[];
};
```

### Flights

``` ts
type FlightItin = {
  pricing?: { total: number; currency: string; per_person?: number };
  segments: { carrier: string; flight: string; cabin: string;
    dep_airport: string; dep_time_iso: string;
    arr_airport: string; arr_time_iso: string; }[];
  notes_md?: string; book_link?: string;
};
```

### Ground (Transfers / Car)

``` ts
type GroundItem =
  | { type: "transfer"; mode: "private"|"shared"; route: string; date_iso: string; pax: number; total: number; currency: string; }
  | { type: "car"; vendor: string; category: string;
      pickup: { place: string; time_iso: string };
      dropoff: { place: string; time_iso: string };
      total: number; currency: string; insurance_included?: boolean; };
```

### Tours

``` ts
type TourItem = {
  title: string; date_iso?: string; duration?: string;
  total: number; currency: string;
  highlights_md?: string; inclusions_md?: string;
  book_link?: string;
};
```

### Financials

``` ts
type Financials = {
  currency: string;
  price_lines: { label: string; amount: number }[];
  discounts?: { label: string; amount: number }[];
  fees?: { label: string; amount: number }[];
  subtotal?: number; taxes?: number; total_due?: number;
  deposit?: { amount: number; due_date_iso: string; refundable?: boolean };
  payment_schedule?: { label: string; amount: number; due_date_iso: string }[];
  agent_private?: { commission_total?: number; commission_pct_est?: number };
};
```

### Next Steps

``` ts
type NextSteps = {
  checklist: { label: string; link?: string; due_date_iso?: string }[];
  cta_buttons?: { label: string; link: string }[];
};
```

### Insurance

``` ts
type InsuranceBlock = {
  recommended?: boolean;
  options: { plan_name: string; coverage_highlights_md: string; price_pp?: number; currency?: string }[];
  disclaimer_md?: string;
};
```

### Free Panels

``` ts
type FreePanel = { title: string; body_md: string; icon?: string };
```

------------------------------------------------------------------------

## Template Kit

### Files

    /templates/
      proposal.njk
      _city_block.njk
      _hotel_card.njk
      _flights.njk
      _ground.njk
      _tours.njk
      _financials.njk
      _next_steps.njk
      _insurance.njk
      _panel.njk
    /assets/
      styles.css
    /src/
      renderProposal.ts

### proposal.njk

``` njk
<!doctype html>
<html><head><meta charset="utf-8">
<title>{{ proposal.title }}</title>
<style>{{ inline_css | safe }}</style>
</head>
<body>
<header><h1>{{ proposal.title }}</h1></header>

<section class="summary">
  <h2>Overview</h2>
  <p>{{ proposal.party.adults }} adults, {{ proposal.nights_total }} nights, {{ proposal.cities | join(", ") }}</p>
</section>

{% for city in proposal.cities_blocks %}{% include "_city_block.njk" %}{% endfor %}
{% if proposal.flights %}{% include "_flights.njk" %}{% endif %}
{% if proposal.ground %}{% include "_ground.njk" %}{% endif %}
{% if proposal.tours %}{% include "_tours.njk" %}{% endif %}
{% if proposal.financials %}{% include "_financials.njk" %}{% endif %}
{% if proposal.next_steps %}{% include "_next_steps.njk" %}{% endif %}
{% if proposal.insurance %}{% include "_insurance.njk" %}{% endif %}
{% if proposal.free_panels %}{% for p in proposal.free_panels %}{% include "_panel.njk" with p %}{% endfor %}{% endif %}

</body></html>
```

### Example partial (\_financials.njk)

``` njk
<section class="financials">
  <h2>Financial Summary</h2>
  <table>
    {% for line in financials.price_lines %}
      <tr><td>{{ line.label }}</td><td>{{ financials.currency }} {{ line.amount }}</td></tr>
    {% endfor %}
    <tr><td>Total</td><td><strong>{{ financials.currency }} {{ financials.total_due }}</strong></td></tr>
  </table>
  {% if financials.deposit %}<p>Deposit: {{ financials.currency }} {{ financials.deposit.amount }} due {{ financials.deposit.due_date_iso }}</p>{% endif %}
</section>
```

------------------------------------------------------------------------

## Rendering Flow

### renderProposal.ts (simplified)

``` ts
import nunjucks from 'nunjucks';
import MarkdownIt from 'markdown-it';
import sanitizeHtml from 'sanitize-html';
import puppeteer from 'puppeteer';

const md = new MarkdownIt({ linkify:true, breaks:true });
const sanitize = (h:string) => sanitizeHtml(md.render(h||''));

export async function renderProposal(proposal:any) {
  const env = nunjucks.configure('templates',{autoescape:true});
  // preprocess Markdown fields into HTML
  proposal.summary_html = sanitize(proposal.summary_md);
  // render
  const html = env.render('proposal.njk',{proposal,inline_css:"/* styles here */"});
  // pdf
  const browser = await puppeteer.launch({headless:'new'});
  const page = await browser.newPage();
  await page.setContent(html);
  const pdf = await page.pdf({format:'Letter',printBackground:true});
  await browser.close();
  return { html, pdf };
}
```

------------------------------------------------------------------------

## Delivery

-   **HTML**: preview, share via link, editable.\
-   **PDF**: polished deliverable for clients.\
-   **Email-safe**: optionally transform summary into MJML for mailing.\
-   **Agent-only flags**: hide commission/private data in client-facing
    render.

------------------------------------------------------------------------

## Benefits

-   Stable, branded look.\
-   Small, cheap LLM prompts.\
-   Fast rendering.\
-   Clear path to multi-tenant scaling (later add template server).

------------------------------------------------------------------------
