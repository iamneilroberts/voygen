.output cleaned.sql
.mode insert trips_v2
SELECT * FROM trips_v2;
.mode insert clients_v2
SELECT * FROM clients_v2;
.mode insert trip_client_assignments
SELECT * FROM trip_client_assignments;
.mode insert ActivityLog
SELECT * FROM ActivityLog;
.mode insert llm_trip_context
SELECT * FROM llm_trip_context;
.mode insert llm_faq_cache
SELECT * FROM llm_faq_cache;
.mode insert HtmlDocumentTemplates
SELECT * FROM HtmlDocumentTemplates;
.mode insert hotel_cache
SELECT * FROM hotel_cache;
.mode insert rooms_cache
SELECT * FROM rooms_cache;
.mode insert TripCosts
SELECT * FROM TripCosts;
.mode insert BookingHistory
SELECT * FROM BookingHistory;
.output stdout
