import fs from 'fs';
import path from 'path';
import { format } from 'date-fns';
import type { DigestItem, Preferences } from './types.js';

const ensureDir = (p: string) => fs.mkdirSync(p, { recursive: true });

export function dataDir(base: string): string {
  const dir = path.resolve(base);
  ensureDir(dir);
  return dir;
}

export function writeJsonl(baseDir: string, items: DigestItem[]) {
  if (!items.length) return;
  const date = format(new Date(), 'yyyy-MM-dd');
  const file = path.join(dataDir(baseDir), `conversation-digest-${date}.jsonl`);
  const lines = items.map((i) => JSON.stringify(i)).join('\n') + '\n';
  fs.appendFileSync(file, lines);
}

export function loadPreferencesFile(p: string): Preferences | undefined {
  try {
    const raw = fs.readFileSync(p, 'utf8');
    return JSON.parse(raw) as Preferences;
  } catch {
    return undefined;
  }
}

export function savePreferencesFile(p: string, prefs: Preferences) {
  ensureDir(path.dirname(p));
  fs.writeFileSync(p, JSON.stringify(prefs, null, 2));
}

export function loadHistory(p: string): Record<string, true> {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return {}; }
}

export function saveHistory(p: string, hist: Record<string, true>) {
  ensureDir(path.dirname(p));
  fs.writeFileSync(p, JSON.stringify(hist));
}

