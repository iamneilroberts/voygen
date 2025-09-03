import { htmlToText } from 'html-to-text';

export function ruleBasedSummary(subject: string, snippet: string, bodyHtml?: string): string {
  let text = snippet || '';
  if (!text && bodyHtml) {
    try { text = htmlToText(bodyHtml, { wordwrap: false }).slice(0, 600); } catch {}
  }
  // Extract key lines and signals
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 8);
  const money = text.match(/[\$€£]\s?\d[\d,.]*/g)?.slice(0, 3) || [];
  const dates = text.match(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b\s?\d{1,2}|\d{1,2}\/\d{1,2}/gi)?.slice(0, 3) || [];
  const urls = Array.from(new Set([...text.matchAll(/https?:\/\/\S+/g)].map((m) => m[0]))).slice(0, 3);
  const bullets = [
    `Subject: ${subject}`,
    ...lines.map((l) => `• ${l}`),
  ];
  if (money.length) bullets.push(`$: ${money.join(', ')}`);
  if (dates.length) bullets.push(`Dates: ${dates.join(', ')}`);
  if (urls.length) bullets.push(`Links: ${urls.join(' ')}`);
  return bullets.join('\n');
}

