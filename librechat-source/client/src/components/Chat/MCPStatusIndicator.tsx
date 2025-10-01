/**
 * MCPStatusIndicator Component
 * Feature: 002-librechat-interface-modifications (Phase 6, T035)
 *
 * Displays connection status for all MCP servers.
 * Shows summary badge with detailed tooltip on hover.
 */

import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import { TooltipAnchor } from '@librechat/client';

interface MCPServer {
  name: string;
  displayName: string;
  connected: boolean;
  healthy: boolean;
  latency?: number;
  error?: string;
}

interface MCPHealthResponse {
  servers: MCPServer[];
  allHealthy: boolean;
  timestamp: number;
}

/**
 * MCPStatusIndicator - Shows MCP server connection status
 */
export default function MCPStatusIndicator() {
  const { data, isLoading, error } = useQuery<MCPHealthResponse>({
    queryKey: ['mcp-health'],
    queryFn: async () => {
      const res = await fetch('/api/voygent/mcp-health');
      if (!res.ok) {
        throw new Error('Failed to fetch MCP health');
      }
      return res.json();
    },
    refetchInterval: 30000, // Poll every 30 seconds
    staleTime: 20000,
  });

  const status = useMemo(() => {
    if (isLoading || !data) {
      return { type: 'loading', label: 'Checking...', color: 'gray' };
    }

    if (error) {
      return { type: 'error', label: 'Error', color: 'red' };
    }

    const healthyCount = data.servers.filter(s => s.healthy).length;
    const totalCount = data.servers.length;

    if (healthyCount === totalCount) {
      return { type: 'success', label: `${healthyCount}/${totalCount} MCP`, color: 'green' };
    } else if (healthyCount === 0) {
      return { type: 'error', label: `0/${totalCount} MCP`, color: 'red' };
    } else {
      return { type: 'warning', label: `${healthyCount}/${totalCount} MCP`, color: 'amber' };
    }
  }, [data, isLoading, error]);

  const tooltipContent = useMemo(() => {
    if (isLoading) {
      return 'Checking MCP server status...';
    }

    if (error) {
      return 'Unable to connect to MCP servers';
    }

    if (!data) {
      return 'No MCP server data available';
    }

    return (
      <div className="space-y-2">
        <div className="font-semibold">MCP Server Status</div>
        {data.servers.map((server) => (
          <div key={server.name} className="flex items-center justify-between gap-3 text-sm">
            <span className="truncate">{server.displayName || server.name}</span>
            <span className="flex items-center gap-1.5">
              {server.healthy ? (
                <>
                  <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                  {server.latency && <span className="text-xs text-gray-400">{server.latency}ms</span>}
                </>
              ) : (
                <XCircle className="h-3.5 w-3.5 text-red-500" />
              )}
            </span>
          </div>
        ))}
        <div className="pt-2 text-xs text-gray-400">
          Last checked: {new Date(data.timestamp).toLocaleTimeString()}
        </div>
      </div>
    );
  }, [data, isLoading, error]);

  const StatusIcon = useMemo(() => {
    if (isLoading) return Loader2;
    if (status.type === 'error') return XCircle;
    if (status.type === 'warning') return AlertCircle;
    return CheckCircle;
  }, [isLoading, status.type]);

  const colorClasses = useMemo(() => {
    const baseClasses = 'flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium';

    switch (status.color) {
      case 'green':
        return `${baseClasses} bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400`;
      case 'amber':
        return `${baseClasses} bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400`;
      case 'red':
        return `${baseClasses} bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400`;
      default:
        return `${baseClasses} bg-gray-50 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400`;
    }
  }, [status.color]);

  return (
    <TooltipAnchor
      description={tooltipContent}
      render={
        <div
          className={colorClasses}
          role="status"
          aria-label={`MCP server status: ${status.label}`}
        >
          <StatusIcon
            className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`}
            aria-hidden="true"
          />
          <span>{status.label}</span>
        </div>
      }
    />
  );
}
