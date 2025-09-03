BEGIN TRANSACTION;
DROP TRIGGER IF EXISTS trg_activitylog_ad_dirty;
DROP TRIGGER IF EXISTS trg_activitylog_au_dirty;
DROP TRIGGER IF EXISTS trg_activitylog_ai_dirty;
DROP TRIGGER IF EXISTS trg_tripdays_ad_dirty;
DROP TRIGGER IF EXISTS trg_tripdays_au_dirty;
DROP TRIGGER IF EXISTS trg_tripdays_ai_dirty;
DROP TRIGGER IF EXISTS trg_trips_ad_dirty;
DROP TRIGGER IF EXISTS trg_trips_au_dirty;
DROP TRIGGER IF EXISTS trg_trips_ai_dirty;
DROP TABLE IF EXISTS facts_dirty;
DROP TABLE IF EXISTS trip_facts;
COMMIT;

