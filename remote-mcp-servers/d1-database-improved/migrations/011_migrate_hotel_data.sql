-- 011_migrate_hotel_data.sql
-- Purpose: Migrate existing hotel_cache data to new travel_services table



-- Migrate hotel data from hotel_cache to travel_services
INSERT INTO travel_services (
  service_id, service_category, service_name, service_description,
  base_price, total_price, currency,
  is_available, start_date, end_date,
  location_city, location_state, location_country,
  latitude, longitude,
  rating_overall, rating_source,
  source_platform, source_url,
  service_data_json,
  created_at, updated_at, cache_expires_at
)
SELECT 
  provider_hotel_id,
  'hotel',
  name,
  COALESCE(region, ''),
  COALESCE((
    SELECT MIN(price) FROM rooms_cache r WHERE r.hotel_id = h.id
  ), 0),
  COALESCE((
    SELECT MIN(price) FROM rooms_cache r WHERE r.hotel_id = h.id  
  ), 0),
  'USD',
  1,
  date('now'),
  date('now', '+1 day'),
  city,
  region,
  country,
  latitude,
  longitude,
  stars,
  provider,
  provider,
  NULL,
  json_object(
    'id', provider_hotel_id,
    'category', 'hotel',
    'name', name,
    'description', COALESCE(region, ''),
    'location', json_object(
      'address', json_object(
        'city', city,
        'state', region,
        'country', country,
        'full', COALESCE(city || ', ' || region || ', ' || country, city || ', ' || country)
      ),
      'coordinates', CASE 
        WHEN latitude IS NOT NULL AND longitude IS NOT NULL 
        THEN json_object('latitude', latitude, 'longitude', longitude)
        ELSE NULL
      END
    ),
    'hotelDetails', json_object(
      'starRating', stars,
      'propertyType', 'hotel'
    ),
    'pricing', json_object(
      'basePrice', json_object(
        'amount', COALESCE((SELECT MIN(price) FROM rooms_cache r WHERE r.hotel_id = h.id), 0),
        'currency', 'USD',
        'unit', 'per night'
      ),
      'totalPrice', json_object(
        'amount', COALESCE((SELECT MIN(price) FROM rooms_cache r WHERE r.hotel_id = h.id), 0),
        'currency', 'USD'
      )
    ),
    'availability', json_object(
      'available', true,
      'startDate', date('now'),
      'endDate', date('now', '+1 day')
    ),
    'rooms', COALESCE((
      SELECT json_group_array(
        json_object(
          'type', room_type,
          'maxOccupancy', occupancy,
          'pricing', json_object(
            'amount', price,
            'currency', currency
          ),
          'policies', json_object(
            'refundable', refundable
          ),
          'amenities', CASE WHEN includes_breakfast = 1 THEN json_array('breakfast') ELSE json_array() END
        )
      )
      FROM rooms_cache r WHERE r.hotel_id = h.id
    ), json_array()),
    'source', json_object(
      'platform', provider,
      'lastUpdated', last_updated
    ),
    'extraction', json_object(
      'confidence', 0.8,
      'completeness', 0.7
    )
  ),
  last_updated,
  last_updated,
  datetime('now', '+24 hours') -- 24 hour cache expiry for migrated data
FROM hotel_cache h
WHERE h.id IS NOT NULL;

-- Update extraction confidence based on data completeness
UPDATE travel_services 
SET 
  extraction_confidence = CASE
    WHEN latitude IS NOT NULL AND longitude IS NOT NULL AND rating_overall IS NOT NULL THEN 0.9
    WHEN latitude IS NOT NULL OR rating_overall IS NOT NULL THEN 0.8
    ELSE 0.7
  END,
  data_completeness = CASE
    WHEN latitude IS NOT NULL AND longitude IS NOT NULL AND rating_overall IS NOT NULL THEN 0.9
    WHEN latitude IS NOT NULL OR rating_overall IS NOT NULL THEN 0.7
    ELSE 0.5
  END
WHERE service_category = 'hotel'
  AND created_at >= datetime('now', '-1 minute'); -- Only update newly migrated records

