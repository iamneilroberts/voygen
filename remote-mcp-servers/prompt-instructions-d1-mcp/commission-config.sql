-- Commission configuration table and seed data
-- This stores configurable commission targets and split percentages

CREATE TABLE IF NOT EXISTS commission_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    config_key TEXT UNIQUE NOT NULL,
    config_value TEXT NOT NULL,
    description TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_commission_config_key ON commission_config(config_key);

-- Seed with default commission configuration values
INSERT OR REPLACE INTO commission_config (config_key, config_value, description) VALUES
('target_net_percentage', '0.15', 'Target net commission as percentage of trip total'),
('minimum_net_amount', '500', 'Minimum net commission per trip in USD'),
('cruise_planners_take', '0.30', 'Percentage Cruise Planners takes from gross commission'),
('somo_travel_take', '0.20', 'Percentage SomoTravel takes from remaining after CP'),
('service_fee_threshold', '0.10', 'If net commission below this percentage, suggest service fee'),
('service_fee_small', '250', 'Service fee for trips under $5,000'),
('service_fee_medium', '500', 'Service fee for trips $5,000-$10,000'),
('service_fee_large', '750', 'Service fee for trips $10,000-$15,000'),
('service_fee_complex', '1000', 'Service fee for complex multi-destination trips'),
-- Commission rates by source
('commission_rate_delta_hotels', '0.12', 'Average commission rate for Delta Vacations hotels'),
('commission_rate_aa_hotels', '0.11', 'Average commission rate for AA Vacations hotels'),
('commission_rate_viator', '0.08', 'Commission rate for Viator tours'),
('commission_rate_insurance', '0.35', 'Average commission rate for travel insurance'),
('commission_rate_car_rental', '0.09', 'Average commission rate for car rentals'),
('commission_rate_transfers', '0.12', 'Average commission rate for airport transfers'),
('commission_rate_cruise_standard', '0.11', 'Average commission rate for standard cruise lines'),
('commission_rate_cruise_luxury', '0.15', 'Average commission rate for luxury cruise lines');