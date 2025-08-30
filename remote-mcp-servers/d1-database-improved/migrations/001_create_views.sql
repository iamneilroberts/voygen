-- Trip Summary View
-- Provides complete trip overview with client and cost information
CREATE VIEW IF NOT EXISTS trip_summary AS
SELECT 
    t.trip_id,
    t.trip_name,
    t.start_date,
    t.end_date,
    t.duration,
    t.status,
    t.description,
    t.total_cost,
    t.currency,
    t.paid_amount,
    t.balance_due,
    t.agent_name,
    -- Client information
    cg.group_name,
    GROUP_CONCAT(DISTINCT c.first_name || ' ' || c.last_name) as participants,
    COUNT(DISTINCT c.client_id) as participant_count,
    -- Destination summary
    GROUP_CONCAT(DISTINCT d.destination_name) as destinations,
    -- Activity counts
    COUNT(DISTINCT ta.activity_id) as total_activities,
    COUNT(DISTINCT acc.accommodation_id) as total_accommodations,
    COUNT(DISTINCT trans.transportation_id) as total_transports,
    -- Last update
    MAX(t.updated_at) as last_updated
FROM Trips t
LEFT JOIN ClientGroups cg ON t.group_id = cg.group_id
LEFT JOIN ClientGroupMembers cgm ON cg.group_id = cgm.group_id
LEFT JOIN Clients c ON cgm.client_id = c.client_id
LEFT JOIN TripDays td ON t.trip_id = td.trip_id
LEFT JOIN TripActivities ta ON td.day_id = ta.day_id
LEFT JOIN Destinations d ON ta.destination_id = d.destination_id
LEFT JOIN Accommodations acc ON t.trip_id = acc.trip_id
LEFT JOIN Transportation trans ON t.trip_id = trans.trip_id
GROUP BY t.trip_id;

-- Daily Itinerary View
-- Provides complete daily schedule with all activities
CREATE VIEW IF NOT EXISTS daily_itinerary AS
SELECT 
    td.trip_id,
    td.day_id,
    td.day_number,
    td.date,
    td.day_name,
    td.description as day_description,
    -- Morning accommodations
    acc.accommodation_name,
    acc.check_in_date,
    acc.check_out_date,
    -- Activities with timing
    ta.start_time,
    ta.end_time,
    ta.activity_type,
    ta.activity_title,
    ta.description as activity_description,
    ta.location_name,
    d.destination_name,
    ta.is_hidden_gem,
    -- Transportation
    trans.transport_type,
    trans.departure_time,
    trans.arrival_time,
    trans.departure_location,
    trans.arrival_location,
    -- Tours and bookings
    tp.name as tour_name,
    tb.status as booking_status,
    tb.is_included
FROM TripDays td
LEFT JOIN TripActivities ta ON td.day_id = ta.day_id
LEFT JOIN Destinations d ON ta.destination_id = d.destination_id
LEFT JOIN Accommodations acc ON td.trip_id = acc.trip_id 
    AND acc.trip_day_id = td.day_id
LEFT JOIN Transportation trans ON td.trip_id = trans.trip_id 
    AND trans.trip_day_id = td.day_id
LEFT JOIN TourBookings tb ON td.day_id = tb.day_id
LEFT JOIN TourProducts tp ON tb.tour_id = tp.tour_id
ORDER BY td.day_number, ta.start_time;

-- Trip Financial Summary View
-- Comprehensive cost breakdown by category
CREATE VIEW IF NOT EXISTS trip_financial_summary AS
SELECT 
    t.trip_id,
    t.trip_name,
    t.total_cost as quoted_total,
    t.paid_amount,
    t.balance_due,
    t.currency,
    -- Accommodation costs
    SUM(CASE WHEN acc.total_cost IS NOT NULL THEN acc.total_cost ELSE 0 END) as accommodation_total,
    -- Transportation costs
    SUM(CASE WHEN trans.cost IS NOT NULL THEN trans.cost ELSE 0 END) as transportation_total,
    -- Tour costs
    SUM(CASE WHEN tb.price IS NOT NULL THEN tb.price ELSE 0 END) as tours_total,
    -- Other costs from TripCosts
    SUM(CASE WHEN tc.category = 'meals' THEN tc.total_cost ELSE 0 END) as meals_total,
    SUM(CASE WHEN tc.category = 'activities' THEN tc.total_cost ELSE 0 END) as activities_total,
    SUM(CASE WHEN tc.category = 'other' THEN tc.total_cost ELSE 0 END) as other_total,
    -- Calculate actual vs quoted
    (t.total_cost - (
        COALESCE(SUM(acc.total_cost), 0) + 
        COALESCE(SUM(trans.cost), 0) + 
        COALESCE(SUM(tb.price), 0) + 
        COALESCE(SUM(tc.total_cost), 0)
    )) as variance
