/**
 * StatusBar Component
 * Feature: 002-librechat-interface-modifications
 *
 * Displays token usage metrics and trip progress in bottom-right corner.
 * Ported from: ~/dev/voygen/librechat-source/client/src/components/StatusBar.tsx
 * Reference: research.md section 2
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRecoilValue } from 'recoil';
import {
  voygentLastUsage,
  voygentStatusVerbosity,
  voygentStatusMode,
  voygentDefaultQuery,
} from '../../store/voygent';
import type { StatusBarProps, StatusPayload } from './types';
import styles from './StatusBar.module.css';

/**
 * StatusBar Component
 *
 * Displays either token usage or trip progress based on mode and available data.
 * Polls /api/voygent/status every 15 seconds for updates.
 * Falls back to localStorage (voygentLastUsage) when server data unavailable.
 */
export default function StatusBar({ forceMode, verbosity: forcedVerbosity, className }: StatusBarProps = {}) {
  const verbosity = forcedVerbosity || useRecoilValue(voygentStatusVerbosity);
  const mode = forceMode || useRecoilValue(voygentStatusMode);
  const defaultQuery = useRecoilValue(voygentDefaultQuery);
  const lastUsage = useRecoilValue(voygentLastUsage);

  // Poll status API every 15 seconds
  const { data } = useQuery<StatusPayload>({
    queryKey: ['voygent-status', defaultQuery],
    queryFn: async () => {
      const qs = defaultQuery ? `?q=${encodeURIComponent(defaultQuery)}` : '';
      const res = await fetch(`/api/voygent/status${qs}`);

      // 204 = no data available
      if (res.status === 204) {
        return { ok: false };
      }

      if (!res.ok) {
        throw new Error(`Status API error: ${res.status}`);
      }

      return res.json();
    },
    refetchInterval: 15000,  // Poll every 15 seconds
    staleTime: 10000,        // Consider data stale after 10 seconds
    retry: 2,                // Retry failed requests twice
  });

  // Build display text based on available data and mode
  const text = useMemo(() => {
    // Prefer server-provided data when available
    if (data && data.ok !== false) {
      // Check if token usage fields are present
      const hasTokenData = data.model || data.inputTokens != null || data.outputTokens != null || data.price != null;

      // Check if trip progress fields are present
      const hasTripData = data.tripName || data.phase || data.percent != null;

      // MODE: Auto-switch based on available data
      if (mode === 'auto') {
        // Prefer trip progress if available (more important for travel agent mode)
        if (hasTripData) {
          return buildTripProgressText(data, verbosity);
        }
        // Fall back to token usage
        if (hasTokenData) {
          return buildTokenUsageText(data);
        }
      }

      // MODE: Force tokens display
      if (mode === 'tokens' && hasTokenData) {
        return buildTokenUsageText(data);
      }

      // MODE: Force progress display
      if (mode === 'progress' && hasTripData) {
        return buildTripProgressText(data, verbosity);
      }
    }

    // No server data: fall back to last local usage
    if (lastUsage && (mode === 'auto' || mode === 'tokens')) {
      const approx = lastUsage.approximate ? '~' : '';
      const parts: string[] = [];

      if (lastUsage.model) parts.push(lastUsage.model);
      if (lastUsage.inputTokens != null) parts.push(`in ${approx}${lastUsage.inputTokens}`);
      if (lastUsage.outputTokens != null) parts.push(`out ${approx}${lastUsage.outputTokens}`);
      if (lastUsage.price != null) parts.push(`$${lastUsage.price.toFixed(4)}`);

      const out = parts.filter(Boolean).join(' • ');
      if (out) return out;
    }

    return '';
  }, [data, lastUsage, verbosity, mode]);

  // Don't render if no text to display
  if (!text) return null;

  return (
    <div
      className={`${styles.statusPill} ${className || ''}`}
      title={data?.url || 'Voygent Status'}
    >
      <span className={styles.statusText}>{text}</span>
    </div>
  );
}

/**
 * Build token usage display text
 */
function buildTokenUsageText(data: StatusPayload): string {
  const approx = data.approximate ? '~' : '';
  const parts: string[] = [];

  if (data.model) {
    // Shorten model name for display
    const shortModel = data.model
      .replace('claude-3-5-sonnet-20241022', 'Sonnet 3.5')
      .replace('claude-3-5-haiku-20241022', 'Haiku 3.5')
      .replace('gpt-4o-mini', 'GPT-4o mini')
      .replace('gpt-4o', 'GPT-4o');
    parts.push(shortModel);
  }

  if (data.inputTokens != null) parts.push(`in ${approx}${data.inputTokens.toLocaleString()}`);
  if (data.outputTokens != null) parts.push(`out ${approx}${data.outputTokens.toLocaleString()}`);
  if (data.price != null) parts.push(`$${data.price.toFixed(4)}`);

  return parts.filter(Boolean).join(' • ');
}

/**
 * Build trip progress display text
 */
function buildTripProgressText(data: StatusPayload, verbosity: 'minimal' | 'normal' | 'verbose'): string {
  const parts: string[] = [];

  // Always show trip name
  if (data.tripName) parts.push(data.tripName);

  // Verbosity: normal and verbose show phase/dates
  if (verbosity !== 'minimal') {
    if (data.phase) {
      const phaseText = data.step ? `${data.phase} (Step ${data.step})` : data.phase;
      parts.push(phaseText);
    }
    if (data.dates) parts.push(data.dates);
  }

  // Show budget tracking
  if (data.cost != null && data.budget != null) {
    parts.push(`$${data.cost.toLocaleString()}/$${data.budget.toLocaleString()}`);
  }

  // Verbosity: verbose shows commission
  if (verbosity === 'verbose' && data.commission != null) {
    parts.push(`Comm $${data.commission.toLocaleString()}`);
  }

  // Always show percentage at the end
  if (data.percent != null) parts.push(`${data.percent}%`);

  return parts.filter(Boolean).join(' • ');
}
