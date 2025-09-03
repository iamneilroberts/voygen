-- 003_commission_system.sql
-- Purpose: Commission rates and rule engine scaffolding

BEGIN TRANSACTION;

CREATE TABLE IF NOT EXISTS commission_rates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  supplier TEXT,
  product_type TEXT, -- hotel, flight, tour, transfer, package
  rate_type TEXT CHECK(rate_type IN ('percent','fixed')) NOT NULL DEFAULT 'percent',
  rate_value REAL NOT NULL,
  currency TEXT DEFAULT 'USD',
  start_date TEXT,
  end_date TEXT,
  active BOOLEAN DEFAULT 1,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_commission_rates_lookup
  ON commission_rates(supplier, product_type, active);

CREATE TABLE IF NOT EXISTS commission_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rule_name TEXT NOT NULL,
  priority INTEGER DEFAULT 100,
  criteria_json TEXT NOT NULL,
  rate_id INTEGER,
  active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (rate_id) REFERENCES commission_rates(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_commission_rules_active
  ON commission_rules(active, priority);

-- Default data
INSERT INTO commission_rates (supplier, product_type, rate_type, rate_value, notes)
VALUES
  ('Generic', 'hotel', 'percent', 10.0, 'Default hotel commission'),
  ('Generic', 'tour', 'percent', 12.0, 'Default tour commission')
ON CONFLICT DO NOTHING;

INSERT INTO commission_rules (rule_name, priority, criteria_json, rate_id, active)
SELECT 'Default hotel rule', 100, '{"product_type":"hotel"}', id, 1
  FROM commission_rates WHERE supplier='Generic' AND product_type='hotel'
ON CONFLICT DO NOTHING;

INSERT INTO commission_rules (rule_name, priority, criteria_json, rate_id, active)
SELECT 'Default tour rule', 100, '{"product_type":"tour"}', id, 1
  FROM commission_rates WHERE supplier='Generic' AND product_type='tour'
ON CONFLICT DO NOTHING;

COMMIT;

