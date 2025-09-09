import { TOOL_NAMES } from 'chrome-mcp-shared';
import nativeMessagingHostInstance from '../native-messaging-host';
import { NativeMessageType } from 'chrome-mcp-shared';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { gunzipSync } from 'zlib';

type HotelRow = {
  id?: string;
  name?: string;
  brand?: string;
  lat?: number;
  lon?: number;
  address?: string;
  star_rating?: number | string;
  review_score?: number | string;
  price_text?: string;
  currency?: string;
  taxes_fees_text?: string;
  cancel_text?: string;
  refundable?: boolean;
  package_type?: string;
  image?: string;
  detail_url?: string;
};

type HotelDTO = {
  id: string;
  name: string;
  brand?: string;
  lat?: number;
  lon?: number;
  address?: string;
  starRating?: number;
  reviewScore?: number;
  priceText?: string;
  currency?: string;
  taxesFeesText?: string;
  cancelText?: string;
  refundable?: boolean;
  packageType?: string;
  image?: string;
  detailUrl?: string;
};

function toNumber(x: unknown): number | undefined {
  if (x == null) return undefined;
  const n = typeof x === 'number' ? x : Number(String(x).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : undefined;
}

function mapRowToDTO(row: HotelRow): HotelDTO | null {
  const id = row.id || row.detail_url || row.name;
  const name = row.name;
  if (!id || !name) return null;
  return {
    id: String(id),
    name: String(name),
    brand: row.brand,
    lat: row.lat,
    lon: row.lon,
    address: row.address,
    starRating: toNumber(row.star_rating),
    reviewScore: toNumber(row.review_score),
    priceText: row.price_text,
    currency: row.currency,
    taxesFeesText: row.taxes_fees_text,
    cancelText: row.cancel_text,
    refundable: row.refundable,
    packageType: row.package_type,
    image: row.image,
    detailUrl: row.detail_url,
  };
}

function b64gzToRows(b64: string): HotelRow[] {
  const buf = Buffer.from(b64, 'base64');
  const ungz = gunzipSync(buf).toString('utf8');
  return ungz
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => JSON.parse(l));
}

async function callExtensionTool(name: string, args: any) {
  const response = await nativeMessagingHostInstance.sendRequestToExtensionAndWait(
    { name, args },
    NativeMessageType.CALL_TOOL,
    60000,
  );
  if (response.status !== 'success') throw new Error(response.error || 'Extension call failed');
  // Result is a CallToolResult with content[0].text JSON string
  const data = response.data as CallToolResult & { isError?: boolean };
  const text = (data.content?.[0] as any)?.text || '';
  if (data.isError) {
    throw new Error(text || 'Extension tool returned an error');
  }
  try {
    return JSON.parse(text || '{}');
  } catch (e) {
    throw new Error(`Invalid JSON returned from extension: ${text.slice(0, 120)}${text.length > 120 ? '…' : ''}`);
  }
}

async function debuggerCapture(url?: string, waitMs: number = 6000) {
  try {
    await nativeMessagingHostInstance.sendRequestToExtensionAndWait(
      { name: TOOL_NAMES.BROWSER.NETWORK_DEBUGGER_START, args: { url } },
      NativeMessageType.CALL_TOOL,
      30000,
    );
  } catch {}
  await new Promise((r) => setTimeout(r, waitMs));
  try {
    const response = await nativeMessagingHostInstance.sendRequestToExtensionAndWait(
      { name: TOOL_NAMES.BROWSER.NETWORK_DEBUGGER_STOP, args: {} },
      NativeMessageType.CALL_TOOL,
      120000,
    );
    if (response.status !== 'success') return [] as any[];
    const data = response.data as CallToolResult;
    const text = (data.content?.[0] as any)?.text || '[]';
    const payload = JSON.parse(text);
    const list = Array.isArray(payload) ? payload : (payload as any)?.data || [];
    return list as any[];
  } catch {
    return [] as any[];
  }
}

function pickHotelResponses(entries: any[], preferHost?: string) {
  const candidates = entries
    .filter((e) => typeof e?.responseBody === 'string' && e.responseBody.length > 500)
    .filter((e) => /hotel|property|result|search|availability/i.test(String(e.url) + ' ' + String(e.responseBody)))
    .filter((e) => (preferHost ? String(e.url).includes(preferHost) : true))
    .slice(-6);
  return candidates;
}

