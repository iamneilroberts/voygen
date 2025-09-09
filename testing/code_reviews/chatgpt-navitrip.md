Here’s a tight, opinionated review + concrete upgrades. Overall: the “current-page only, user drives; tool extracts” approach is exactly right for cpmaxx/NaviTrip. The biggest risk is relying only on DOM scraping; the biggest win is adding network/state taps and sturdier stability gates.

# Quick verdict

* **Suitability:** Strong. Low-friction, low-risk, and aligns with SPA/lazy-load behavior you’ll see in cpmaxx/NaviTrip.
* **Main gaps to close:** (1) stability detection (DOM-only is brittle), (2) selector robustness (prefer state JSON > DOM when available), (3) pagination/infinite scroll nuances, (4) field semantics (per-night vs per-stay, taxes/fees), (5) duplicate detection and IDs, (6) metrics+QA harness.

# High-impact upgrades (in priority order)

## 1) Make “content stability” multi-signal (DOM + network + idle)

* **Add network-idle gate:** Wait until no XHR/fetch requests for ≥800–1200 ms *and* DOM node count within the result container is stable across N ticks (3–4).
* **Mutation window debounce:** Start a 1s timer; if any mutation occurs, reset. When timer completes, you’re stable.
* **Layout/paint idle:** After network + DOM stable, add one `requestAnimationFrame` cycle to ensure images/srcsets have settled.

*Pseudocode (inside your mcp-chrome tool):*

```js
await enableCDP(['Network', 'Page', 'DOM', 'Runtime']);
const netIdle = waitForNetworkIdle(1000);         // no inflight requests
const domStable = waitForMutationsStable('#results', 3, 1000);
await Promise.all([netIdle, domStable]);
await rafOnce(); // extra settle
```

## 2) Prefer state JSON over DOM when possible

* **Tap app state:** Many SPAs expose JSON in `window.__NUXT__`, `__NEXT_DATA__`, Redux stores, or script tags (JSON-LD). Attempt, in order:

  1. **Network sniff:** capture fetch/XHR responses for hotel list endpoints and parse JSON.
  2. **App globals:** probe `window.*` candidates.
  3. **DOM fallback:** your current multi-selector plan.
* **Why:** fewer selector breakages, fuller fields (IDs, lat/lon, supplier rate types).

## 3) Selector robustness (when you must scrape DOM)

* **Use resilient anchors:** prefer `data-qa`, `data-testid`, ARIA labels, semantic landmarks. Keep a versioned list of selector “recipes” per site flavor.
* **Text-pattern helpers:** normalize whitespace, strip soft hyphens, decode HTML entities, handle `data-src`/`srcset`/`picture > source`.
* **Shadow DOM & virtualized lists:** detect virtualization and auto-scroll the container to materialize items before reading.

## 4) Pagination & infinite scroll

* **Two modes:**

  * **“Load more” button:** click → wait (network+dom idle) → loop with max pages cap (your 5-page cap is good; also cap at 250 items).
  * **Infinite scroll:** `IntersectionObserver` pinned to “sentinel” after last card to trigger scroll chunks until either (a) no new cards, (b) page cap, or (c) time cap.
* **Duplicate defense:** hash each card by `(normalizedName|address|city|hotelId|geo)` combo; skip repeats across pages.

## 5) Field semantics & normalization (NaviTrip specifics)

* **Price:** detect **per-night**, **per-stay**, board basis (RO/BB/HB/AI), and **taxes/fees included vs excluded**. Keep **both** raw string and normalized numeric (in cents) + flags:

  ```json
  {"price": {"amount_cents": 15000, "currency": "EUR", "basis": "per_night", "includes_taxes": false, "raw": "ab €150 pro Nacht zzgl. Steuern"}}
  ```
* **Currency:** parse symbol/code (`€`, `EUR`) and convert only if you have a verified rate source; otherwise store as-is + optional converted field.
* **Ratings:** distinguish **user score** (0–10) vs **star category** (1–5). Your 10→5 normalization is fine; also store raw.
* **Images:** prefer the largest `srcset` candidate under a sane max (e.g., ≤1600w). Resolve relative URLs; handle lazy loaders (`data-src`, `data-original`, background-image).
* **Language:** expand German lexicon beyond “pro Nacht/Preis” to include **“inkl./zzgl. Steuern/Gebühren”, “Gesamtpreis”, “Zimmer”, “Frühstück”**.

## 6) Validation & acceptance gates

* **Per-field validation:** instead of a flat “>30% valid”, use:

  * **Required core:** name, price.raw OR availability flag, and either address/city or a stable hotelId.
  * **Sanity checks:**

    * Price: 10–5000 **per night**; allow >5000 if basis is per-stay (flag as outlier).
    * Name: ≥2 chars, not all caps unless short; reject if only numbers.
    * Image: HTTP(S), not data URL, 200–8000 px width.
