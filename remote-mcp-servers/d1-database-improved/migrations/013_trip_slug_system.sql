-- PHASE 2: Trip Slug System Implementation
-- Adds URL-friendly trip identifiers with client-destination-year format
-- Migration: 013_trip_slug_system.sql

-- Step 1: Add trip_slug column with unique constraint
ALTER TABLE trips_v2 ADD COLUMN trip_slug TEXT UNIQUE;

-- Step 2: Create index for efficient slug lookups
CREATE INDEX idx_trips_slug ON trips_v2(trip_slug);

-- Step 3: Create function-like trigger to auto-generate slugs
-- Note: This is D1/SQLite compatible trigger syntax
CREATE TRIGGER tr_trips_slug_auto_generate
  AFTER INSERT ON trips_v2
  WHEN NEW.trip_slug IS NULL
BEGIN
  UPDATE trips_v2 
  SET trip_slug = (
    SELECT LOWER(
      REPLACE(
        REPLACE(
          REPLACE(
            REPLACE(
              REPLACE(
                COALESCE(
                  CASE 
                    WHEN NEW.primary_client_email IS NOT NULL THEN 
                      SUBSTR(NEW.primary_client_email, 1, INSTR(NEW.primary_client_email || '@', '@') - 1)
                    ELSE 
                      SUBSTR(REPLACE(NEW.trip_name, ' ', '-'), 1, 20)
                  END || '-' ||
                  COALESCE(
                    CASE 
                      WHEN NEW.destinations IS NOT NULL THEN 
                        SUBSTR(REPLACE(NEW.destinations, ' ', '-'), 1, 15)
                      ELSE 'trip'
                    END
                  ) || '-' ||
                  COALESCE(
                    CASE 
                      WHEN NEW.start_date IS NOT NULL THEN 
                        SUBSTR(NEW.start_date, 1, 4)  -- Extract year
                      ELSE SUBSTR(datetime('now'), 1, 4)
                    END
                  ), 
                  'trip-' || NEW.trip_id  -- Fallback
                ), 
                ' ', '-'
              ), 
              '&', 'and'
            ),
            ',', ''
          ),
          ';', ''
        ),
        '/', '-'
      )
    )
  )
  WHERE trip_id = NEW.trip_id;
END;

-- Step 4: Create trigger for slug updates when trip details change
CREATE TRIGGER tr_trips_slug_auto_update
  AFTER UPDATE OF trip_name, destinations, start_date, primary_client_email ON trips_v2
  WHEN OLD.trip_slug IS NOT NULL AND NEW.trip_slug = OLD.trip_slug
BEGIN
  UPDATE trips_v2 
  SET trip_slug = (
    SELECT LOWER(
      REPLACE(
        REPLACE(
          REPLACE(
            REPLACE(
              REPLACE(
                COALESCE(
                  CASE 
                    WHEN NEW.primary_client_email IS NOT NULL THEN 
                      SUBSTR(NEW.primary_client_email, 1, INSTR(NEW.primary_client_email || '@', '@') - 1)
                    ELSE 
                      SUBSTR(REPLACE(NEW.trip_name, ' ', '-'), 1, 20)
                  END || '-' ||
                  COALESCE(
                    CASE 
                      WHEN NEW.destinations IS NOT NULL THEN 
                        SUBSTR(REPLACE(NEW.destinations, ' ', '-'), 1, 15)
                      ELSE 'trip'
                    END
                  ) || '-' ||
                  COALESCE(
                    CASE 
                      WHEN NEW.start_date IS NOT NULL THEN 
                        SUBSTR(NEW.start_date, 1, 4)  -- Extract year
                      ELSE SUBSTR(datetime('now'), 1, 4)
                    END
                  ), 
                  'trip-' || NEW.trip_id  -- Fallback
                ), 
                ' ', '-'
              ), 
              '&', 'and'
            ),
            ',', ''
          ),
          ';', ''
        ),
        '/', '-'
      )
    )
  )
  WHERE trip_id = NEW.trip_id;
END;

-- Step 5: Populate slugs for existing trips
-- This will be handled by the migration script to ensure proper uniqueness