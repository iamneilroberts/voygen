import type { Preferences } from './types.js';

const DEFAULT_PREFS: Preferences = {
  allowList: [],
  blockList: [],
  weights: {
    fromAllowed: 0.5,
    fromBlocked: -1.0,
    primaryCategory: 0.3,
    hasMoneySymbol: 0.05,
    hasDate: 0.05,
  },
};

export function loadPreferences(json?: Partial<Preferences>): Preferences {
  return {
    ...DEFAULT_PREFS,
    ...json,
    weights: { ...DEFAULT_PREFS.weights, ...(json?.weights ?? {}) },
  };
}

export function domainOf(email: string): string | null {
  const m = email.match(/@([^>\s]+)/);
  return m ? m[1].toLowerCase() : null;
}

export function senderScore(from: string, prefs: Preferences): number {
  const email = from.toLowerCase();
  const dom = domainOf(email);
  const inAllow = prefs.allowList.some((e) => email.includes(e) || dom === e.replace(/^@/, ''));
  const inBlock = prefs.blockList.some((e) => email.includes(e) || dom === e.replace(/^@/, ''));
  if (inBlock) return prefs.weights.fromBlocked;
  if (inAllow) return prefs.weights.fromAllowed;
  return 0;
}

export function heuristicScore(subject: string, snippet: string): number {
  const s = `${subject} ${snippet}`;
  let score = 0;
  if (/[\$€£]/.test(s)) score += 0.05;
  if (/\b(\d{1,2}\/\d{1,2}|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/i.test(s)) score += 0.05;
  return score;
}

export function isNoise(subject: string, labels: string[]): boolean {
  const noise = /unsubscribe|delivery status|mailer-daemon|out of office|vacation/i;
  if (noise.test(subject)) return true;
  if (labels.some((l) => /promotions|social|spam/i.test(l))) return true;
  return false;
}

