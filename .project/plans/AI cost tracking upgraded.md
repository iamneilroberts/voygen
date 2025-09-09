Awesome — here’s a complete, copy-pasteable setup for **Option C** (a tiny Cloudflare Worker that proxies Anthropic, logs usage to D1, and adds helpful headers) and how to wire it up to **LibreChat in Docker**.

I’ll give you:

1. the Worker code (handles **streaming** + non-streaming, logs tokens & \$ and sets response headers),
2. the D1 schema & Wrangler config,
3. deployment commands, and
4. the LibreChat Docker config to route Anthropic calls through your Worker.

I’ve also included quick SQL you can run to see per-model costs (Haiku vs Sonnet) for your tests.

---

# 1) Make the Worker project

```bash
# If you haven't:
npm i -g wrangler

mkdir voygent-anthropic-proxy && cd voygent-anthropic-proxy
wrangler init --yes --from-dash
```

Create `wrangler.toml`:

```toml
name = "voygent-anthropic-proxy"
main = "src/index.ts"
compatibility_date = "2024-11-12"

# change to your account id if wrangler asks for it interactively
# account_id = "<YOUR_ACCOUNT_ID>"

# Bind the D1 database below after you create it (step 2)
# [[d1_databases]]
# binding = "DB"
# database_name = "voygent_usage"
# database_id = "<FILLED_AFTER_CREATE>"

[vars]
ANTHROPIC_API_URL = "https://api.anthropic.com/v1"
# Optional: override or extend pricing at deploy-time with JSON, e.g.
# PRICE_OVERRIDES = '{"claude-haiku-3.5":{"in":0.80,"out":4},"claude-sonnet-4":{"in":3,"out":15}}'
```

Create `schema.sql`:

```sql
CREATE TABLE IF NOT EXISTS usage_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,                       -- epoch ms
  path TEXT,
  model TEXT,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  cache_creation_input_tokens INTEGER DEFAULT 0,
  cache_read_input_tokens INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  cost_usd REAL,
  user_id TEXT,
  req_id TEXT,
  ip TEXT,
  ua TEXT
);

CREATE INDEX IF NOT EXISTS ix_usage_ts ON usage_events(ts);
CREATE INDEX IF NOT EXISTS ix_usage_model ON usage_events(model);
```

Create `src/index.ts`:

