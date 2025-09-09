import 'dotenv/config';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

function parseArgs(argv: string[]) {
  const out: Record<string, string | boolean> = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (!a) continue;
    if (a.startsWith('--')) {
      const [k, v] = a.replace(/^--/, '').split('=');
      if (typeof v === 'undefined') {
        const next = argv[i + 1];
        if (next && !next.startsWith('--')) {
          out[k] = next;
          i++;
        } else {
          out[k] = true;
        }
      } else {
        out[k] = v;
      }
    }
  }
  return out as { url?: string; site?: string } & Record<string, any>;
}

async function main() {
  const cli = parseArgs(process.argv);
  const url = (cli.url && typeof cli.url === 'string' ? cli.url : process.env.MCP_HTTP_URL) ||
    'http://127.0.0.1:12306/mcp';
  const client = new Client({ name: 'SmokeClient', version: '1.0.0' }, { capabilities: {} });
  const transport = new StreamableHTTPClientTransport(new URL(url), {});
  await client.connect(transport);

  const tools = await client.listTools();
  const names = tools.tools.map((t) => t.name).sort();
  console.log('Tools:', names);

  const SMOKE_URL = (cli.page as string) || process.env.SMOKE_URL; // optional URL to navigate/open
  const SMOKE_SITE = (cli.site as string) || process.env.SMOKE_SITE || 'generic';
  const SMOKE_DOM = (cli.dom as string) || process.env.SMOKE_DOM; // optional DOM selector

  // Optional: network debugger capture
  if (cli.capture || process.env.SMOKE_CAPTURE) {
    console.log('Starting network debugger capture...');
    const start = await client.callTool({ name: 'chrome_network_debugger_start', arguments: { url: SMOKE_URL } });
    const startTxt = (start as any).content?.[0]?.text;
    console.log('network_debugger_start:', startTxt?.slice(0, 200));
    await new Promise((r)=>setTimeout(r, Number(cli.wait || process.env.SMOKE_WAIT_MS || 6000)));
    const stop = await client.callTool({ name: 'chrome_network_debugger_stop', arguments: {} }, undefined, { timeout: 120000 });
    const stopTxt = (stop as any).content?.[0]?.text || '[]';
    console.log('network_debugger_stop total bytes:', stopTxt.length);
    try {
      const payload = JSON.parse(stopTxt);
      const list = Array.isArray(payload) ? payload : payload?.data || [];
      const hits = list
        .filter((x: any)=> typeof x?.responseBody === 'string' && /hotel|property|result/i.test(x.responseBody))
        .slice(0, 3)
        .map((x: any)=> ({ url: x.url, status: x.status, len: (x.responseBody||'').length }));
      console.log('candidate endpoints:', JSON.stringify(hits, null, 2));
    } catch {}
  }

  // Optional: raw extractor (skip by default on CPMaxx because CORS can time out)
  if (SMOKE_SITE !== 'navitrip_cp') {
    try {
      const raw = await client.callTool(
        {
          name: 'chrome_extract_hotels',
          arguments: {
            url: SMOKE_URL,
            pageTypeHint: SMOKE_SITE,
            maxRows: 200,
            domSelector: SMOKE_DOM,
          },
        },
        undefined,
        { timeout: 120000 }
      );
      const rawText = (raw as any).content?.[0]?.text || '';
      console.log('chrome_extract_hotels raw:', rawText.slice(0, 1200));
    } catch (e: any) {
      console.log('chrome_extract_hotels raw skipped/error:', e?.message || String(e));
    }
  }

  // Sample orchestrator call: requires an active tab with a results page
  const args = {
    trip_id: 'smoke-trip',
    site: SMOKE_SITE,
    search_params: {
      destination: 'TEST',
      check_in: '2025-12-01',
      check_out: '2025-12-05',
      rooms: 1,
      adults: 2,
    },
    options: {
      max_hotels: 200,
      ...(SMOKE_URL ? { url: String(SMOKE_URL) } : {}),
      ...(SMOKE_DOM ? { domSelector: String(SMOKE_DOM) } : {}),
    },
  };
  const res = await client.callTool({ name: 'extract_hotels', arguments: args }, undefined, { timeout: 180000 });
  const first = (res as any).content?.[0];
  const text = first && first.type === 'text' ? first.text : JSON.stringify(res);
  console.log('extract_hotels result:', text);

  await client.close();
}

main().catch((e) => {
  console.error('Smoke test failed:', e);
  process.exit(1);
});
