import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { loadPreferencesFile, savePreferencesFile } from './store.js';
import { loadPreferences } from './filters.js';
import type { DigestItem, Preferences } from './types.js';

const baseDir = process.env.DIGEST_DATA_DIR || path.resolve('../../data/email-digests');
const prefPath = path.join(baseDir, 'preferences.json');

function* readJsonlFiles(dir: string): Generator<DigestItem> {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.jsonl')).sort().reverse();
  for (const f of files) {
    const text = fs.readFileSync(path.join(dir, f), 'utf8');
    for (const line of text.split(/\r?\n/)) {
      if (!line.trim()) continue;
      yield JSON.parse(line) as DigestItem;
    }
  }
}

function queryItems(args: Record<string, string | boolean>): DigestItem[] {
  const from = (args['--from'] as string) || '';
  const since = (args['--since'] as string) || '';
  const text = (args['--text'] as string) || '';
  const items: DigestItem[] = [];
  for (const it of readJsonlFiles(baseDir)) {
    if (from && !it.from.toLowerCase().includes(from.toLowerCase())) continue;
    if (since && it.date < new Date(since).toISOString()) continue;
    if (text && !(it.summary + ' ' + it.subject + ' ' + it.snippet).toLowerCase().includes(text.toLowerCase())) continue;
    items.push(it);
    if (items.length >= 200) break;
  }
  return items;
}

function parseArgs(): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (let i = 2; i < process.argv.length; i++) {
    const a = process.argv[i];
    if (a.startsWith('--')) { out[a] = true; if (process.argv[i+1] && !process.argv[i+1].startsWith('--')) { out[a] = process.argv[++i]; } }
    else { out[a] = true; }
  }
  return out;
}

function print(items: DigestItem[]) {
  for (const it of items.slice(0, 50)) {
    console.log(`\n${it.date}  [${(it.importanceScore*100|0)}]  ${it.subject}`);
    console.log(`From: ${it.from}`);
    console.log(it.summary.split('\n').slice(0,6).join('\n'));
  }
}

function updatePrefs(mutator: (p: Preferences) => void) {
  const prefs = loadPreferences(loadPreferencesFile(prefPath));
  mutator(prefs);
  savePreferencesFile(prefPath, prefs);
  console.log('Updated preferences at', prefPath);
}

function main() {
  const args = parseArgs();
  if (args['allow'] && typeof args['allow'] === 'string') {
    updatePrefs((p) => p.allowList = Array.from(new Set([...(p.allowList||[]), String(args['allow'])])));
    return;
  }
  if (args['block'] && typeof args['block'] === 'string') {
    updatePrefs((p) => p.blockList = Array.from(new Set([...(p.blockList||[]), String(args['block'])])));
    return;
  }
  const items = queryItems(args);
  print(items);
}

main();

