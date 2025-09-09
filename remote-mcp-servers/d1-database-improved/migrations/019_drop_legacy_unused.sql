-- 019_drop_legacy_unused.sql
-- Purpose: Remove unused legacy/experimental tables, views, and triggers
-- Safety: Idempotent (IF EXISTS). Keeps core v2 tables and commissions.


-- Drop triggers that reference tables we will remove
DROP TRIGGER IF EXISTS sync_trips_to_v2;
DROP TRIGGER IF EXISTS trg_travel_services_ai_dirty;
DROP TRIGGER IF EXISTS trg_travel_services_au_dirty;
DROP TRIGGER IF EXISTS trg_travel_services_ad_dirty;
DROP TRIGGER IF EXISTS trg_travel_services_update_timestamp;
DROP TRIGGER IF EXISTS trg_travel_search_cache_cleanup;
DROP TRIGGER IF EXISTS trg_travel_search_cache_update_access;
DROP TRIGGER IF EXISTS tr_trip_components_updated_at;
DROP TRIGGER IF EXISTS auto_create_product_verification;
DROP TRIGGER IF EXISTS auto_update_product_search_text;
DROP TRIGGER IF EXISTS auto_version_proposal_updates;

-- Drop legacy/experimental views
DROP VIEW IF EXISTS popular_routes;
DROP VIEW IF EXISTS RecentCaptures;
DROP VIEW IF EXISTS ResearchSummary;
DROP VIEW IF EXISTS MonitorStatus;
DROP VIEW IF EXISTS llm_universal_answer;
DROP VIEW IF EXISTS trip_summary_v2;
DROP VIEW IF EXISTS client_activity_v2;
DROP VIEW IF EXISTS trip_summary_with_clients;
DROP VIEW IF EXISTS pattern_performance;
DROP VIEW IF EXISTS session_performance_summary;
DROP VIEW IF EXISTS trip_search_view;
DROP VIEW IF EXISTS verification_checks_due;
DROP VIEW IF EXISTS verification_status_summary;
DROP VIEW IF EXISTS current_proposal_versions;
DROP VIEW IF EXISTS proposal_version_history;
DROP VIEW IF EXISTS proposal_version_comparison;
DROP VIEW IF EXISTS transportation_compat;
DROP VIEW IF EXISTS trip_products_fast;
DROP VIEW IF EXISTS verification_status_fast;
DROP VIEW IF EXISTS proposal_summary_fast;
DROP VIEW IF EXISTS workflow_status_v2;
DROP VIEW IF EXISTS active_portal_plugins;
DROP VIEW IF EXISTS portal_performance_stats;
DROP VIEW IF EXISTS trip_complete_v2;
DROP VIEW IF EXISTS semantic_search_results;
DROP VIEW IF EXISTS trip_client_relationships;

-- Drop legacy/unused tables (do NOT drop: trips_v2, clients_v2, trip_client_assignments,
-- ActivityLog, trip_facts, facts_dirty, hotel_cache, rooms_cache, TripCosts, BookingHistory,
-- llm_* tables, search_index, HtmlDocumentTemplates, proposals, schema_migrations,
-- commission_rates, commission_rules)

-- v1 legacy
DROP TABLE IF EXISTS Clients;
DROP TABLE IF EXISTS Trips;
DROP TABLE IF EXISTS TripDays;
DROP TABLE IF EXISTS TripParticipants;

-- redundant facts scaffolding
DROP TABLE IF EXISTS facts_dirty_v2;
DROP TABLE IF EXISTS trip_facts_v2;

-- experimental provider/product systems
DROP TABLE IF EXISTS provider_knowledge;
DROP TABLE IF EXISTS trip_products;
DROP TABLE IF EXISTS verification_checks;
DROP TABLE IF EXISTS parser_scripts;
DROP TABLE IF EXISTS js_extraction_patterns;
DROP TABLE IF EXISTS portal_plugins;
DROP TABLE IF EXISTS hotel_output_schema;

-- alternate proposal/versioning system
DROP TABLE IF EXISTS proposals_enhanced;
DROP TABLE IF EXISTS proposal_images;
DROP TABLE IF EXISTS proposal_versions;

-- crawling/extraction and publication
DROP TABLE IF EXISTS extraction_sessions;
DROP TABLE IF EXISTS extraction_attempts;
DROP TABLE IF EXISTS publication_log;

-- travel services experiments
DROP TABLE IF EXISTS travel_services;
DROP TABLE IF EXISTS travel_search_cache;

-- search/analytics extras
DROP TABLE IF EXISTS trip_components;
DROP TABLE IF EXISTS search_analytics;
DROP TABLE IF EXISTS suggestion_cache;

-- system/telemetry scaffolding (not required for MVP)
DROP TABLE IF EXISTS system_status;
DROP TABLE IF EXISTS session_indicator_state;
DROP TABLE IF EXISTS query_performance_log;
DROP TABLE IF EXISTS maintenance_reports;
DROP TABLE IF EXISTS migration_status;

-- documentation, instruction/email scaffolding
DROP TABLE IF EXISTS db_documentation;
DROP TABLE IF EXISTS instruction_sets;
DROP TABLE IF EXISTS instruction_access_log;
DROP TABLE IF EXISTS commission_config;
DROP TABLE IF EXISTS email_processing_log;
DROP TABLE IF EXISTS processed_emails;

-- misc other legacy experiment tables
DROP TABLE IF EXISTS trip_activities_enhanced;
DROP TABLE IF EXISTS trip_legs;
DROP TABLE IF EXISTS Documents;
DROP TABLE IF EXISTS DocumentTemplates;
DROP TABLE IF EXISTS TripDrivingAnalysis;

-- (No explicit transaction; D1 recommends per-statement execution for remote runs)
