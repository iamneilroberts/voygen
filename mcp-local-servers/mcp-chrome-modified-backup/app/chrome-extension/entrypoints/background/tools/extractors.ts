import { createErrorResponse, ToolResult } from '@/common/tool-handler';
import { BaseBrowserToolExecutor } from './base-browser';
import { TOOL_NAMES } from 'chrome-mcp-shared';
import { ExecutionWorld } from '@/common/constants';

type World = ExecutionWorld;

async function ensureTab(url?: string) {
  let tab: chrome.tabs.Tab | undefined;
  if (url) {
    const allTabs = await chrome.tabs.query({});
    const normalized = (u: string) => (u.endsWith('/') ? u.slice(0, -1) : u);
    tab = allTabs.find((t) => t.url && normalized(t.url) === normalized(url));
    if (!tab) {
      tab = await chrome.tabs.create({ url, active: true });
      await new Promise((r) => setTimeout(r, 2500));
    }
  } else {
    const tabs = await chrome.tabs.query({ active: true });
    tab = tabs[0];
  }
  if (!tab || !tab.id) throw new Error('No active tab available');
  await chrome.tabs.update(tab.id, { active: true });
  return tab.id;
}

async function execInWorld<T = any>(tabId: number, world: World, code: string): Promise<T> {
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    func: (c) => new Function(c)(),
    args: [code],
    world,
  });
  return result as T;
}

