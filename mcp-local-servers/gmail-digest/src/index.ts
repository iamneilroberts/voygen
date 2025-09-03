import 'dotenv/config';
import cron from 'node-cron';
import path from 'path';
import { getAuthenticatedClient, listUnreadPrimary, headerValue, bodyHtml } from './gmail.js';
import { loadPreferences, isNoise, senderScore, heuristicScore } from './filters.js';
import { ruleBasedSummary } from './summarize.js';
import { writeJsonl, dataDir, loadHistory, saveHistory, loadPreferencesFile, savePreferencesFile } from './store.js';
import type { DigestItem } from './types.js';

async function runOnce() {
  const gmail = await getAuthenticatedClient();
  const baseDir = process.env.DIGEST_DATA_DIR || path.resolve('../../data/email-digests');
  const prefPath = path.join(baseDir, 'preferences.json');
  const historyPath = path.join(baseDir, 'history.json');
  const prefs = loadPreferences(loadPreferencesFile(prefPath));
  const hist = loadHistory(historyPath);

  const msgs = await listUnreadPrimary(gmail, 50);
  const items: DigestItem[] = [];
  for (const m of msgs) {
    if (hist[m.id]) continue; // already processed
    const subject = headerValue(m, 'Subject') || '(no subject)';
    const from = headerValue(m, 'From') || '';
    const labels = (m.labelIds || []).slice();
    if (isNoise(subject, labels)) continue;
    const snippet = (m.snippet || '').trim();
    const html = bodyHtml(m);
    const summary = ruleBasedSummary(subject, snippet, html);
    const score = Math.max(0, Math.min(1, senderScore(from, prefs) + heuristicScore(subject, snippet)));
    items.push({
      id: m.id!,
      threadId: m.threadId!,
      date: new Date(Number(m.internalDate || Date.now())).toISOString(),
      from,
      subject,
      labels,
      snippet,
      summary,
      importanceScore: score,
    });
    hist[m.id!] = true;
  }

  // Sort by score desc then date desc
  items.sort((a, b) => (b.importanceScore - a.importanceScore) || (a.date < b.date ? 1 : -1));
  writeJsonl(baseDir, items);
  saveHistory(historyPath, hist);
  savePreferencesFile(prefPath, prefs); // persists any defaults or later learning
  return items.length;
}

async function main() {
  const once = process.argv.includes('--once');
  if (once) {
    const n = await runOnce();
    console.log(`Processed ${n} messages.`);
    return;
  }
  const spec = process.env.DIGEST_INTERVAL_CRON || '*/15 * * * *';
  console.log('Starting Gmail digest agent. Cron:', spec);
  cron.schedule(spec, async () => {
    try {
      const n = await runOnce();
      if (n) console.log(`[digest] Stored ${n} items at`, new Date().toISOString());
    } catch (e) {
      console.error('[digest] Error', e);
    }
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

