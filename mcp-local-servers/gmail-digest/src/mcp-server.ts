import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import type { DigestItem } from './types.js';

const DATA_DIR = process.env.DIGEST_DATA_DIR || path.resolve('../../data/email-digests');

function* readJsonl(dir: string): Generator<DigestItem> {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.jsonl')).sort().reverse();
  for (const f of files) {
    const text = fs.readFileSync(path.join(dir, f), 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const t = line.trim();
      if (!t) continue;
      yield JSON.parse(t) as DigestItem;
    }
  }
}

function query(opts: { since?: string; until?: string; from?: string; text?: string; minScore?: number; limit?: number }): DigestItem[] {
  const out: DigestItem[] = [];
  const sinceIso = opts.since ? new Date(opts.since).toISOString() : '';
  const untilIso = opts.until ? new Date(opts.until).toISOString() : '';
  for (const it of readJsonl(DATA_DIR)) {
    if (sinceIso && it.date < sinceIso) continue;
    if (untilIso && it.date > untilIso) continue;
    if (opts.from && !it.from.toLowerCase().includes(opts.from.toLowerCase())) continue;
    if (opts.text && !(it.summary + ' ' + it.subject + ' ' + it.snippet).toLowerCase().includes(opts.text.toLowerCase())) continue;
    if (opts.minScore != null && it.importanceScore < opts.minScore) continue;
    out.push(it);
    if (out.length >= (opts.limit ?? 50)) break;
  }
  return out;
}

function render(items: DigestItem[]): string {
  if (!items.length) return 'No matching digests found.';
  const lines: string[] = [];
  for (const it of items) {
    lines.push(`${new Date(it.date).toLocaleString()}  [${Math.round(it.importanceScore*100)}]  ${it.subject}`);
    lines.push(`From: ${it.from}`);
    const s = it.summary.split('\n').slice(0, 6).join('\n');
    lines.push(s);
    lines.push('');
  }
  return lines.join('\n');
}

async function main() {
  const server = new Server({ name: 'gmail-digest-mcp', version: '0.1.0' }, { capabilities: { tools: {} } });

  server.tool(
    'gmail_digest.query',
    {
      description: 'Query stored Gmail digests (JSONL) with filters.',
      inputSchema: z
        .object({
          since: z.string().optional().describe('ISO date or yyyy-mm-dd'),
          until: z.string().optional().describe('ISO date or yyyy-mm-dd'),
          from: z.string().optional().describe('Substring match on From'),
          text: z.string().optional().describe('Full-text match across subject/snippet/summary'),
          minScore: z.number().optional().describe('Minimum importance score 0..1'),
          limit: z.number().optional().default(20),
        })
        .strict(),
    },
    async (args) => {
      const items = query({ ...args, limit: args.limit ?? 20 });
      return { content: [{ type: 'text', text: render(items) }] };
    }
  );

  server.tool(
    'gmail_digest.today_from',
    {
      description: 'What’s new from a sender today? Uses local timezone midnight.',
      inputSchema: z.object({ from: z.string() }).strict(),
    },
    async (args) => {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const items = query({ since: start.toISOString(), from: args.from, limit: 20 });
      const header = `New items from ${args.from} since ${start.toLocaleString()}`;
      return { content: [{ type: 'text', text: header + '\n\n' + render(items) }] };
    }
  );

  await server.connect(new StdioServerTransport());
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

