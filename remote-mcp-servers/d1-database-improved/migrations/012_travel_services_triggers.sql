-- 012_travel_services_triggers.sql
-- Purpose: Integrate travel services with existing facts system


-- Add travel services to facts dirty tracking
CREATE TRIGGER trg_travel_services_ai_dirty
AFTER INSERT ON travel_services
WHEN NEW.trip_id IS NOT NULL
BEGIN
  INSERT INTO facts_dirty(trip_id, reason) 
  VALUES (NEW.trip_id, 'travel_service_insert');
END;

CREATE TRIGGER trg_travel_services_au_dirty
AFTER UPDATE ON travel_services
WHEN NEW.trip_id IS NOT NULL
BEGIN
  INSERT INTO facts_dirty(trip_id, reason) 
  VALUES (NEW.trip_id, 'travel_service_update');
END;

CREATE TRIGGER trg_travel_services_ad_dirty
AFTER DELETE ON travel_services
WHEN OLD.trip_id IS NOT NULL
BEGIN
  INSERT INTO facts_dirty(trip_id, reason) 
  VALUES (OLD.trip_id, 'travel_service_delete');
END;

-- Auto-update timestamps on service updates
CREATE TRIGGER trg_travel_services_update_timestamp
BEFORE UPDATE ON travel_services
BEGIN
  UPDATE travel_services 
  SET updated_at = datetime('now')
  WHERE id = NEW.id;
END;

-- Clean expired cache entries automatically (run occasionally)
CREATE TRIGGER trg_travel_search_cache_cleanup
AFTER INSERT ON travel_search_cache
WHEN NEW.id % 100 = 0  -- Only run cleanup every 100 inserts
BEGIN
  DELETE FROM travel_search_cache 
  WHERE expires_at < datetime('now')
    AND id != NEW.id;
  
  DELETE FROM travel_services 
  WHERE cache_expires_at < datetime('now')
    AND trip_id IS NULL; -- Only clean unassigned cached results
END;

-- Update search cache access tracking
CREATE TRIGGER trg_travel_search_cache_update_access
BEFORE UPDATE ON travel_search_cache
WHEN NEW.last_accessed != OLD.last_accessed
BEGIN
  UPDATE travel_search_cache
  SET access_count = access_count + 1
  WHERE id = NEW.id;
END;