function tryMapHotelsFromJsonText(text: string): HotelRow[] {
  try {
    const j = JSON.parse(text);
    const paths = [
      (x: any) => x?.hotels,
      (x: any) => x?.properties,
      (x: any) => x?.results,
      (x: any) => x?.data?.hotels,
      (x: any) => x?.data?.results,
      (x: any) => x?.data?.search?.results,
    ];
    for (const get of paths) {
      const arr = get(j);
      if (Array.isArray(arr) && arr.length) return arr as HotelRow[];
    }
  } catch {}
  return [];
}

async function webRequestCapture(url?: string, waitMs: number = 6000) {
  try {
    await nativeMessagingHostInstance.sendRequestToExtensionAndWait(
      { name: TOOL_NAMES.BROWSER.NETWORK_CAPTURE_START, args: { url } },
      NativeMessageType.CALL_TOOL,
      30000,
    );
  } catch {}
  await new Promise((r) => setTimeout(r, waitMs));
  try {
    const response = await nativeMessagingHostInstance.sendRequestToExtensionAndWait(
      { name: TOOL_NAMES.BROWSER.NETWORK_CAPTURE_STOP, args: {} },
      NativeMessageType.CALL_TOOL,
      60000,
    );
    if (response.status !== 'success') return [] as any[];
    const data = response.data as CallToolResult;
    const text = (data.content?.[0] as any)?.text || '[]';
    const payload = JSON.parse(text);
    const list = Array.isArray(payload) ? payload : (payload as any)?.data || [];
    return list as any[];
  } catch {
    return [] as any[];
  }
}

async function fetchViaExtension(url: string, timeout = 30000) {
  const response = await nativeMessagingHostInstance.sendRequestToExtensionAndWait(
    {
      name: TOOL_NAMES.BROWSER.NETWORK_REQUEST,
      args: { url, method: 'GET', timeout },
    },
    NativeMessageType.CALL_TOOL,
    timeout + 5000,
  );
  if (response.status !== 'success') throw new Error(response.error || 'network_request failed');
  const data = response.data as CallToolResult;
  const text = (data.content?.[0] as any)?.text || '';
  // network_request tool tends to return JSON text directly
  return text;
}

async function extNavigate(url?: string, refresh?: boolean) {
  try {
    const args: any = {};
    if (url) args.url = url;
    if (refresh) args.refresh = true;
    await nativeMessagingHostInstance.sendRequestToExtensionAndWait(
      { name: TOOL_NAMES.BROWSER.NAVIGATE, args },
      NativeMessageType.CALL_TOOL,
      30000,
    );
  } catch {}
}

async function ingestHotelsToMongo(dtos: HotelDTO[], tripId: string) {
  const uri = process.env.MONGODB_URI;
  if (!uri) return { ok: false, reason: 'MONGODB_URI not set' };
  // Lazy require to avoid bundling if unused
  const { MongoClient } = await import('mongodb');
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db();
    const col = db.collection('hotels');
    const docs = dtos.map((h) => ({ ...h, tripId, createdAt: new Date() }));
    if (docs.length) await col.insertMany(docs, { ordered: false });
    return { ok: true, inserted: docs.length };
  } finally {
    await client.close().catch(() => {});
  }
}