FROM Trips t
LEFT JOIN Accommodations acc ON t.trip_id = acc.trip_id
LEFT JOIN Transportation trans ON t.trip_id = trans.trip_id
LEFT JOIN TourBookings tb ON t.trip_id = tb.trip_id
LEFT JOIN TripCosts tc ON t.trip_id = tc.trip_id
GROUP BY t.trip_id;

-- Client Trip History View
-- Shows all trips for each client with summary info
CREATE VIEW IF NOT EXISTS client_trip_history AS
SELECT 
    c.client_id,
    c.first_name,
    c.last_name,
    c.email,
    t.trip_id,
    t.trip_name,
    t.start_date,
    t.end_date,
    t.status,
    cg.group_name,
    cgm.relationship,
    COUNT(DISTINCT td.day_id) as total_days,
    COUNT(DISTINCT ta.activity_id) as total_activities,
    t.total_cost,
    t.currency
FROM Clients c
JOIN ClientGroupMembers cgm ON c.client_id = cgm.client_id
JOIN ClientGroups cg ON cgm.group_id = cg.group_id
JOIN Trips t ON cg.group_id = t.group_id
LEFT JOIN TripDays td ON t.trip_id = td.trip_id
LEFT JOIN TripActivities ta ON td.day_id = ta.day_id
GROUP BY c.client_id, t.trip_id
ORDER BY c.last_name, c.first_name, t.start_date DESC;

-- Active Trips Dashboard View
-- Shows only current/upcoming trips with key metrics
CREATE VIEW IF NOT EXISTS active_trips_dashboard AS
SELECT 
    t.trip_id,
    t.trip_name,
    t.start_date,
    t.end_date,
    t.status,
    cg.group_name,
    GROUP_CONCAT(DISTINCT c.first_name || ' ' || c.last_name) as participants,
    -- Days until departure
    CAST(julianday(t.start_date) - julianday('now') AS INTEGER) as days_until_departure,
    -- Progress metrics
    t.paid_amount / NULLIF(t.total_cost, 0) * 100 as payment_progress_pct,
    COUNT(DISTINCT CASE WHEN ta.activity_id IS NOT NULL THEN td.day_id END) * 100.0 / 
        NULLIF(COUNT(DISTINCT td.day_id), 0) as planning_progress_pct,
    -- Key counts
    COUNT(DISTINCT acc.accommodation_id) as accommodations_booked,
    COUNT(DISTINCT trans.transportation_id) as transports_booked,
    COUNT(DISTINCT tb.booking_id) as tours_booked,
    -- Documents
    COUNT(DISTINCT doc.document_id) as documents_count
FROM Trips t
LEFT JOIN ClientGroups cg ON t.group_id = cg.group_id
LEFT JOIN ClientGroupMembers cgm ON cg.group_id = cgm.group_id
LEFT JOIN Clients c ON cgm.client_id = c.client_id
LEFT JOIN TripDays td ON t.trip_id = td.trip_id
LEFT JOIN TripActivities ta ON td.day_id = ta.day_id
LEFT JOIN Accommodations acc ON t.trip_id = acc.trip_id
LEFT JOIN Transportation trans ON t.trip_id = trans.trip_id
LEFT JOIN TourBookings tb ON t.trip_id = tb.trip_id
LEFT JOIN Documents doc ON t.trip_id = doc.trip_id
WHERE t.status IN ('planning', 'confirmed', 'in_progress')
    AND t.end_date >= date('now', '-7 days')
GROUP BY t.trip_id
ORDER BY t.start_date;