// Embedded scripts adapted from project extractors
const SMART_RESULTS_EXTRACTOR_JS = `
(async (args) => {
  const t0 = performance.now();
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const MAX_ROWS = clamp(args?.maxRows ?? 5000, 100, 20000);
  const notes = [];
  const classify = () => {
    if (args?.pageTypeHint) return args.pageTypeHint;
    const host = location.hostname.toLowerCase();
    const title = (document.title || '').toLowerCase();
    const textPeek = (document.querySelector('h1,h2,[role=heading]')?.textContent || '').toLowerCase();
    const srcs = [...document.querySelectorAll('script[src],link[href]')].map(el => el.src || el.href).join(' ');
    const htmlHead = document.documentElement.innerHTML.slice(0, 2e4);
    const isVAX = /vacationaccess|vax/i.test(host) || /bookingservices|algv|funjet|mlt/i.test(srcs);
    const isWAD = /worldagentdirect|delta/i.test(host) || /wad|world agent/i.test(title + textPeek);
    const isNavCP = /navitrip|cpmaxx|cruiseplanners/i.test(host) || /__viewstate|aspnetform/i.test(htmlHead);
    if (isWAD) return 'wad';
    if (isVAX) return 'vax';
    if (isNavCP) return 'navitrip_cp';
    return 'generic';
  };
  const pageType = classify();
  const addrJoin = (a) => { if (!a) return undefined; const parts = [a.full, a.line1, a.line2, a.city, a.region, a.postalCode, a.country].filter(Boolean); return [...new Set(parts)].join(', '); };
  const mapRow = (r) => ({
    id: r?.id || r?.hotelId || r?.propertyId || r?.code || r?.slug,
    name: r?.name || r?.propertyName,
    brand: r?.brand || r?.chain || r?.vendor,
    lat: r?.geo?.lat ?? r?.latitude,
    lon: r?.geo?.lng ?? r?.longitude,
    address: addrJoin(r?.address) || [r?.address?.line1, r?.address?.city, r?.address?.country].filter(Boolean).join(', ') || r?.address,
    star_rating: r?.starRating ?? r?.rating?.stars ?? r?.rating,
    review_score: r?.review?.score ?? r?.reviewScore,
    price_text: r?.price?.display || r?.price?.formatted || r?.lowestPrice?.display || r?.rate?.display || r?.price,
    currency: r?.price?.currency || r?.currency,
    taxes_fees_text: r?.fees?.display || r?.taxesAndFees || r?.price?.taxesAndFees,
    cancel_text: r?.cancellationPolicy?.short || r?.cancellation?.summary || r?.refundability,
    refundable: !!(r?.cancellationPolicy?.refundable ?? r?.refundable),
    package_type: r?.packageType || r?.productType,
    image: r?.images?.[0]?.url || r?.media?.[0]?.url,
    detail_url: r?.url || r?.canonicalUrl || (r?.slug ? '/hotels/' + r.slug : undefined)
  });
  const toNDJSON = (rows) => rows.map(o => JSON.stringify(o)).join('\n');
  async function gzipBase64(str) {
    const cs = new CompressionStream('gzip');
    const writer = cs.writable.getWriter();
    writer.write(new TextEncoder().encode(str));
    await writer.close();
    const gz = await new Response(cs.readable).arrayBuffer();
    return btoa(String.fromCharCode(...new Uint8Array(gz)));
  }
  const tryHydration = () => {
    const keys = ['__INITIAL_STATE__','__PRELOADED_STATE__','__REDUX_STATE__','__NUXT__','__NEXT_DATA__','__APOLLO_STATE__'];
    for (const k of keys) {
      if (!(k in window)) continue;
      let items = [];
      try {
        const w = window[k];
        items = w?.props?.pageProps?.results || w?.search?.results?.hotels || w?.results?.hotels || w?.data?.search?.results || [];
      } catch {}
      if (Array.isArray(items) && items.length) {
        items = items.slice(0, MAX_ROWS);
        return { route: 'hydration', rows: items.map(mapRow), meta: { hydrationKey: k } };
      }
    }
    for (const s of document.querySelectorAll('script[type="application/json"]')) {
      try {
        const j = JSON.parse(s.textContent || '');
        const items = j?.hotels || j?.properties || j?.results;
        if (Array.isArray(items) && items.length) {
          const rows = items.slice(0, MAX_ROWS).map(mapRow);
          return { route: 'hydration', rows, meta: { hydrationKey: 'inline' } };
        }
      } catch {}
    }
    return null;
  };
  async function tryXHR() {
    const urls = performance.getEntriesByType('resource').map(e => e.name).filter(u => /api|search|result|hotel|property|availability|booking|services|graphql|trams/i.test(u));
    const uniq = [...new Set(urls)];
    if (!uniq.length) return null;
    const pick = (arr) => arr.find(u => new URL(u).origin === location.origin && /hotel|results|search/i.test(u)) || arr.find(u => /hotel|results|search/i.test(u)) || arr[0];
    const endpoint = pick(uniq);
    if (!endpoint) return null;
    try {
      const r = await fetch(endpoint, { credentials: 'include' });
      const j = await r.json().catch(() => null);
      if (!j) return null;
      let items = j?.hotels || j?.properties || j?.results || j?.data?.hotels || j?.data?.search?.results || [];
      if (!Array.isArray(items) || !items.length) return null;
      items = items.slice(0, MAX_ROWS);
      return { route: 'xhr', rows: items.map(mapRow), meta: { endpoint } };
    } catch { return null; }
  }
  async function tryDOM() {
    const sel =
      args?.domSelector ||
      '.hotel-card,[data-result-id],[data-hotel-id],tr.result-row,.result-row,.hotel,.hotel-result,.property,.search-card,.card';
    const cards = [...document.querySelectorAll(sel)];
    if (!cards.length) return null;
    const toRowDOM = el => ({
      id: el.getAttribute('data-hotel-id') || el.getAttribute('data-result-id') || el.querySelector('[data-id]')?.getAttribute('data-id'),
      name: el.querySelector('.hotel-name,[itemprop="name"]')?.textContent?.trim(),
      price_text: el.querySelector('.price,.rate,[data-test="price"]')?.textContent?.trim(),
      star_rating: el.querySelector('[data-stars]')?.getAttribute('data-stars') || el.querySelector('[aria-label*="star"]')?.ariaLabel,
      address: el.querySelector('.address,[itemprop="address"]')?.textContent?.trim(),
      detail_url: el.querySelector('a[href*="hotel"],a[href*="property"]')?.href,
      image: el.querySelector('img')?.src
    });
    const n = Math.min(cards.length, MAX_ROWS);
    const batch = 500, rows = [];
    for (let i = 0; i < n; i += batch) {
      rows.push(...cards.slice(i, i + batch).map(toRowDOM));
      await new Promise(r => setTimeout(r, 0));
    }
    return { route: 'dom', rows, meta: { selector: sel } };
  }
  let result = null;
  if (classify() === 'vax') {
    result = tryHydration() || await tryXHR() || await tryDOM();
  } else if (['wad','navitrip_cp'].includes(classify())) {
    result = await tryXHR() || tryHydration() || await tryDOM();
  } else {
    result = tryHydration() || await tryXHR() || await tryDOM();
  }
  if (!result) return { ok:false, error:'No results via hydration/xhr/dom', meta:{} };
  const ndjson = toNDJSON(result.rows);
  const gz = await gzipBase64(ndjson);
  const t1 = performance.now();
  return { ok: true, route: result.route, count: result.rows.length, sample: result.rows.slice(0,3), ndjson_gz_base64: gz, meta: { ...result.meta, timing_ms: Math.round(t1-t0) } };
})/*ARGS_PLACEHOLDER*/
`;