export async function handleOrchestratorTool(
  name: string,
  args: any,
): Promise<CallToolResult> {
  try {
    if (name === TOOL_NAMES.ORCHESTRATOR.EXTRACT_HOTELS) {
      const pageType = args?.site === 'vax' ? 'vax' : args?.site === 'trisept' ? 'wad' : args?.site;
      let rows: HotelRow[] = [];
      let meta: any = {};

      // Treat both explicit 'navitrip_cp' and generic 'navitrip' as CPMaxx/Navitrip
      if (pageType === 'navitrip_cp' || pageType === 'navitrip') {
        const waitMs = Number(args?.options?.wait_ms || 8000);
        // Ensure on the target URL and trigger a hard refresh to generate traffic
        if (args?.options?.url) {
          await extNavigate(args.options.url, false);
        }
        // First attempt: Debugger capture with response bodies, including a forced refresh window
        await nativeMessagingHostInstance
          .sendRequestToExtensionAndWait(
            { name: TOOL_NAMES.BROWSER.NETWORK_DEBUGGER_START, args: { url: args?.options?.url } },
            NativeMessageType.CALL_TOOL,
            30000,
          )
          .catch(() => {});
        // Force a page refresh to produce XHRs in the capture window
        await extNavigate(undefined, true);
        await new Promise((r) => setTimeout(r, waitMs));
        let entries: any[] = [];
        try {
          const response = await nativeMessagingHostInstance.sendRequestToExtensionAndWait(
            { name: TOOL_NAMES.BROWSER.NETWORK_DEBUGGER_STOP, args: {} },
            NativeMessageType.CALL_TOOL,
            120000,
          );
          if (response.status === 'success') {
            const data = response.data as CallToolResult;
            const text = (data.content?.[0] as any)?.text || '[]';
            const payload = JSON.parse(text);
            entries = Array.isArray(payload) ? payload : (payload as any)?.data || [];
          }
        } catch {}
        const hits = pickHotelResponses(entries, 'cpmaxx.cruiseplannersnet.com');
        for (const h of hits) {
          const arr = tryMapHotelsFromJsonText(h.responseBody);
          if (arr.length) { rows = arr; meta = { route: 'xhr:debugger', endpoint: h.url }; break; }
        }
        // Second attempt: WebRequest capture for endpoints + extension-side fetch (bypasses CORS)
        if (!rows.length) {
          const wr = await webRequestCapture(args?.options?.url, waitMs);
          const urls = wr.map((x: any) => x?.url).filter(Boolean) as string[];
          const uniq = Array.from(new Set(urls)).filter((u) => /hotel|property|result|search|availability/i.test(u));
          // prefer same-origin and likely JSON endpoints
          const pick = uniq.find((u) => /cpmaxx\.cruiseplannersnet\.com/i.test(u) && /search|results|hotel|property/i.test(u)) || uniq[0];
          if (pick) {
            try {
              const txt = await fetchViaExtension(pick, 45000);
              const arr = tryMapHotelsFromJsonText(txt);
              if (arr.length) { rows = arr; meta = { route: 'xhr:extfetch', endpoint: pick }; }
            } catch {}
          }
        }
      }

      if (!rows.length) {
        const chromeRes = await callExtensionTool(TOOL_NAMES.BROWSER.EXTRACT_HOTELS, {
          url: args?.options?.url,
          pageTypeHint: pageType,
          maxRows: args?.options?.max_hotels,
          domSelector: args?.options?.domSelector,
        });
        rows = chromeRes?.ndjson_gz_base64 ? b64gzToRows(chromeRes.ndjson_gz_base64) : [];
        meta = { ...(chromeRes?.meta || {}), route: chromeRes?.route, pageType: chromeRes?.pageType };
      }

      const dtos = rows.map(mapRowToDTO).filter(Boolean) as HotelDTO[];
      let ingestResult: any = { ok: false };
      try {
        ingestResult = await ingestHotelsToMongo(dtos, args?.trip_id);
      } catch (e) {
        ingestResult = { ok: false, error: (e as Error).message };
      }
      const payload = { ok: true, count: dtos.length, ingest: ingestResult, sample: dtos.slice(0, 5), meta };
      return { content: [{ type: 'text', text: JSON.stringify(payload) }], isError: false } as any;
    }

    if (name === TOOL_NAMES.ORCHESTRATOR.EXTRACT_ROOM_RATES) {
      const payload = {
        ok: false,
        error: 'extract_room_rates not implemented yet',
        hotel_ids: args?.hotel_ids || [],
      };
      return { content: [{ type: 'text', text: JSON.stringify(payload) }], isError: false } as any;
    }

    return {
      content: [{ type: 'text', text: `Unknown orchestrator tool: ${name}` }],
      isError: true,
    };
  } catch (error: any) {
    return {
      content: [{ type: 'text', text: `Orchestrator error: ${error?.message || String(error)}` }],
      isError: true,
    };
  }
}