```ts
export interface Env {
  ANTHROPIC_API_KEY: string;
  ANTHROPIC_API_URL: string;  // default set in wrangler.toml
  DB: D1Database;
  PRICE_OVERRIDES?: string;   // optional JSON string
}

type Usage = {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
};

type Price = { in: number; out: number }; // USD per MTok

const DEFAULT_PRICES: Record<string, Price> = {
  // Broad match keys (we'll fuzzy-match by substring on the model name)
  // Numbers are USD per *million* tokens (MTok) from Anthropic pricing docs (keep these fresh).
  // Haiku 3.5
  "haiku-3.5": { in: 0.80, out: 4.00 },
  // Haiku 3 (older)
  "haiku-3": { in: 0.25, out: 1.25 },
  // Sonnet 4
  "sonnet-4": { in: 3.00, out: 15.00 },
  // Sonnet 3.7 (still common)
  "sonnet-3.7": { in: 3.00, out: 15.00 },
};

function findPrice(model: string, overrides?: Record<string, Price>): Price | null {
  const hay = model.toLowerCase();
  const search = (table: Record<string, Price>) => {
    for (const key of Object.keys(table)) {
      if (hay.includes(key)) return table[key];
    }
    return null;
  };
  return (overrides && search(overrides)) || search(DEFAULT_PRICES);
}

function costUSD(model: string, usage: Required<Usage>, overrideJSON?: string): number | null {
  let overrides: Record<string, Price> | undefined;
  if (overrideJSON) {
    try { overrides = JSON.parse(overrideJSON); } catch {}
  }
  const p = findPrice(model, overrides);
  if (!p) return null;
  // Prices are per *million* tokens
  return (usage.input_tokens / 1e6) * p.in + (usage.output_tokens / 1e6) * p.out;
}

function copyAnthropicHeaders(req: Request): Headers {
  const out = new Headers();
  req.headers.forEach((v, k) => {
    // Forward all Anthropic-specific headers except x-api-key
    if (k.toLowerCase() === "x-api-key") return;
    if (k.toLowerCase().startsWith("anthropic-")) out.set(k, v);
    if (k.toLowerCase() === "accept") out.set(k, v);
    if (k.toLowerCase() === "content-type") out.set(k, v);
  });
  if (!out.has("anthropic-version")) {
    out.set("anthropic-version", "2023-06-01"); // official required header
  }
  return out;
}

function exposeHUDHeaders(h: Headers) {
  // Let browser UIs (if they connect directly) read these
  const expose = [
    "x-voygent-request-id",
    "x-voygent-model",
    "x-voygent-input-tokens",
    "x-voygent-output-tokens",
    "x-voygent-total-tokens",
    "x-voygent-cost-usd",
    "x-voygent-stream-logged"
  ];
  h.set("Access-Control-Expose-Headers", expose.join(", "));
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    // Only proxy Anthropic endpoints; everything else 404
    if (!url.pathname.startsWith("/v1/")) {
      return new Response("Not found", { status: 404 });
    }

    // Safely read request JSON (used for model & metadata.user_id)
    let reqJson: any = null;
    try {
      // Clone before consuming so we can still forward
      const body = await req.clone().text();
      if (body && req.headers.get("content-type")?.includes("application/json")) {
        reqJson = JSON.parse(body);
      }
    } catch {}

    const forwardHeaders = copyAnthropicHeaders(req);
    forwardHeaders.set("x-api-key", env.ANTHROPIC_API_KEY);

    const upstream = await fetch(env.ANTHROPIC_API_URL + url.pathname + url.search, {
      method: req.method,
      headers: forwardHeaders,
      body: ["GET", "HEAD"].includes(req.method) ? undefined : req.body,
      redirect: "manual",
    });

    const respHeaders = new Headers(upstream.headers);
    exposeHUDHeaders(respHeaders);

    const requestId =
      upstream.headers.get("x-request-id") ||
      crypto.randomUUID();

    respHeaders.set("x-voygent-request-id", requestId);

    const clientIP = req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for") || "";
    const ua = req.headers.get("user-agent") || "";

    // Handle streaming vs non-streaming
    const isSSE =
      (reqJson && reqJson.stream === true) ||
      upstream.headers.get("content-type")?.includes("text/event-stream");

    // We’ll capture usage + model for logging & headers
    let model = (reqJson && reqJson.model) || "";
    let usage: Required<Usage> = {
      input_tokens: 0,
      output_tokens: 0,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
    };

    if (!isSSE) {
      // Non-streaming: read JSON once, log, re-emit
      const buf = await upstream.arrayBuffer();
      let passThrough = buf;
      try {
        const txt = new TextDecoder().decode(buf);
        const json = JSON.parse(txt);
        // usage & model come back in the final JSON
        if (json?.model) model = json.model;
        const u = json?.usage || {};
        usage.input_tokens = u.input_tokens ?? 0;
        usage.output_tokens = u.output_tokens ?? 0;
        usage.cache_creation_input_tokens = u.cache_creation_input_tokens ?? 0;
        usage.cache_read_input_tokens = u.cache_read_input_tokens ?? 0;

        const cost = costUSD(model, usage, env.PRICE_OVERRIDES || undefined);
        if (cost != null) respHeaders.set("x-voygent-cost-usd", cost.toFixed(6));
        respHeaders.set("x-voygent-model", model || "");
        respHeaders.set("x-voygent-input-tokens", String(usage.input_tokens));
        respHeaders.set("x-voygent-output-tokens", String(usage.output_tokens));
        respHeaders.set("x-voygent-total-tokens", String(usage.input_tokens + usage.output_tokens));
      } catch {
        // do nothing; leave as pass-through
      }

      // Log (fire-and-forget)
      ctx.waitUntil(logToD1(env, {
        ts: Date.now(),
        path: url.pathname,
        model,
        usage,
        costUsd: costUSD(model, usage, env.PRICE_OVERRIDES || undefined),
        userId: reqJson?.metadata?.user_id || null,
        reqId: requestId,
        ip: clientIP,
        ua,
      }));

      return new Response(passThrough, { status: upstream.status, headers: respHeaders });
    }

    // Streaming: tee the body so we can both forward and parse SSE to log tokens
    const body = upstream.body;
    if (!body) {
      return new Response("Upstream had no body", { status: 502 });
    }

    const [clientStream, logStream] = body.tee();
    // Let the client know we’re streaming & logging in background
    respHeaders.set("x-voygent-stream-logged", "true");

    // Parse SSE in the background to collect final usage
    ctx.waitUntil(parseAndLogSSE(logStream, async (info) => {
      // info.usage is cumulative; at end we’ll have final counts
      usage.input_tokens = info.usage.input_tokens ?? usage.input_tokens;
      usage.output_tokens = info.usage.output_tokens ?? usage.output_tokens;
      usage.cache_creation_input_tokens = info.usage.cache_creation_input_tokens ?? usage.cache_creation_input_tokens;
      usage.cache_read_input_tokens = info.usage.cache_read_input_tokens ?? usage.cache_read_input_tokens;
      model = info.model || model;

      await logToD1(env, {
        ts: Date.now(),
        path: url.pathname,
        model,
        usage,
        costUsd: costUSD(model, usage, env.PRICE_OVERRIDES || undefined),
        userId: reqJson?.metadata?.user_id || null,
        reqId: requestId,
        ip: clientIP,
        ua,
      });
    }));

    return new Response(clientStream, {
      status: upstream.status,
      headers: respHeaders,
    });
  },
};

async function parseAndLogSSE(stream: ReadableStream<Uint8Array>, onDone: (x: { model?: string; usage: Usage }) => Promise<void>) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let model: string | undefined;
  // Keep the latest cumulative usage we see
  const usage: Usage = {};

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });

    // Split on SSE record boundary (blank line)
    let idx: number;
    while ((idx = buf.indexOf("\n\n")) !== -1) {
      const chunk = buf.slice(0, idx);
      buf = buf.slice(idx + 2);

      // Parse "event:" & "data:" lines
      const lines = chunk.split("\n");
      let eventName = "";
      let dataLines: string[] = [];
      for (const line of lines) {
        if (line.startsWith("event:")) eventName = line.slice(6).trim();
        else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
      }
      if (!dataLines.length) continue;

      try {
        const json = JSON.parse(dataLines.join("\n"));
        // message_start carries a Message with model & initial usage
        if (eventName === "message_start" && json?.message) {
          if (json.message.model) model = json.message.model;
          const u = json.message.usage || {};
          if (u.input_tokens != null) usage.input_tokens = u.input_tokens;
          if (u.output_tokens != null) usage.output_tokens = u.output_tokens;
          if (u.cache_creation_input_tokens != null) usage.cache_creation_input_tokens = u.cache_creation_input_tokens;
          if (u.cache_read_input_tokens != null) usage.cache_read_input_tokens = u.cache_read_input_tokens;
        }
        // message_delta contains cumulative usage updates during the stream
        if (json?.usage) {
          const u = json.usage;
          if (u.input_tokens != null) usage.input_tokens = u.input_tokens;
          if (u.output_tokens != null) usage.output_tokens = u.output_tokens;
          if (u.cache_creation_input_tokens != null) usage.cache_creation_input_tokens = u.cache_creation_input_tokens;
          if (u.cache_read_input_tokens != null) usage.cache_read_input_tokens = u.cache_read_input_tokens;
        }
        // At end we’ll see event: message_stop — then onDone will run after loop ends
      } catch {
        // ignore malformed JSON in SSE
      }
    }
  }

  await onDone({ model, usage });
}

async function logToD1(
  env: Env,
  args: {
    ts: number;
    path: string;
    model: string;
    usage: Required<Usage>;
    costUsd: number | null;
    userId: string | null;
    reqId: string;
    ip: string;
    ua: string;
  }
) {
  try {
    const total = (args.usage.input_tokens || 0) + (args.usage.output_tokens || 0);
    await env.DB.prepare(
      `INSERT INTO usage_events
      (ts, path, model, input_tokens, output_tokens, cache_creation_input_tokens, cache_read_input_tokens, total_tokens, cost_usd, user_id, req_id, ip, ua)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)`
    )
      .bind(
        args.ts,
        args.path,
        args.model || "",
        args.usage.input_tokens || 0,
        args.usage.output_tokens || 0,
        args.usage.cache_creation_input_tokens || 0,
        args.usage.cache_read_input_tokens || 0,
        total,
        args.costUsd,
        args.userId,
        args.reqId,
        args.ip,
        args.ua
      )
      .run();
  } catch (e) {
    // Non-fatal; don’t break the response
    console.error("D1 insert failed", e);
  }
}
```

