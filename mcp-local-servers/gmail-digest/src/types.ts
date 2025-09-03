export type DigestItem = {
  id: string;
  threadId: string;
  date: string; // ISO
  from: string;
  subject: string;
  labels: string[];
  snippet: string;
  summary: string; // extracted/LLM summary
  importanceScore: number; // 0..1
  learnedSignals?: Record<string, number>;
};

export type Preferences = {
  allowList: string[]; // exact email or domain (@example.com)
  blockList: string[]; // exact email or domain
  weights: {
    fromAllowed: number;
    fromBlocked: number;
    primaryCategory: number;
    hasMoneySymbol: number;
    hasDate: number;
  };
};

