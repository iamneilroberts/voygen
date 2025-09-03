/**
 * Hotel management tools for D1 Travel Database
 * Supports hotel caching, room pricing, and availability management
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { Env, ToolResponse } from '../types';
import { DatabaseManager } from '../database/manager';
import { ErrorLogger } from '../database/errors';

// Hotel data structures
const HotelOptionSchema = z.object({
  // Core identifiers
  giata_id: z.string().optional().describe("Universal hotel identifier"),
  site_id: z.string().describe("Site-specific hotel ID"),
  site: z.enum(['navitrip', 'trisept', 'vax']).describe("Booking site"),
  
  // Basic info
  name: z.string().describe("Hotel name"),
  city: z.string().describe("Hotel city"),
  region: z.string().optional().describe("Hotel region/state"),
  country: z.string().optional().describe("Hotel country"),
  
  // Location
  address: z.string().optional().describe("Hotel address"),
  coordinates: z.object({
    lat: z.number(),
    lng: z.number()
  }).optional().describe("Hotel coordinates"),
  distance_to_center: z.number().optional().describe("Distance to city center in km"),
  
  // Pricing
  lead_price: z.object({
    amount: z.number().describe("Price amount"),
    currency: z.string().default("USD").describe("Price currency"),
    per_night: z.boolean().default(true).describe("Is price per night")
  }).describe("Lead/starting price"),
  
  // Features
  star_rating: z.number().min(1).max(5).optional().describe("Hotel star rating"),
  review_score: z.number().min(0).max(10).optional().describe("Review score"),
  review_count: z.number().optional().describe("Number of reviews"),
  amenities: z.array(z.string()).optional().describe("Hotel amenities"),
  images: z.array(z.string()).optional().describe("Hotel image URLs"),
  
  // Availability
  available: z.boolean().default(true).describe("Is hotel available"),
  refundable: z.boolean().optional().describe("Refundable booking option"),
  free_cancellation_until: z.string().optional().describe("Free cancellation deadline"),
  
  // Commission
  commission_amount: z.number().optional().describe("Commission amount"),
  commission_percent: z.number().optional().describe("Commission percentage"),
  
  // Raw data
  raw_json: z.any().optional().describe("Original extracted data")
});

const RoomOptionSchema = z.object({
  room_id: z.string().describe("Room identifier"),
  name: z.string().describe("Room name/type"),
  description: z.string().optional().describe("Room description"),
  
  // Pricing
  nightly_rate: z.number().describe("Nightly rate"),
  total_price: z.number().describe("Total price for stay"),
  taxes_included: z.boolean().default(false).describe("Are taxes included"),
  currency: z.string().default("USD").describe("Price currency"),
  
  // Features
  max_occupancy: z.number().optional().describe("Maximum occupancy"),
  bed_types: z.array(z.string()).optional().describe("Bed types"),
  room_size: z.number().optional().describe("Room size in sqm"),
  
  // Policies
  refundable: z.boolean().default(false).describe("Is refundable"),
  cancellation_deadline: z.string().optional().describe("Cancellation deadline"),
  cancellation_fee: z.number().optional().describe("Cancellation fee"),
  
  // Commission
  commission_eligible: z.boolean().default(true).describe("Eligible for commission"),
  commission_percent: z.number().optional().describe("Commission percentage"),
  commission_amount: z.number().optional().describe("Commission amount")
});

export function registerHotelManagementTools(server: McpServer, getEnv: () => Env) {
  
  // Tool: ingest_hotels
  server.tool(
    "ingest_hotels",
    {
      trip_id: z.string().describe("Trip identifier"),
      hotels: z.array(HotelOptionSchema).describe("Array of hotel options"),
      site: z.enum(['navitrip', 'trisept', 'vax']).describe("Source booking site"),
      session_id: z.string().optional().describe("Extraction session ID")
    },
    async (params) => {
      const env = getEnv();
      const dbManager = new DatabaseManager(env);
      const errorLogger = new ErrorLogger(env);
      
      // Ensure database is initialized
      const initialized = await dbManager.ensureInitialized();
      if (!initialized) {
        return dbManager.createInitFailedResponse();
      }

      try {
        let insertedCount = 0;
        let updatedCount = 0;
        let errorCount = 0;
        const errors: string[] = [];

        // Process hotels in batches for better performance
        for (const hotel of params.hotels) {
          try {
            // Check if hotel already exists (by site_id and trip_id)
            const existing = await env.DB.prepare(`
              SELECT id FROM hotel_cache 
              WHERE trip_id = ? AND site = ? AND JSON_EXTRACT(json, '$.site_id') = ?
            `).bind(params.trip_id, params.site, hotel.site_id).first();

            const hotelData = {
              trip_id: params.trip_id,
              city: hotel.city,
              giata_id: hotel.giata_id || null,
              site: params.site,
              json: JSON.stringify(hotel),
              lead_price_amount: hotel.lead_price.amount,
              lead_price_currency: hotel.lead_price.currency,
              refundable: hotel.refundable ? 1 : 0,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            };

            if (existing) {
              // Update existing hotel
              await env.DB.prepare(`
                UPDATE hotel_cache 
                SET json = ?, lead_price_amount = ?, lead_price_currency = ?, 
                    refundable = ?, updated_at = ?
                WHERE id = ?
              `).bind(
                hotelData.json,
                hotelData.lead_price_amount,
                hotelData.lead_price_currency,
                hotelData.refundable,
                hotelData.updated_at,
                existing.id
              ).run();
              updatedCount++;
            } else {
              // Insert new hotel
              await env.DB.prepare(`
                INSERT INTO hotel_cache (
                  trip_id, city, giata_id, site, json, 
                  lead_price_amount, lead_price_currency, refundable,
                  created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `).bind(
                hotelData.trip_id,
                hotelData.city,
                hotelData.giata_id,
                hotelData.site,
                hotelData.json,
                hotelData.lead_price_amount,
                hotelData.lead_price_currency,
                hotelData.refundable,
                hotelData.created_at,
                hotelData.updated_at
              ).run();
              insertedCount++;
            }
          } catch (error) {
            errorCount++;
            const errorMsg = `Failed to process hotel ${hotel.name}: ${error instanceof Error ? error.message : String(error)}`;
            errors.push(errorMsg);
            console.error(errorMsg);
          }
        }

        return {
          success: true,
          message: `Hotel ingestion completed`,
          results: {
            total_processed: params.hotels.length,
            inserted: insertedCount,
            updated: updatedCount,
            errors: errorCount,
            error_details: errors.length > 0 ? errors : undefined
          }
        };

      } catch (error) {
        const errorMsg = `Hotel ingestion failed: ${error instanceof Error ? error.message : String(error)}`;
        await errorLogger.logError('ingest_hotels', errorMsg, { trip_id: params.trip_id, site: params.site });
        return {
          success: false,
          error: errorMsg
        };
      }
    }
  );

  // Tool: ingest_rooms
  server.tool(
    "ingest_rooms",
    {
      trip_id: z.string().describe("Trip identifier"),
      hotel_key: z.string().describe("Hotel identifier (GIATA ID or site ID)"),
      rooms: z.array(RoomOptionSchema).describe("Array of room options"),
      site: z.enum(['navitrip', 'trisept', 'vax']).describe("Source booking site"),
      session_id: z.string().optional().describe("Extraction session ID")
    },
    async (params) => {
      const env = getEnv();
      const dbManager = new DatabaseManager(env);
      const errorLogger = new ErrorLogger(env);
      
      const initialized = await dbManager.ensureInitialized();
      if (!initialized) {
        return dbManager.createInitFailedResponse();
      }

      try {
        let insertedCount = 0;
        let updatedCount = 0;
        let errorCount = 0;
        const errors: string[] = [];

        for (const room of params.rooms) {
          try {
            // Check if room already exists
            const existing = await env.DB.prepare(`
              SELECT id FROM rooms_cache 
              WHERE trip_id = ? AND hotel_key = ? AND site = ? AND JSON_EXTRACT(json, '$.room_id') = ?
            `).bind(params.trip_id, params.hotel_key, params.site, room.room_id).first();

            const roomData = {
              trip_id: params.trip_id,
              hotel_key: params.hotel_key,
              site: params.site,
              room_name: room.name,
              json: JSON.stringify(room),
              nightly_rate: room.nightly_rate,
              total_price: room.total_price,
              commission_amount: room.commission_amount || null,
              commission_percent: room.commission_percent || null,
              refundable: room.refundable ? 1 : 0,
              cancellation_deadline: room.cancellation_deadline || null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            };

            if (existing) {
              // Update existing room
              await env.DB.prepare(`
                UPDATE rooms_cache 
                SET json = ?, nightly_rate = ?, total_price = ?, 
                    commission_amount = ?, commission_percent = ?, 
                    refundable = ?, cancellation_deadline = ?, updated_at = ?
                WHERE id = ?
              `).bind(
                roomData.json,
                roomData.nightly_rate,
                roomData.total_price,
                roomData.commission_amount,
                roomData.commission_percent,
                roomData.refundable,
                roomData.cancellation_deadline,
                roomData.updated_at,
                existing.id
              ).run();
              updatedCount++;
            } else {
              // Insert new room
              await env.DB.prepare(`
                INSERT INTO rooms_cache (
                  trip_id, hotel_key, site, room_name, json,
                  nightly_rate, total_price, commission_amount, commission_percent,
                  refundable, cancellation_deadline, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `).bind(
                roomData.trip_id,
                roomData.hotel_key,
                roomData.site,
                roomData.room_name,
                roomData.json,
                roomData.nightly_rate,
                roomData.total_price,
                roomData.commission_amount,
                roomData.commission_percent,
                roomData.refundable,
                roomData.cancellation_deadline,
                roomData.created_at,
                roomData.updated_at
              ).run();
              insertedCount++;
            }
          } catch (error) {
            errorCount++;
            const errorMsg = `Failed to process room ${room.name}: ${error instanceof Error ? error.message : String(error)}`;
            errors.push(errorMsg);
            console.error(errorMsg);
          }
        }

        return {
          success: true,
          message: `Room ingestion completed`,
          results: {
            total_processed: params.rooms.length,
            inserted: insertedCount,
            updated: updatedCount,
            errors: errorCount,
            error_details: errors.length > 0 ? errors : undefined
          }
        };

      } catch (error) {
        const errorMsg = `Room ingestion failed: ${error instanceof Error ? error.message : String(error)}`;
        await errorLogger.logError('ingest_rooms', errorMsg, { trip_id: params.trip_id, hotel_key: params.hotel_key });
        return {
          success: false,
          error: errorMsg
        };
      }
    }
  );

  // Tool: query_hotels
  server.tool(
    "query_hotels",
    {
      trip_id: z.string().optional().describe("Trip identifier to filter by"),
      city: z.string().optional().describe("City to filter by"),
      site: z.enum(['navitrip', 'trisept', 'vax']).optional().describe("Site to filter by"),
      price_range: z.object({
        min: z.number().optional(),
        max: z.number().optional()
      }).optional().describe("Price range filter"),
      refundable_only: z.boolean().optional().describe("Only show refundable options"),
      sort_by: z.enum(['price', 'rating', 'commission']).default('price').describe("Sort results by"),
      limit: z.number().default(20).max(100).describe("Maximum results to return")
    },
    async (params) => {
      const env = getEnv();
      const dbManager = new DatabaseManager(env);
      
      const initialized = await dbManager.ensureInitialized();
      if (!initialized) {
        return dbManager.createInitFailedResponse();
      }

      try {
        let whereClause = "WHERE 1=1";
        const bindings: any[] = [];

        if (params.trip_id) {
          whereClause += " AND trip_id = ?";
          bindings.push(params.trip_id);
        }

        if (params.city) {
          whereClause += " AND city LIKE ?";
          bindings.push(`%${params.city}%`);
        }

        if (params.site) {
          whereClause += " AND site = ?";
          bindings.push(params.site);
        }

        if (params.price_range?.min) {
          whereClause += " AND lead_price_amount >= ?";
          bindings.push(params.price_range.min);
        }

        if (params.price_range?.max) {
          whereClause += " AND lead_price_amount <= ?";
          bindings.push(params.price_range.max);
        }

        if (params.refundable_only) {
          whereClause += " AND refundable = 1";
        }

        let orderBy = "ORDER BY lead_price_amount ASC";
        if (params.sort_by === 'rating') {
          orderBy = "ORDER BY JSON_EXTRACT(json, '$.review_score') DESC";
        } else if (params.sort_by === 'commission') {
          orderBy = "ORDER BY JSON_EXTRACT(json, '$.commission_amount') DESC";
        }

        const query = `
          SELECT 
            id,
            trip_id,
            city,
            giata_id,
            site,
            json,
            lead_price_amount,
            lead_price_currency,
            refundable,
            created_at,
            updated_at
          FROM hotel_cache 
          ${whereClause}
          ${orderBy}
          LIMIT ?
        `;

        bindings.push(params.limit);

        const results = await env.DB.prepare(query).bind(...bindings).all();

        const hotels = results.results?.map((row: any) => {
          const hotelData = JSON.parse(row.json);
          return {
            id: row.id,
            trip_id: row.trip_id,
            site: row.site,
            hotel_data: hotelData,
            lead_price: row.lead_price_amount,
            currency: row.lead_price_currency,
            refundable: Boolean(row.refundable),
            cached_at: row.updated_at
          };
        }) || [];

        return {
          success: true,
          results: hotels,
          total_found: hotels.length,
          filters_applied: {
            trip_id: params.trip_id,
            city: params.city,
            site: params.site,
            price_range: params.price_range,
            refundable_only: params.refundable_only,
            sort_by: params.sort_by
          }
        };

      } catch (error) {
        const errorMsg = `Hotel query failed: ${error instanceof Error ? error.message : String(error)}`;
        return {
          success: false,
          error: errorMsg
        };
      }
    }
  );
}