**Why this works**

* It forwards all `anthropic-*` headers and injects your **real** API key. The required `anthropic-version` header is set if missing. ([Anthropic][1])
* It supports **SSE streaming** (`stream: true`) and parses Anthropic’s SSE events (`message_start`, `message_delta`, `message_stop`) to collect **cumulative token usage**; Anthropic sends `usage` in those events. ([Anthropic][2])
* Non-streaming responses are parsed once, and the `usage` block is logged; this `usage` field is standard in Messages responses. ([Anthropic][1])
* Pricing defaults are embedded (USD per **million** tokens). You can override them at deploy time with `PRICE_OVERRIDES` and keep them aligned with Anthropic’s pricing table. ([Anthropic][3], [Anthropic][4])

---

# 2) Create the D1 database & bind it

```bash
# Create D1
wrangler d1 create voygent_usage
# -> copy the database_id from the output and put it in wrangler.toml under [[d1_databases]]

# Bind it now (add this to wrangler.toml):
# [[d1_databases]]
# binding = "DB"
# database_name = "voygent_usage"
# database_id = "<PASTE_ID>"

# Apply schema
wrangler d1 execute voygent_usage --file=./schema.sql
```

---

# 3) Add your Anthropic key & deploy

```bash
# store your real Anthropic key as a Worker secret
wrangler secret put ANTHROPIC_API_KEY
# (paste your key when prompted)

# optional: override prices at deploy-time (JSON per MTok)
# wrangler secret put PRICE_OVERRIDES

# Deploy
wrangler deploy
```

