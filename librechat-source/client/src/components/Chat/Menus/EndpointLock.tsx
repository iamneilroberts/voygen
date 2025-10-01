/**
 * EndpointLock Component
 * Feature: 002-librechat-interface-modifications (Phase 6, T031)
 *
 * Prevents endpoint switching when travel agent mode is locked.
 * Shows lock icon and tooltip explaining the restriction.
 */

import React from 'react';
import { Lock } from 'lucide-react';
import { TooltipAnchor } from '@librechat/client';
import { useLocalize } from '~/hooks';

interface EndpointLockProps {
  /** Whether endpoint switching is locked */
  isLocked: boolean;
  /** Lock reason message (optional) */
  reason?: string;
  /** Callback when user attempts to bypass lock (optional) */
  onBypassAttempt?: () => void;
}

/**
 * EndpointLock - Visual indicator that endpoint is locked
 */
export default function EndpointLock({
  isLocked,
  reason = 'Travel agent mode is locked to ensure optimal MCP tool compatibility',
  onBypassAttempt,
}: EndpointLockProps) {
  const localize = useLocalize();

  if (!isLocked) {
    return null;
  }

  const handleClick = () => {
    if (onBypassAttempt) {
      onBypassAttempt();
    }
  };

  return (
    <TooltipAnchor
      description={reason}
      render={
        <div
          className="flex items-center gap-1.5 rounded-md bg-amber-50 px-2 py-1 dark:bg-amber-900/20"
          role="status"
          aria-label={reason}
          onClick={handleClick}
        >
          <Lock
            className="h-4 w-4 text-amber-600 dark:text-amber-400"
            aria-hidden="true"
          />
          <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
            Locked
          </span>
        </div>
      }
    />
  );
}

/**
 * Hook to determine if endpoint should be locked
 */
export function useEndpointLock() {
  // Check if Voygent travel agent mode is enabled
  const isVoygentMode =
    (typeof window !== 'undefined' && localStorage.getItem('voygent_mode_lock') === '1') ||
    (import.meta as any)?.env?.VITE_VOYGENT_MODE_LOCK === 'true';

  // In travel agent mode, lock to Claude Sonnet endpoint
  const lockedEndpoint = isVoygentMode ? 'Claude Sonnet (Premium)' : null;

  return {
    isLocked: isVoygentMode,
    lockedEndpoint,
    reason: 'Travel agent mode requires Claude Sonnet for MCP tool compatibility',
  };
}
