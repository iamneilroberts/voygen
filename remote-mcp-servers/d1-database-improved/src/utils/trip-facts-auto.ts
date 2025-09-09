/**
 * Auto-population utilities for trip facts
 */

import { D1Database } from '@cloudflare/workers-types';
import { FactTableManager } from '../database/facts';
import { Env } from '../types';

/**
 * Ensures trip facts exist for a given trip, creating them if necessary
 */
export async function ensureTripFactsExist(tripId: number, env: Env): Promise<boolean> {
  try {
    // Check if facts already exist
    const existingFacts = await env.DB.prepare(
      'SELECT trip_id, last_computed FROM trip_facts WHERE trip_id = ?'
    ).bind(tripId).first();
    
    // Check if trip was updated after facts were computed
    const tripInfo = await env.DB.prepare(
      'SELECT updated_at FROM trips_v2 WHERE trip_id = ?'
    ).bind(tripId).first();
    
    if (!tripInfo) {
      console.warn(`[ensureTripFactsExist] Trip ${tripId} not found`);
      return false;
    }
    
    const needsRefresh = !existingFacts || 
      (tripInfo.updated_at && existingFacts.last_computed && 
       new Date(tripInfo.updated_at) > new Date(existingFacts.last_computed));
    
    if (needsRefresh) {
      console.log(`[ensureTripFactsExist] Trip ${tripId} needs fact refresh`);
      
      // Mark trip as dirty for refresh
      await env.DB.prepare(
        'INSERT OR IGNORE INTO facts_dirty (trip_id) VALUES (?)'
      ).bind(String(tripId)).run();
      
      // Trigger immediate refresh
      const factManager = new FactTableManager(env);
      await factManager.refreshTripFacts(String(tripId));
      
      console.log(`[ensureTripFactsExist] Facts refreshed for trip ${tripId}`);
      return true;
    }
    
    console.log(`[ensureTripFactsExist] Facts already current for trip ${tripId}`);
    return true;
    
  } catch (error) {
    console.error(`[ensureTripFactsExist] Error ensuring facts for trip ${tripId}:`, error);
    return false;
  }
}

/**
 * Bulk refresh facts for all trips missing facts
 */
export async function bulkEnsureAllTripFacts(env: Env, limit: number = 20): Promise<number> {
  try {
    // Find trips without facts or with outdated facts
    const tripsNeedingFacts = await env.DB.prepare(`
      SELECT t.trip_id 
      FROM trips_v2 t 
      LEFT JOIN trip_facts tf ON t.trip_id = tf.trip_id 
      WHERE t.status != 'cancelled' 
        AND (tf.trip_id IS NULL OR tf.last_computed < t.updated_at)
      ORDER BY t.updated_at DESC 
      LIMIT ?
    `).bind(limit).all();
    
    let processedCount = 0;
    const factManager = new FactTableManager(env);
    
    for (const trip of tripsNeedingFacts.results) {
      try {
        await ensureTripFactsExist(trip.trip_id, env);
        processedCount++;
      } catch (error) {
        console.error(`Failed to ensure facts for trip ${trip.trip_id}:`, error);
      }
    }
    
    console.log(`[bulkEnsureAllTripFacts] Processed ${processedCount} trips`);
    return processedCount;
    
  } catch (error) {
    console.error('[bulkEnsureAllTripFacts] Error in bulk fact refresh:', error);
    return 0;
  }
}

/**
 * Adds trip facts refresh to trip creation/update workflows
 */
export async function addFactRefreshTrigger(tripId: number, env: Env): Promise<void> {
  try {
    // Add to facts_dirty table for background processing
    await env.DB.prepare(
      'INSERT OR IGNORE INTO facts_dirty (trip_id, created_at) VALUES (?, CURRENT_TIMESTAMP)'
    ).bind(String(tripId)).run();
    
    // For immediate needs, refresh synchronously if trip is small/simple
    const tripActivities = await env.DB.prepare(
      'SELECT COUNT(*) as count FROM trip_activities_enhanced WHERE trip_id = ?'
    ).bind(tripId).first();
    
    // If trip has few activities, refresh immediately
    if (tripActivities && tripActivities.count < 10) {
      const factManager = new FactTableManager(env);
      await factManager.refreshTripFacts(String(tripId));
      console.log(`[addFactRefreshTrigger] Immediately refreshed facts for small trip ${tripId}`);
    } else {
      console.log(`[addFactRefreshTrigger] Queued large trip ${tripId} for background fact refresh`);
    }
    
  } catch (error) {
    console.error(`[addFactRefreshTrigger] Error adding refresh trigger for trip ${tripId}:`, error);
  }
}

/**
 * Gets trip with facts, ensuring facts exist
 */
export async function getTripWithFacts(tripId: number, env: Env): Promise<any> {
  try {
    // Ensure facts exist first
    await ensureTripFactsExist(tripId, env);
    
    // Get trip with facts
    const result = await env.DB.prepare(`
      SELECT 
        t.*,
        tf.total_nights,
        tf.total_activities,
        tf.total_cost as facts_total_cost,
        tf.transit_minutes,
        tf.last_computed as facts_updated
      FROM trips_v2 t
      LEFT JOIN trip_facts tf ON t.trip_id = tf.trip_id
      WHERE t.trip_id = ?
    `).bind(tripId).first();
    
    return result;
    
  } catch (error) {
    console.error(`[getTripWithFacts] Error getting trip ${tripId} with facts:`, error);
    return null;
  }
}