import { z } from 'zod';
import { TripSearchSurfaceManager } from '../database/tripSearchSurface';
import type { Env } from '../types';

export const refreshTripSearchSurfaceSchema = z.object({
  trip_id: z.union([z.string(), z.number()]).optional(),
  refresh_all: z.boolean().optional().default(false),
  limit: z.number().int().positive().max(500).default(100)
});

export type RefreshTripSearchSurfaceInput = z.infer<typeof refreshTripSearchSurfaceSchema>;

async function performRefresh(
  manager: TripSearchSurfaceManager,
  params: RefreshTripSearchSurfaceInput
) {
  if (params.refresh_all) {
    const refreshed = await manager.refreshAll(params.limit);
    return {
      refreshed,
      mode: 'refresh_all',
      message: `Refreshed ${refreshed} trips in search surface`
    };
  }

  if (params.trip_id != null) {
    const result = await manager.refreshTrip(params.trip_id);
    return result
      ? {
          refreshed: 1,
          mode: 'single',
          trip_id: result.tripId,
          trip_name: result.tripName,
          tokens: result.tokens,
          phonetic_tokens: result.phoneticTokens
        }
      : {
          refreshed: 0,
          mode: 'single',
          trip_id: Number(params.trip_id),
          message: 'Trip not found; any existing search surface row was removed.'
        };
  }

  const refreshed = await manager.refreshDirty(params.limit);
  return {
    refreshed,
    mode: 'dirty_queue',
    message: refreshed
      ? `Processed ${refreshed} queued trips from trip_search_surface_dirty`
      : 'No queued trips in trip_search_surface_dirty'
  };
}

export async function handleRefreshTripSearchSurface(
  manager: TripSearchSurfaceManager,
  input: unknown
) {
  const params = refreshTripSearchSurfaceSchema.parse(input || {});
  const result = await performRefresh(manager, params);
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(result, null, 2)
      }
    ]
  };
}

export const refreshTripSearchSurfaceTool = {
  name: 'refresh_trip_search_surface',
  description: 'Refresh the unified trip search surface (process dirty queue, specific trip, or full rebuild)',
  inputSchema: refreshTripSearchSurfaceSchema,
  handler: async (input: RefreshTripSearchSurfaceInput, db: any) => {
    const env: Env = {
      DB: db,
      MCP_AUTH_KEY: ''
    };
    const manager = new TripSearchSurfaceManager(env);
    return performRefresh(manager, input || {});
  }
};
