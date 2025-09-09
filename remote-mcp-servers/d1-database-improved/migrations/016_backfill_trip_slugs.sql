-- 016_backfill_trip_slugs.sql
-- Purpose: Backfill trip_slug for existing trips and ensure uniqueness

-- Precondition: trips_v2 has a nullable TEXT column trip_slug and idx_trips_slug

WITH base AS (
  SELECT 
    t.trip_id,
    -- Build client part from email prefix or first words of trip name
    LOWER(
      CASE 
        WHEN t.primary_client_email IS NOT NULL AND t.primary_client_email LIKE '%@%'
          THEN substr(t.primary_client_email, 1, instr(t.primary_client_email, '@') - 1)
        ELSE replace(trim(
          replace(replace(replace(replace(replace(
            lower(t.trip_name),
            '  ', ' '), '\t', ' '), '\n', ' '), '.', ''), ',', ''
        )), ' ', '-')
      END
    ) AS client_part_raw,
    -- Destination part: first word of destinations or 'trip'
    LOWER(
      COALESCE(
        NULLIF(
          substr(
            COALESCE(t.destinations, ''),
            1,
            CASE instr(COALESCE(t.destinations, ''), ' ')
              WHEN 0 THEN length(COALESCE(t.destinations, ''))
              ELSE instr(COALESCE(t.destinations, ''), ' ') - 1
            END
          ), ''
        ),
        'trip'
      )
    ) AS dest_part_raw,
    -- Year part from start_date
    CASE 
      WHEN t.start_date GLOB '____-*' THEN substr(t.start_date, 1, 4)
      ELSE CAST(strftime('%Y', 'now') AS TEXT)
    END AS year_part
  FROM trips_v2 t
  WHERE t.trip_slug IS NULL OR t.trip_slug = ''
),
normalized AS (
  SELECT
    trip_id,
    -- Normalize client and destination parts: replace special chars, collapse hyphens
    TRIM(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(client_part_raw, '&', 'and'), '"',''), '\'',''), '(',''), ')',''), '/', ''), '-') AS client_part,
    TRIM(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(dest_part_raw, '&', 'and'), '"',''), '\'',''), '(',''), ')',''), '/', ''), '-') AS dest_part,
    year_part
  FROM base
),
slugged AS (
  SELECT 
    trip_id,
    LOWER(
      replace(
        replace(
          replace(
            printf('%s-%s-%s', client_part, dest_part, year_part),
            ' ', '-'
          ),
          '--', '-'
        ),
        '--', '-'
      )
    ) AS base_slug
  FROM normalized
),
uniqued AS (
  SELECT 
    s.trip_id,
    s.base_slug,
    ROW_NUMBER() OVER (PARTITION BY s.base_slug ORDER BY s.trip_id) AS rn
  FROM slugged s
)
UPDATE trips_v2
SET trip_slug = CASE 
  WHEN u.rn = 1 THEN u.base_slug
  ELSE u.base_slug || '-' || (u.rn - 1)
END
FROM uniqued u
WHERE trips_v2.trip_id = u.trip_id
  AND (trips_v2.trip_slug IS NULL OR trips_v2.trip_slug = '');

-- Ensure index exists
CREATE INDEX IF NOT EXISTS idx_trips_slug ON trips_v2(trip_slug);

