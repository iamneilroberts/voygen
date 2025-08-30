-- Dual-write triggers for gradual migration
CREATE TRIGGER IF NOT EXISTS sync_trips_to_v2
AFTER INSERT ON Trips
BEGIN
  INSERT INTO trips_v2 (trip_id, trip_data, search_vector, created_at, updated_at)
  VALUES (
    NEW.trip_id,
    json_object('trip_name', NEW.trip_name, 'client_name', NEW.client_name),
    NEW.trip_name || ' ' || NEW.client_name,
    NEW.created_at,
    NEW.updated_at
  );
END;