const GENERIC_TRAVEL_PARSER_JS = `
(async (args) => {
  const t0 = performance.now();
  const hint = (args?.hint || '').toLowerCase();
  const maxChars = Math.max(50000, Math.min(args?.maxChars ?? 250000, 1000000));
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  const textOf = (el) => el?.textContent?.replace(/\s+/g,' ').trim() || '';
  const toISODate = (s) => {
    if (!s) return undefined;
    const m = s.match(/\b(\d{4})[-\/\.](\d{1,2})[-\/\.](\d{1,2})\b/) || s.match(/\b(\d{1,2})[\/\.](\d{1,2})[\/\.](\d{2,4})\b/) || s.match(/\b([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})\b/);
    if (!m) return undefined;
    try {
      let dt;
      if (m.length === 4 && isNaN(Number(m[1]))) dt = new Date(String(m[1]) + ' ' + String(m[2]) + ' ' + String(m[3]));
      else if (m.length === 4 && Number(m[1]) > 1900) dt = new Date(String(m[1]) + '-' + String(m[2]) + '-' + String(m[3]));
      else { const y = m[3].length === 2 ? '20'+m[3] : m[3]; dt = new Date(String(y) + '-' + String(m[1]) + '-' + String(m[2])); }
      return isNaN(+dt) ? undefined : dt.toISOString();
    } catch { return undefined; }
  }
  async function gzipBase64(json) {
    const cs = new CompressionStream('gzip');
    const w = cs.writable.getWriter();
    w.write(new TextEncoder().encode(json));
    await w.close();
    const ab = await new Response(cs.readable).arrayBuffer();
    return btoa(String.fromCharCode(...new Uint8Array(ab)));
  }
  const prefer = Array.isArray(args?.preferKind) ? args.preferKind : [];
  const targetKind = prefer[0] || (/(?:flight|pnr|record locator|airline|segment)/i.test(hint) ? 'flight' : /(hotel|check[- ]?in|check[- ]?out|lodging|resort)/i.test(hint) ? 'hotel' : /(confirm|reservation|booking)/i.test(hint) ? 'reservation' : /(event|tour|ticket|museum|market|festival)/i.test(hint) ? 'event' : /(address|location|place|poi|market)/i.test(hint) ? 'place' : 'generic');
  function extractJsonLd(){const facts=[];for(const s of document.querySelectorAll('script[type="application/ld+json"]')){let j;try{j=JSON.parse(s.textContent||'')}catch{continue}const arr=Array.isArray(j)?j:[j];for(const obj of arr){const type=(obj['@type']||'').toString().toLowerCase();if(/flightreservation|flight/.test(type)&&(['flight','reservation','generic'].includes(targetKind))){facts.push({kind:'flight',confidence:0.8,airline:obj?.reservationFor?.airline?.iataCode||obj?.airline?.iataCode||obj?.reservationFor?.airline?.name,flightNumber:obj?.reservationFor?.flightNumber||obj?.flightNumber,depAirport:obj?.reservationFor?.departureAirport?.iataCode,arrAirport:obj?.reservationFor?.arrivalAirport?.iataCode,depTime:obj?.reservationFor?.departureTime,arrTime:obj?.reservationFor?.arrivalTime,recordLocator:obj?.reservationNumber||obj?.reservationId,source:{route:'jsonld',hints:['FlightReservation']}})}if(/lodgingreservation|hotel|lodgingbusiness/.test(type)&&(['hotel','reservation','generic'].includes(targetKind))){facts.push({kind:'hotel',confidence:0.8,hotelName:obj?.reservationFor?.name||obj?.name,address:obj?.reservationFor?.address?.streetAddress||obj?.address?.streetAddress,checkIn:obj?.checkinTime||obj?.checkInTime||obj?.checkinDate,checkOut:obj?.checkoutTime||obj?.checkOutTime||obj?.checkoutDate,confirmation:obj?.reservationNumber||obj?.reservationId,priceText:obj?.price||obj?.totalPrice,source:{route:'jsonld',hints:[obj['@type']]}})}if(/event/.test(type)&&(['event','generic'].includes(targetKind))){facts.push({kind:'event',confidence:0.7,name:obj?.name,start:obj?.startDate,end:obj?.endDate,venue:obj?.location?.name,address:obj?.location?.address?.streetAddress,url:obj?.url,priceText:obj?.offers?.price,isFree:obj?.offers?.price===0,source:{route:'jsonld',hints:[obj['@type']]}})}if(/place|touristattraction|localbusiness/.test(type)&&(['place','generic','event'].includes(targetKind))){facts.push({kind:'place',confidence:0.6,name:obj?.name,category:obj['@type'],address:obj?.address?.streetAddress,lat:obj?.geo?.latitude,lon:obj?.geo?.longitude,url:obj?.url,phone:obj?.telephone,source:{route:'jsonld',hints:[obj['@type']]}})}}}return facts}
  function extractInlineJson(){const facts=[];for(const s of document.querySelectorAll('script[type="application/json"]')){let j;try{j=JSON.parse(s.textContent||'')}catch{continue}const str=JSON.stringify(j).toLowerCase();const push=(o)=>facts.push(o);if(/flight|airline|pnr|record locator/.test(str)){push({kind:'flight',confidence:0.65,source:{route:'inlineJson',hints:['flight-ish']}})}if(/hotel|lodging|checkin|checkout/.test(str)){push({kind:'hotel',confidence:0.65,source:{route:'inlineJson',hints:['hotel-ish']}})}if(/reservation|booking|confirmation/.test(str)){push({kind:'reservation',confidence:0.6,source:{route:'inlineJson',hints:['reservation-ish']}})}}return facts}
  function extractRegex(){const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let buf='';while(walker.nextNode()){const t=walker.currentNode.nodeValue||'';if(t.trim())buf+=' '+t.replace(/\s+/g,' ');if(buf.length>maxChars)break}buf=buf.slice(0,maxChars);const factsOut=[];const rePNR=/\b([A-Z0-9]{6})\b(?=(?:[^A-Za-z0-9]|$)).{0,40}?(?:PNR|Record Locator|Record|Locator|Confirmation)/i;const reAirlineFN=/\b([A-Z]{2})\s?(\d{2,4})\b/;const reIATA=/\b([A-Z]{3})\b/;const reDate=/\b(?:\d{4}[-\/.]\d{1,2}[-\/.]\d{1,2}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}|\d{1,2}[\/.]\d{1,2}[\/.]\d{2,4})\b/ig;const reMoney=/(?:USD|\$|€|£)\s?\d{1,3}(?:[,\s]\d{3})*(?:\.\d{2})?/ig;const reConf=/\b(?:Confirmation|Conf(?:\.)?|Booking|Reservation)\s*(?:#|No\.?|Number:?)\s*([A-Z0-9\-]{5,})\b/i;const reHotel=/\b(?:Hotel|Resort|Inn|Suites|Lodge|Motel|Hostel)\b/i;const reAddress=/\b\d{1,5}\s+[A-Za-z0-9\.\-'\s]+(?:St|Street|Ave|Avenue|Rd|Road|Blvd|Drive|Dr|Ln|Lane|Way|Trail|Ct|Court)\b.*\b[A-Za-z\s]+,\s*[A-Za-z\s]+\b/;const reEventWords=/\b(farmers?|market|tour|museum|exhibit|festival|concert|show|guided|admission)\b/i;if(/flight|pnr|record locator|airline|segment/.test(hint)){const pnr=(buf.match(rePNR)||[])[1];const afn=buf.match(reAirlineFN);const dates=[...buf.matchAll(reDate)].slice(0,2).map(m=>toISODate(m[0])).filter(Boolean);const ia=[...buf.matchAll(reIATA)].map(m=>m[1]).filter(code=>/^[A-Z]{3}$/.test(code));factsOut.push({kind:'flight',confidence:0.55,airline:afn?.[1],flightNumber:afn?(afn[1]+afn[2]):undefined,depAirport:ia[0],arrAirport:ia[1],depTime:dates[0],arrTime:dates[1],recordLocator:pnr,priceText:(buf.match(reMoney)||[])[0],source:{route:'regex',hints:['PNR','Airline+FlightNo','Dates']}})}if(/hotel|check-?in|check-?out|lodging/.test(hint)){const name=(buf.match(reHotel)||[])[0];const dates=[...buf.matchAll(reDate)].slice(0,2).map(m=>toISODate(m[0])).filter(Boolean);const conf=(buf.match(reConf)||[])[1];const price=(buf.match(reMoney)||[])[0];const addr=(buf.match(reAddress)||[])[0];factsOut.push({kind:'hotel',confidence:0.5,hotelName:name,checkIn:dates[0],checkOut:dates[1],confirmation:conf,priceText:price,address:addr,source:{route:'regex',hints:['hotel word','dates','conf','price']}})}if(reEventWords.test(hint)||reEventWords.test(buf)){const price=(buf.match(reMoney)||[])[0];const date=[...buf.matchAll(reDate)].slice(0,1).map(m=>toISODate(m[0]))[0];factsOut.push({kind:'event',confidence:0.45,name:textOf(document.querySelector('h1,h2'))||undefined,start:date,priceText:price,isFree:!price,source:{route:'regex',hints:['event words','date','price']}})}if(/place|address|poi|market/.test(hint)){const title=textOf(document.querySelector('h1,h2'))||document.title||'';const addr=(buf.match(reAddress)||[])[0];factsOut.push({kind:'place',confidence:0.4,name:title,address:addr,source:{route:'regex',hints:['title','address']}})}if(!factsOut.length){const title=textOf(document.querySelector('h1,h2'))||document.title||'';const body=buf.slice(0,600);factsOut.push({kind:'generic',confidence:0.3,title,body,source:{route:'regex',hints:['generic fallback']}})}return factsOut}
  let facts=[];let route='';try{const j1=extractJsonLd();if(j1.length){facts=j1;route='jsonld'}if(!facts.length){const j2=extractInlineJson();if(j2.length){facts=j2;route='inlineJson'}}if(!facts.length){const j3=extractRegex();if(j3.length){facts=j3;route='regex'}}}catch(e){return{ok:false,error:String(e)}}
  facts=facts.map(f=>({...f,confidence:clamp((f.confidence||0.4)+(route==='jsonld'?0.15:route==='inlineJson'?0.05:0),0,0.99)}));
  const sample=facts.slice(0,5);
  const gz=await gzipBase64(JSON.stringify(facts));
  const t1=performance.now();
  return { ok:true, count:facts.length, facts_gz_base64:gz, sample, meta:{timing_ms:Math.round(t1-t0), route, hints:[hint], charBudget:maxChars} };
})/*ARGS_PLACEHOLDER*/
`;

