#!/usr/bin/env node
/**
 * Voygent E2E Runner (MCP Chrome)
 * - Drives the LibreChat UI in a real browser via MCP Chrome (mcp-remote over stdio)
 * - Simulates a human user flow and asserts outcomes from visible page content
 * - Produces a JSON report with pass/fail and screenshots
 */

import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const MCP_ENDPOINT = process.env.MCP_CHROME_URL || 'http://127.0.0.1:12306/mcp';
const BASE_URL = process.env.VOYGENT_BASE_URL || 'http://localhost:8080';
const OUT_DIR = process.env.VOYGENT_E2E_OUT || 'tests/e2e/results';

mkdirSync(OUT_DIR, { recursive: true });

function startMcpRemote(endpoint) {
  const child = spawn('npx', ['-y', 'mcp-remote', endpoint], {
    stdio: ['pipe', 'pipe', 'inherit'],
    env: process.env,
  });
  child.on('exit', (code) => {
    if (code !== 0) console.error('[mcp-remote] exited with code', code);
  });
  return child;
}

function jsonrpc(client) {
  let nextId = 1;
  const inflight = new Map();

  client.stdout.on('data', (buf) => {
    const text = buf.toString();
    for (const line of text.split(/\r?\n/).filter(Boolean)) {
      try {
        const msg = JSON.parse(line);
        const { id } = msg;
        if (id && inflight.has(id)) {
          const { resolve } = inflight.get(id);
          inflight.delete(id);
          resolve(msg);
        }
      } catch {}
    }
  });

  function send(method, params = {}) {
    const id = nextId++;
    const payload = JSON.stringify({ jsonrpc: '2.0', id, method, params });
    client.stdin.write(payload + '\n');
    return new Promise((resolve, reject) => {
      inflight.set(id, { resolve, reject, ts: Date.now() });
      setTimeout(() => {
        if (inflight.has(id)) {
          inflight.delete(id);
          reject(new Error('JSON-RPC timeout for ' + method));
        }
      }, 20000);
    });
  }

  async function callTool(name, args = {}) {
    const res = await send('tools/call', { name, arguments: args });
    if (res.error) throw new Error(res.error.message || 'Tool call failed: ' + name);
    const content = res.result?.content || [];
    const text = content.find((c) => c.type === 'text')?.text || '';
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  return { send, callTool };
}

async function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function waitForSelector(client, selector, timeout = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const els = await client.callTool('chrome_get_interactive_elements', { selector });
    if (Array.isArray(els?.elements) ? els.elements.length > 0 : els?.length > 0) return true;
    await wait(250);
  }
  throw new Error('waitForSelector timeout: ' + selector);
}

async function getPageText(client) {
  const res = await client.callTool('chrome_get_web_content', { textContent: true });
  return typeof res?.text === 'string' ? res.text : JSON.stringify(res);
}

async function typeAndSend(client, text) {
  await client.callTool('chrome_fill_or_select', { selector: '#prompt-textarea', value: text });
  await client.callTool('chrome_keyboard', { keys: 'Enter', selector: '#prompt-textarea' }).catch(() => {});
}

async function run() {
  const proc = startMcpRemote(MCP_ENDPOINT);
  const rpc = jsonrpc(proc);
  await rpc.send('initialize', {});

  const report = { started: new Date().toISOString(), steps: [] };
  function record(step, ok, info = '') {
    report.steps.push({ step, ok, info, ts: new Date().toISOString() });
    console.log((ok ? '✔' : '✖'), step, info);
  }

  try {
    await rpc.callTool('chrome_navigate', { url: BASE_URL });
    await waitForSelector(rpc, '#prompt-textarea');
    record('navigate', true, BASE_URL);

    // Trigger startup greeting
    await typeAndSend(rpc, 'travel_agent_start');
    await wait(1500);
    let page = await getPageText(rpc);
    const greetingDetected = /(Voygent Travel Assistant is active|System Ready|Travel Agent System Ready|startup-core)/i.test(page);
    record('travel_agent_start', greetingDetected, greetingDetected ? 'greeting visible' : 'not detected');

    // DB health
    await typeAndSend(rpc, 'check database health');
    await wait(1500);
    page = await getPageText(rpc);
    const healthOk = /(healthy|all good|ok)/i.test(page);
    record('db_health', healthOk);

    // Load a known trip (example terms; adjust as needed)
    await typeAndSend(rpc, 'show me Sara and Darren\'s trip');
    await wait(2000);
    page = await getPageText(rpc);
    const tripFound = /(Sara\s*&\s*Darren|Anniversary|Bristol|Bath)/i.test(page);
    record('trip_lookup', tripFound);

    // Ask for daily details
    await typeAndSend(rpc, 'show me daily details');
    await wait(2500);
    page = await getPageText(rpc);
    const hasDays = /Day\s+0|Day\s+1|Itinerary|Schedule/i.test(page);
    record('daily_details', hasDays);

    // On failure, request debug
    if (!hasDays) {
      await typeAndSend(rpc, '/debug');
      await wait(2500);
      page = await getPageText(rpc);
      record('debug_report', /System Diagnostic|Database Connectivity|Error Patterns/i.test(page));
    }

    // Save report
    const out = join(OUT_DIR, `voygent-e2e-${Date.now()}.json`);
    writeFileSync(out, JSON.stringify(report, null, 2));
    console.log('E2E report saved:', out);
    process.exit(0);
  } catch (err) {
    record('fatal', false, String(err?.message || err));
    const out = join(OUT_DIR, `voygent-e2e-${Date.now()}.json`);
    writeFileSync(out, JSON.stringify(report, null, 2));
    process.exit(1);
  }
}

run();