Test quickly:

```bash
# Replace with your worker URL:
W="https://voygent-anthropic-proxy.YOUR_SUBDOMAIN.workers.dev"

curl -s $W/v1/messages \
  -H "content-type: application/json" \
  -H "anthropic-version: 2023-06-01" \
  -d '{
    "model": "claude-3-haiku-20240307",
    "max_tokens": 50,
    "messages": [{"role":"user","content":"Say hi"}]
  }' | jq .
```

---

# 4) Point LibreChat (Docker) at the Worker

You can route Anthropic through the Worker either by **.env** (simplest) or by a **custom endpoint** in `librechat.yaml`.

### Option A — via `.env` (recommended for Docker)

Edit your LibreChat project’s `.env`:

```ini
# Let users enter their key in the UI (or set your own); the Worker supplies the real key anyway.
ANTHROPIC_API_KEY=user_provided

# Route Anthropic traffic to your Worker
ANTHROPIC_REVERSE_PROXY=https://voygent-anthropic-proxy.YOUR_SUBDOMAIN.workers.dev

# List of Anthropic models you want enabled in the UI
# Include Haiku & Sonnet variants you’ll test
ANTHROPIC_MODELS=claude-3-haiku-20240307,claude-3-5-haiku-latest,claude-sonnet-4-latest,claude-3-5-sonnet-20240620
```

LibreChat supports `ANTHROPIC_REVERSE_PROXY` for this exact use-case; it’s documented in their `.env` guide. ([LibreChat][5])

Restart:

```bash
docker compose restart
```

### Option B — via `librechat.yaml` custom endpoint

If you prefer explicit YAML:

1. Bind it into the API container (docker override): ([LibreChat][6])

```yaml
# docker-compose.override.yml
services:
  api:
    volumes:
      - type: bind
        source: ./librechat.yaml
        target: /app/librechat.yaml
```

2. `librechat.yaml` (minimal custom endpoint): ([LibreChat][6])

