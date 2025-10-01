import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRecoilValue } from 'recoil';
import store from '~/store';

type StatusPayload = {
  ok?: boolean;
  // Trip/workflow style fields
  tripName?: string;
  dates?: string;
  phase?: string;
  step?: number;
  percent?: number;
  cost?: number;
  budget?: number;
  commission?: number;
  url?: string;
  // Token usage style fields (optional)
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  approximate?: boolean; // if true, prefix token numbers with '~'
  price?: number; // alias for cost when budget is unknown
};

const pillStyle: React.CSSProperties = {
  position: 'fixed',
  right: 12,
  bottom: 12,
  zIndex: 999,
  maxWidth: 520,
  backdropFilter: 'blur(6px)',
};

export default function StatusBar() {
  const verbosity = useRecoilValue(store.voygentStatusVerbosity);
  const defaultQuery = useRecoilValue(store.voygentDefaultQuery);
  const { data } = useQuery<StatusPayload>({
    queryKey: ['voygen-status', defaultQuery],
    queryFn: async () => {
      const qs = defaultQuery ? `?q=${encodeURIComponent(defaultQuery)}` : '';
      const res = await fetch(`/api/voygen/status${qs}`);
      if (res.status === 204) return { ok: false };
      return res.json();
    },
    refetchInterval: 15000,
    staleTime: 10000,
  });

  const lastUsage = useRecoilValue(store.voygentLastUsage);

  const text = useMemo(() => {
    // Prefer server-provided data when available
    if (data && data.ok !== false) {
      // If token usage fields are present, render the compact usage pill
      if (data.model || data.inputTokens != null || data.outputTokens != null || data.price != null) {
        const approx = data.approximate ? '~' : '';
        const parts: string[] = [];
        if (data.model) parts.push(data.model);
        if (data.inputTokens != null) parts.push(`in ${approx}${data.inputTokens}`);
        if (data.outputTokens != null) parts.push(`out ${approx}${data.outputTokens}`);
        if (data.price != null) parts.push(`$${data.price.toFixed(4)}`);
        return parts.filter(Boolean).join(' • ');
      }
      // Fallback to trip/workflow status
      const parts: string[] = [];
      if (data.tripName) parts.push(data.tripName);
      if (verbosity !== 'minimal') {
        if (data.phase) parts.push(data.phase + (data.step ? ` (Step ${data.step})` : ''));
        if (data.dates) parts.push(data.dates);
      }
      if (data.cost != null && data.budget != null) parts.push(`$${data.cost}/${data.budget}`);
      if (verbosity === 'verbose' && data.commission != null) parts.push(`Comm $${data.commission}`);
      if (data.percent != null) parts.push(`${data.percent}%`);
      const out = parts.filter(Boolean).join(' • ');
      if (out) return out;
    }

    // No server data: use last local usage if available
    if (lastUsage) {
      const approx = lastUsage.approximate ? '~' : '';
      const parts: string[] = [];
      if (lastUsage.model) parts.push(lastUsage.model);
      if (lastUsage.inputTokens != null) parts.push(`in ${approx}${lastUsage.inputTokens}`);
      if (lastUsage.outputTokens != null) parts.push(`out ${approx}${lastUsage.outputTokens}`);
      if (lastUsage.price != null) parts.push(`$${(lastUsage.price || 0).toFixed(4)}`);
      const out = parts.filter(Boolean).join(' • ');
      if (out) return out;
    }

    return '';
  }, [data, lastUsage, verbosity]);

  if (!text) return null;

  return (
    <div
      className="rounded-full bg-token-main-surface-primary/80 text-text-primary border border-border-medium px-3 py-1 shadow-sm"
      style={pillStyle}
      title={data?.url || ''}
    >
      <span className="text-xs md:text-sm whitespace-nowrap">{text}</span>
    </div>
  );
}