function withArgs(script: string, args: any) {
  const argStr = JSON.stringify(args || {});
  return script.replace('/*ARGS_PLACEHOLDER*/', `(${argStr})`);
}

class ExtractHotelsTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.BROWSER.EXTRACT_HOTELS;
  async execute(args: { url?: string; pageTypeHint?: string; maxRows?: number; domSelector?: string }): Promise<ToolResult> {
    try {
      const tabId = await ensureTab(args.url);
      const code = withArgs(SMART_RESULTS_EXTRACTOR_JS, {
        pageTypeHint: args.pageTypeHint,
        maxRows: args.maxRows,
        domSelector: args.domSelector,
      });
      const result = await execInWorld<any>(tabId, ExecutionWorld.MAIN, code);
      return { content: [{ type: 'text', text: JSON.stringify(result) }], isError: false };
    } catch (e) {
      return createErrorResponse(`extract_hotels failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}

class ParseTravelFactsTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.BROWSER.PARSE_TRAVEL_FACTS;
  async execute(args: { url?: string; hint?: string; maxChars?: number; preferKind?: string[] }): Promise<ToolResult> {
    try {
      const tabId = await ensureTab(args.url);
      const code = withArgs(GENERIC_TRAVEL_PARSER_JS, {
        hint: args.hint,
        maxChars: args.maxChars,
        preferKind: args.preferKind,
      });
      const result = await execInWorld<any>(tabId, ExecutionWorld.MAIN, code);
      return { content: [{ type: 'text', text: JSON.stringify(result) }], isError: false };
    } catch (e) {
      return createErrorResponse(`parse_travel_facts failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}

export const extractHotelsTool = new ExtractHotelsTool();
export const parseTravelFactsTool = new ParseTravelFactsTool();