```yaml
version: 1.2.8
endpoints:
  custom:
    - name: "Voygent Anthropic Proxy"
      apiKey: "user_provided"
      baseURL: "https://voygent-anthropic-proxy.YOUR_SUBDOMAIN.workers.dev"
      models:
        default:
          - "claude-3-haiku-20240307"
          - "claude-sonnet-4-latest"
      modelDisplayLabel: "Voygent (Anthropic)"
      titleConvo: true
      titleModel: "current_model"
```

Then:

```bash
docker compose up -d   # or: docker compose restart
```

---

# 5) See your costs (Haiku vs Sonnet) with quick SQL

**Last 20 calls:**

```bash
wrangler d1 execute voygent_usage --command \
'SELECT datetime(ts/1000, "unixepoch", "localtime") as ts_local, model, input_tokens, output_tokens, total_tokens, ROUND(cost_usd,6) as cost
 FROM usage_events
 ORDER BY id DESC
 LIMIT 20;'
```

**Today’s spend by model:**

```bash
wrangler d1 execute voygent_usage --command \
'SELECT date(ts/1000, "unixepoch", "localtime") as day,
        model,
        COUNT(*) as calls,
        SUM(input_tokens) as in_tok,
        SUM(output_tokens) as out_tok,
        ROUND(SUM(cost_usd), 6) as usd
 FROM usage_events
 WHERE ts >= strftime("%s","now","start of day")*1000
 GROUP BY 1,2
 ORDER BY usd DESC;'
```

**Haiku vs Sonnet last 7 days:**

```bash
wrangler d1 execute voygent_usage --command \
'SELECT model,
        COUNT(*) calls,
        ROUND(SUM(cost_usd), 6) usd,
        SUM(input_tokens) in_tok,
        SUM(output_tokens) out_tok
 FROM usage_events
 WHERE ts >= strftime("%s","now","-7 days")*1000
   AND (LOWER(model) LIKE "%haiku%" OR LOWER(model) LIKE "%sonnet%")
 GROUP BY model
 ORDER BY usd DESC;'
```

---

# 6) What headers you can peek at (optional HUD)

For **non-streaming** calls the Worker adds:

* `x-voygent-model`
* `x-voygent-input-tokens`
* `x-voygent-output-tokens`
* `x-voygent-total-tokens`
* `x-voygent-cost-usd`
* `x-voygent-request-id`

For **streaming** calls you’ll see:

* `x-voygent-stream-logged: true`
* `x-voygent-request-id`

…and the final tokens/\$ will still be in D1 after the stream finishes. If you want a tiny in-app indicator, you can read these headers in your own UI or just run the SQL above during testing.

---

## Notes, gotchas, and why certain choices:

* **Anthropic SSE format**: The Worker’s stream parser watches `message_start` and `message_delta` events where Anthropic includes cumulative `usage`. That’s why we can log final tokens even for streamed responses. ([Anthropic][2])
* **Usage in non-streaming responses**: Anthropic returns `usage` inline with the JSON body. ([Anthropic][1])
* **Required headers**: `anthropic-version` is mandatory; the Worker sets it if your client forgot. ([Anthropic][1])
* **Model pricing**: The defaults in the code come from the official pricing table; update them as Anthropic revises prices (or set `PRICE_OVERRIDES`). ([Anthropic][3])
* **LibreChat wiring**: The cleanest Docker path is `ANTHROPIC_REVERSE_PROXY` in `.env`. You can also add a custom endpoint via `librechat.yaml` if you prefer explicit per-endpoint config. ([LibreChat][5])

---

### Optional extras (nice to have)

* Add a **`/health`** route in the Worker that runs a simple `SELECT 1` on D1 and returns OK.
* Record **`metadata.user_id`** from requests (LibreChat doesn’t set this by default, but if you add it in advanced flows we’ll capture it). Anthropic’s `metadata.user_id` is a supported field. ([Anthropic][7])
* For **count-tokens tests**, you can also call `POST /v1/messages/count_tokens` through the Worker using the same payload as `messages` to estimate cost before sending. (It returns token counts; price math is your Worker’s job.) ([Anthropic][1])

---

