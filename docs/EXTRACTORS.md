**Overview**
- Implements modular web content extraction using MCP Chrome injection.
- Two injected scripts:
  - `SMART_RESULTS_EXTRACTOR_JS`: Extracts hotel search results (WAD/VAX/Navitrip/generic). Returns gzipped NDJSON of HotelRow.
  - `GENERIC_TRAVEL_PARSER_JS`: Extracts ad‑hoc travel facts (flights/hotels/events/places/generic) as gzipped JSON.

**Key Files**
- `src/extractors/types.ts`: Shared types (HotelRow/DTO, ExtractResult, TravelFacts, ParserResult).
- `src/extractors/scripts.ts`: JS strings for in‑page execution via MCP Chrome.
- `src/wrappers/inflate.ts`: Base64+gzip decode helpers for NDJSON/JSON.
- `src/wrappers/hotel-extract-helper.ts`: Map `HotelRow` → `HotelDTO`.
- `src/wrappers/extractors.ts`: Thin wrappers to invoke injection and post‑process results.

**Usage**
- Provide an injector that knows how to call your MCP tool (e.g., `chrome_inject_script`).

```ts
import { makeChromeInjectorAdapter, injectSmartResults, injectGenericFacts } from '../src/wrappers/extractors';

// Example MCP client adapter shape
async function chromeInjectTool(input: { scriptBody: string; args?: any }) {
  // Replace with your MCP call, e.g. tool.call('chrome_inject_script', input)
  return await myMcpClient.call('chrome_inject_script', input);
}

const injector = makeChromeInjectorAdapter(chromeInjectTool);

// Results pages (hotels)
const hotels = await injectSmartResults(injector, { pageTypeHint: 'wad', maxRows: 3000 });
console.log(hotels.raw.meta, hotels.rows?.length, hotels.dtos?.length);

// Ad‑hoc facts (invoices/confirmations/markets)
const facts = await injectGenericFacts(injector, { hint: 'hotel confirmation', preferKind: ['hotel'] });
console.log(facts.raw.meta, facts.facts?.length);
```

**Notes**
- Scripts aim for one injection per page; prioritize hydration/XHR with DOM fallback.
- All bulk rows compress to NDJSON gzip; ad‑hoc facts compress as JSON gzip.
- Telemetry is included in the result `meta` for debugging and performance.

