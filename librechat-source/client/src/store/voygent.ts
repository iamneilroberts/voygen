/**
 * Voygent Recoil State Atoms
 * Feature: 002-librechat-interface-modifications
 *
 * State management for token usage, trip progress, and MCP server status.
 * Referenced from: ~/dev/voygen/librechat-source/client/src/store/settings.ts
 */

import { atom, selector } from 'recoil';

/**
 * Token Usage Data Interface
 */
export interface TokenUsageData {
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  approximate?: boolean;
  price?: number;
  timestamp?: number;
}

/**
 * Trip Progress Data Interface
 */
export interface TripProgressData {
  tripId?: string;
  tripName?: string;
  dates?: string;
  phase?: 'Research' | 'Hotels' | 'Activities' | 'Booking' | 'Finalization';
  step?: number;
  totalSteps?: number;
  percent?: number;
  cost?: number;
  budget?: number;
  commission?: number;
  url?: string;
  lastUpdated?: number;
}

/**
 * MCP Server Status Interface
 */
export interface MCPServerStatus {
  name: string;
  connected: boolean;
  healthy: boolean;
  latency?: number;
  lastCheck: number;
  error?: string;
}

/**
 * Status Display Configuration Types
 */
export type StatusVerbosity = 'minimal' | 'normal' | 'verbose';
export type StatusMode = 'auto' | 'tokens' | 'progress';

/**
 * Helper to create atom with localStorage persistence
 */
function atomWithLocalStorage<T>(key: string, defaultValue: T) {
  return atom<T>({
    key,
    default: defaultValue,
    effects: [
      ({ setSelf, onSet }) => {
        // Load from localStorage on initialization
        const stored = localStorage.getItem(key);
        if (stored !== null) {
          try {
            setSelf(JSON.parse(stored));
          } catch (e) {
            console.warn(`Failed to parse localStorage key "${key}":`, e);
          }
        }

        // Save to localStorage on change
        onSet((newValue, _, isReset) => {
          if (isReset) {
            localStorage.removeItem(key);
          } else {
            localStorage.setItem(key, JSON.stringify(newValue));
          }
        });
      }
    ]
  });
}

/**
 * ATOM: Last token usage (persisted to localStorage)
 * Updated after each AI response
 */
export const voygentLastUsage = atomWithLocalStorage<TokenUsageData | null>(
  'voygentLastUsage',
  null
);

/**
 * ATOM: Cumulative session token usage
 * Cleared on logout
 */
export const voygentCumulativeUsage = atom<TokenUsageData | null>({
  key: 'voygentCumulativeUsage',
  default: null,
});

/**
 * ATOM: Current trip progress
 * Updated via polling from /api/voygent/status
 */
export const voygentTripProgress = atom<TripProgressData | null>({
  key: 'voygentTripProgress',
  default: null,
});

/**
 * ATOM: Status verbosity preference (persisted)
 * Controls how much detail to show in StatusBar
 */
export const voygentStatusVerbosity = atomWithLocalStorage<StatusVerbosity>(
  'voygentStatusVerbosity',
  'normal'
);

/**
 * ATOM: Status display mode (persisted)
 * auto = smart switch between tokens and progress
 * tokens = always show token usage
 * progress = always show trip progress
 */
export const voygentStatusMode = atomWithLocalStorage<StatusMode>(
  'voygentStatusMode',
  'auto'
);

/**
 * ATOM: Default query parameter for status API
 * Used for filtering status data
 */
export const voygentDefaultQuery = atom<string>({
  key: 'voygentDefaultQuery',
  default: '',
});

/**
 * ATOM: MCP server status array
 * Updated via polling from /api/voygent/mcp-health
 */
export const voygentMCPStatus = atom<MCPServerStatus[]>({
  key: 'voygentMCPStatus',
  default: [
    { name: 'd1_database', connected: false, healthy: false, lastCheck: 0 },
    { name: 'prompt_instructions', connected: false, healthy: false, lastCheck: 0 },
    { name: 'template_document', connected: false, healthy: false, lastCheck: 0 },
    { name: 'web_fetch', connected: false, healthy: false, lastCheck: 0 },
    { name: 'document_publish', connected: false, healthy: false, lastCheck: 0 },
  ],
});

/**
 * SELECTOR: Overall MCP health
 * Derived from voygentMCPStatus
 * Returns true if all servers are healthy
 */
export const voygentMCPHealthy = selector<boolean>({
  key: 'voygentMCPHealthy',
  get: ({ get }) => {
    const status = get(voygentMCPStatus);
    return status.every(server => server.healthy);
  },
});

/**
 * SELECTOR: Required MCP servers health
 * Returns true if all required servers (d1_database, prompt_instructions, template_document) are healthy
 */
export const voygentRequiredMCPHealthy = selector<boolean>({
  key: 'voygentRequiredMCPHealthy',
  get: ({ get }) => {
    const status = get(voygentMCPStatus);
    const requiredServers = ['d1_database', 'prompt_instructions', 'template_document'];
    return status
      .filter(s => requiredServers.includes(s.name))
      .every(s => s.healthy);
  },
});