If you want, I can tailor the `ANTHROPIC_MODELS` list to exactly the ones you’ll test (your Haiku/Sonnet variants) and pre-fill `PRICE_OVERRIDES` with the exact numbers you want to lock in.

[1]: https://docs.anthropic.com/en/api/messages-examples "Messages examples - Anthropic"
[2]: https://docs.anthropic.com/en/docs/build-with-claude/streaming "Streaming Messages - Anthropic"
[3]: https://docs.anthropic.com/en/docs/about-claude/pricing?utm_source=chatgpt.com "Pricing"
[4]: https://www.anthropic.com/claude/sonnet?utm_source=chatgpt.com "Claude Sonnet 4"
[5]: https://www.librechat.ai/docs/configuration/dotenv "GitHub"
[6]: https://www.librechat.ai/docs/quick_start/custom_endpoints "GitHub"
[7]: https://docs.anthropic.com/en/api/messages?utm_source=chatgpt.com "Messages"


Absolutely—here’s a tiny “add-on” that upgrades your meter to **exact** tokens/\$ once your Cloudflare Worker is live.

You get two modes automatically:

* **Direct mode (no server changes):** if the browser hits your Worker (CORS exposed), the add-on reads the `x-voygent-*` headers straight off the response.
* **Server-proxy mode (LibreChat server calls Worker):** add two tiny lookup endpoints to the Worker; the add-on will poll them by `request_id` to fetch exact usage after a streamed reply.

---

# A) 10-second patch to your existing meter

Add this small “setter” to your existing userscript (put it after your `render()` function). It lets any add-on push exact values into the pill:

```javascript
// Add to your existing meter script:
window.__voygentMeterSetExact = function ({ model, inTok, outTok, costUSD }) {
  try {
    // If you used the same variable names as in the sample script:
    if (typeof model !== 'undefined') localStorage.setItem('voygent_meter_model', (model.toLowerCase().includes('sonnet') ? 'sonnet' : 'haiku'));
    // Update the pill immediately:
    const pill = document.querySelector('#voygent-meter-pill'); // add id to your pill element
    const statsSpan = document.querySelector('#voygent-meter-stats');
    const modelSpan = document.querySelector('#voygent-meter-model');
    if (modelSpan) modelSpan.textContent = (model || localStorage.getItem('voygent_meter_model') || 'haiku').toString();
    if (statsSpan) statsSpan.textContent = ` • in ${Number(inTok||0).toLocaleString()} • out ${Number(outTok||0).toLocaleString()} • $${Number(costUSD||0).toFixed(6)} (exact)`;
    // Optional: also store last exact numbers for other UI bits
    window.__voygentLastExact = { model, inTok, outTok, costUSD };
  } catch (e) { /* no-op */ }
};
```

If you used my earlier pill styles, just add these IDs to your elements in that script so the setter can find them:

```javascript
pill.id = 'voygent-meter-pill';
modelSpan.id = 'voygent-meter-model';
statsSpan.id = 'voygent-meter-stats';
```

---

# B) The add-on userscript (reads Worker headers → updates pill)

> Install as a **separate** Tampermonkey script. Change `WORKER_ORIGIN` to your Worker URL.