* **Quality score:** compute 0–1 score; only return cards ≥0.6 unless user asks for partials.

## 7) Resilience playbook (clear fallbacks)

Your “4 fallback methods” are great; define them explicitly and try in order:

1. **Network JSON** (best)
2. **App state globals**
3. **Semantic DOM selectors**
4. **Heuristic DOM text mining**
   Add **circuit breakers**: if page structure shifts (huge exception spike), fall back earlier and log signature.

## 8) Performance targets & measurement

* **Targets:** keep your **<8s/50 hotels**, but track **p50/p95** separately. Add time caps for pagination (e.g., 12s total ceiling).
* **Concurrency:** DOM extraction in a single pass; parsing can be parallel in workers. Avoid concurrent `getComputedStyle` thrash.
* **Metrics you should emit:** items seen/extracted/skipped, pages traversed, time per phase, error types, selector hit counts.

## 9) Duplicate detection that actually works

* **Stable IDs:** look for any `data-hotel-id` or ID in detail URLs (`.../hotel/12345?…`).
* **Fuzzy fallback:** Jaro-Winkler on name + city; normalize by removing stop-words (“hotel”, “the”, “&”), accents, punctuation. Use address or geo if present.

## 10) Test harness & snapshots (huge for regressions)

* **Record & replay:** save HTML snapshots + captured XHR JSON from real sessions (with PII scrubbed). Run your extractor offline against these “golden” pages for CI.
* **Synthetic pages:** craft pages that purposely vary (price formats, lazy images, missing fields) to ensure parsers don’t over-fit.
* **Diff-based alerts:** if field coverage drops >5% vs baseline, fail the build.

## 11) Data schema (suggested)

```json
{
  "source": "navitrip",
  "session_id": "...",
  "query_context": {"city": "Berlin", "dates": {"in":"2026-04-06","out":"2026-04-17"}, "adults": 2},
  "hotels": [{
    "hotel_id": "12345",
    "name": "Hotel Beispiel",
    "stars": 4,
    "user_rating": {"raw": 8.6, "scale": 10, "normalized_5": 4.3},
    "location": {"address": "…", "city": "…", "lat": 52.5, "lng": 13.4},
    "price": {"amount_cents": 15000, "currency": "EUR", "basis": "per_night", "includes_taxes": false, "raw": "ab €150 pro Nacht"},
    "availability": {"is_available": true, "rooms": [{"name":"Doppelzimmer","board":"BB","cancellable":true}]},
    "amenities": ["WLAN", "Klimaanlage"],
    "images": [{"url":"https://…/img.jpg","width":1200,"height":800}],
    "raw": {"dom": "...optional...", "json": "...optional..."}
  }]
}
```

## 12) Error handling & UX

* **Explain partials:** if only prices or only names were extracted, return with a short “what’s missing & why” note.
* **Auto-retry knobs:** one retry with different selector pack; never infinite retries.
* **Graceful stop:** if login wall/captcha appears, stop and surface a clear message.

## 13) Compliance & safety

* **Respect ToS:** keep extraction strictly “user-present / on-page”. Don’t automate navigation or bypass auth.
* **PII hygiene:** never store traveler names/emails from cpmaxx; store only hotel search data needed for proposals.
* **Rate limiting:** avoid hammering “load more”.

---

## Small code patterns you’ll want

**Network capture (CDP):**

```js
Network.requestWillBeSent(({request}) => {
  if (request.url.includes('/hotels') || request.headers['x-api-key']) track(request);
});
Network.responseReceived(async ({requestId, response}) => {
  if (isHotelList(response.url)) {
    const body = await Network.getResponseBody({requestId});
    maybeParseAndCache(JSON.parse(body.body));
  }
});
```

**Stable extraction loop:**

```js
await waitForPageStable();
const cards = qsa('#results .hotel-card');           // robust selector pack inside
for (const card of cards) { extractCard(card); }
await maybePaginateAndRepeat();                      // load more / scroll / page 2..N
dedupeAndValidate();
```

---

## Final calibration against your review focus

* **Content detection timing:** add **network-idle + mutation debounce + one RAF**.
* **Selector robustness:** add state-JSON interception + versioned selector packs with telemetry.
* **Pagination strategy:** support both “load more” and infinite scroll with caps, plus duplicate defense.
* **Error handling depth:** explicit fallback order; circuit breakers; clear user-facing partials messaging.
* **NaviTrip parsing accuracy:** broaden German/price lexicon; keep raw + normalized; distinguish star vs user ratings.

If you want, I can turn this into a plug-and-play extractor module for your mcp-chrome tool (with the selector packs and metrics scaffolding baked in).

