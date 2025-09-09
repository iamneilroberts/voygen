-- PHASE 2: Trip Slug System Implementation (Fixed)
-- Adds URL-friendly trip identifiers - without UNIQUE constraint initially

-- Step 1: Add trip_slug column (nullable, no unique constraint)
ALTER TABLE trips_v2 ADD COLUMN trip_slug TEXT;

-- Step 2: Create index for efficient slug lookups
CREATE INDEX IF NOT EXISTS idx_trips_slug ON trips_v2(trip_slug);

-- Step 3: Populate slugs for existing trips - simplified version
UPDATE trips_v2 
SET trip_slug = LOWER(
  REPLACE(
    REPLACE(
      REPLACE(
        REPLACE(
          REPLACE(
            CASE 
              WHEN primary_client_email IS NOT NULL THEN 
                SUBSTR(primary_client_email, 1, INSTR(primary_client_email || '@', '@') - 1)
              ELSE 
                SUBSTR(REPLACE(trip_name, ' ', '-'), 1, 20)
            END || '-' ||
            CASE 
              WHEN destinations IS NOT NULL THEN 
                SUBSTR(REPLACE(destinations, ' ', '-'), 1, 15)
              ELSE 'trip'
            END || '-' ||
            CASE 
              WHEN start_date IS NOT NULL THEN 
                SUBSTR(start_date, 1, 4)
              ELSE '2025'
            END || '-' || trip_id,
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
WHERE trip_slug IS NULL;