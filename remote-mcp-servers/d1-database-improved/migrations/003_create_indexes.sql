-- Core relationship indexes
CREATE INDEX IF NOT EXISTS idx_trips_group ON Trips(group_id);
CREATE INDEX IF NOT EXISTS idx_trips_dates ON Trips(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_trips_status ON Trips(status);

CREATE INDEX IF NOT EXISTS idx_tripdays_trip ON TripDays(trip_id);
CREATE INDEX IF NOT EXISTS idx_tripdays_date ON TripDays(date);

CREATE INDEX IF NOT EXISTS idx_activities_day ON TripActivities(day_id);
CREATE INDEX IF NOT EXISTS idx_activities_trip ON TripActivities(trip_id);
CREATE INDEX IF NOT EXISTS idx_activities_destination ON TripActivities(destination_id);

CREATE INDEX IF NOT EXISTS idx_accommodations_trip ON Accommodations(trip_id);
CREATE INDEX IF NOT EXISTS idx_accommodations_dates ON Accommodations(check_in_date, check_out_date);

CREATE INDEX IF NOT EXISTS idx_transportation_trip ON Transportation(trip_id);
CREATE INDEX IF NOT EXISTS idx_transportation_day ON Transportation(trip_day_id);

CREATE INDEX IF NOT EXISTS idx_clients_email ON Clients(email);
CREATE INDEX IF NOT EXISTS idx_clients_name ON Clients(last_name, first_name);

CREATE INDEX IF NOT EXISTS idx_documents_trip ON Documents(trip_id);
CREATE INDEX IF NOT EXISTS idx_documents_type ON Documents(type);

-- Activity log indexes for performance
CREATE INDEX IF NOT EXISTS idx_activitylog_trip ON ActivityLog(trip_id);
CREATE INDEX IF NOT EXISTS idx_activitylog_client ON ActivityLog(client_id);
CREATE INDEX IF NOT EXISTS idx_activitylog_session ON ActivityLog(session_id);
CREATE INDEX IF NOT EXISTS idx_activitylog_timestamp ON ActivityLog(activity_timestamp);

-- Session management
CREATE INDEX IF NOT EXISTS idx_session_active ON SessionManagement(is_active);
CREATE INDEX IF NOT EXISTS idx_session_trip ON SessionManagement(primary_trip_id);

-- Financial tracking
CREATE INDEX IF NOT EXISTS idx_tripcosts_trip ON TripCosts(trip_id);
CREATE INDEX IF NOT EXISTS idx_tripcosts_category ON TripCosts(category);

-- Tour bookings
CREATE INDEX IF NOT EXISTS idx_tourbookings_trip ON TourBookings(trip_id);
CREATE INDEX IF NOT EXISTS idx_tourbookings_day ON TourBookings(day_id);
CREATE INDEX IF NOT EXISTS idx_tourbookings_status ON TourBookings(status);