```javascript
// ==UserScript==
// @name         Voygent Meter — Exact Mode (Worker headers)
// @namespace    https://voygent.ai
// @version      0.1
// @description  Upgrade the meter to exact tokens/$ by reading x-voygent-* headers from the Worker
// @match        https://your-librechat-host.example.com/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function () {
  const WORKER_ORIGIN = 'https://voygent-anthropic-proxy.YOUR_SUBDOMAIN.workers.dev';
  const MSG_PATH_PREFIX = '/v1/messages'; // Anthropic Messages API path

  // If your LibreChat front-end calls the Worker directly (custom endpoint), this will see the headers.
  const origFetch = window.fetch;
  window.fetch = async function(...args) {
    const res = await origFetch.apply(this, args);
    try {
      const url = new URL(res.url);
      const isAnthropicMsg = url.origin === WORKER_ORIGIN && url.pathname.startsWith(MSG_PATH_PREFIX);

      if (!isAnthropicMsg) return res;

      // Non-streaming: exact numbers are in headers right away
      const cost = res.headers.get('x-voygent-cost-usd');
      const inTok = res.headers.get('x-voygent-input-tokens');
      const outTok = res.headers.get('x-voygent-output-tokens');
      const model = res.headers.get('x-voygent-model');
      const reqId = res.headers.get('x-voygent-request-id');
      const isStream = res.headers.get('x-voygent-stream-logged') === 'true';

      if (!isStream && (cost || inTok || outTok)) {
        window.__voygentMeterSetExact?.({
          model, inTok: Number(inTok||0), outTok: Number(outTok||0), costUSD: Number(cost||0)
        });
      }

      // Streaming: Worker logs to D1; optionally poll a lookup endpoint (see Section C)
      if (isStream && reqId) {
        // If you add /v1/usage/by-req to the Worker, poll it briefly for the final numbers:
        pollByReq(reqId, 30 /*s*/, 750 /*ms*/).catch(()=>{});
      }
    } catch {}
    return res;
  };

  async function pollByReq(reqId, timeoutSec, intervalMs) {
    const until = Date.now() + timeoutSec * 1000;
    while (Date.now() < until) {
      await sleep(intervalMs);
      try {
        const r = await fetch(`${WORKER_ORIGIN}/v1/usage/by-req?id=${encodeURIComponent(reqId)}`, { credentials: 'omit' });
        if (r.ok) {
          const j = await r.json();
          if (j && j.model && (j.input_tokens || j.output_tokens)) {
            window.__voygentMeterSetExact?.({
              model: j.model,
              inTok: Number(j.input_tokens||0),
              outTok: Number(j.output_tokens||0),
              costUSD: Number(j.cost_usd||0)
            });
            return;
          }
        }
      } catch {}
    }
  }

  function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }
})();
```

> If your LibreChat UI **doesn’t** talk directly to the Worker (most Docker setups), jump to **Section C** to add the two tiny lookup endpoints; the add-on will then pick up exact totals for streamed & non-streamed turns.

---

# C) (Only if your UI doesn’t hit the Worker directly) — 12-line Worker “usage lookup” endpoints

Drop these snippets into your Worker’s `fetch` handler **before** the `/v1/` proxy logic. They enable the add-on to fetch exact numbers by `request_id` or “last seen for this IP”.

```ts
// CORS helper
function json(data: unknown, status = 200) {
  const h = new Headers({ 'content-type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  return new Response(JSON.stringify(data), { status, headers: h });
}
```

```ts
// Place at the top of your fetch() before the Anthropic proxy block:
if (url.pathname === '/v1/usage/by-req') {
  const id = url.searchParams.get('id') || '';
  if (!id) return json({ error: 'missing id' }, 400);
  const row = await env.DB.prepare(
    `SELECT ts, path, model, input_tokens, output_tokens, cost_usd, req_id
     FROM usage_events WHERE req_id = ?1
     ORDER BY id DESC LIMIT 1`
  ).bind(id).first();
  return json(row || {});
}

if (url.pathname === '/v1/usage/latest') {
  const ip = req.headers.get('cf-connecting-ip') || '';
  const sinceMs = Number(url.searchParams.get('since_ms') || 120000); // default 2 min
  const cutoff = Date.now() - sinceMs;
  const row = await env.DB.prepare(
    `SELECT ts, path, model, input_tokens, output_tokens, cost_usd, req_id
     FROM usage_events WHERE ip = ?1 AND ts >= ?2
     ORDER BY id DESC LIMIT 1`
  ).bind(ip, cutoff).first();
  return json(row || {});
}
```

No other changes required—your existing proxy+logging stays the same.

---

## Quick sanity checklist

* **Worker live?** You’re seeing `x-voygent-request-id` on Anthropic responses (via curl) ✅
* **Direct mode?** If your front-end calls the Worker directly, the add-on shows “(exact)” immediately for non-streamed calls.
* **Server-proxy mode?** Add Section C endpoints; the add-on will poll `/v1/usage/by-req?id=…` for streamed calls and swap the pill to **exact** when ready.

If you want me to tailor the add-on to your exact LibreChat skin (selectors) or flip it so it **always** polls `/v1/usage/latest` (no request\_id needed), say the word and I’ll hand you that variant too.

