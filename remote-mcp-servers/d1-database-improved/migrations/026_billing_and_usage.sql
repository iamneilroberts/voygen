-- Migration 026: Billing & Usage Schema for Voygent
-- Adapts a Stripe-friendly, usage-tracking schema to the v2 D1 layout (SQLite)
-- Conventions: INTEGER PRIMARY KEY AUTOINCREMENT, TEXT for external IDs, JSON for flexible fields

PRAGMA defer_foreign_keys=TRUE;

-- 1) Advisors (Voygent users / agents). We keep this minimal and map by email or external auth id.
CREATE TABLE IF NOT EXISTS advisors (
  advisor_id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  display_name TEXT,
  external_user_id TEXT,        -- e.g., LibreChat/Mongo user id, or auth provider id
  auth_provider TEXT,           -- e.g., librechat, clerk, auth0
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_advisors_email ON advisors(email);
CREATE INDEX IF NOT EXISTS idx_advisors_external ON advisors(external_user_id);

-- 2) Subscription Tiers (limits stored as columns for easy queries)
CREATE TABLE IF NOT EXISTS subscription_tiers (
  tier TEXT PRIMARY KEY,                 -- 'free' | 'starter' | 'pro'
  price_cents_monthly INTEGER DEFAULT 0,
  max_trips_per_month INTEGER NOT NULL,
  max_published INTEGER NOT NULL,
  weekly_ai_requests INTEGER NOT NULL,
  active INTEGER DEFAULT 1 CHECK(active IN (0,1))
);

INSERT OR IGNORE INTO subscription_tiers (tier, price_cents_monthly, max_trips_per_month, max_published, weekly_ai_requests, active) VALUES
('free',    0,    2,   1,    40,   1),
('starter', 2900, 50,  10,   600,  1),
('pro',     9900, 200, 9999, 2000, 1);

-- 3) Subscriptions (Stripe mapping)
CREATE TABLE IF NOT EXISTS subscriptions (
  subscription_id INTEGER PRIMARY KEY AUTOINCREMENT,
  advisor_id INTEGER NOT NULL,
  stripe_customer_id TEXT NOT NULL,
  stripe_subscription_id TEXT UNIQUE NOT NULL,
  tier TEXT NOT NULL REFERENCES subscription_tiers(tier),
  status TEXT,                          -- active, canceled, past_due, trialing
  current_period_start TIMESTAMP,
  current_period_end TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (advisor_id) REFERENCES advisors(advisor_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_advisor ON subscriptions(advisor_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

-- 4) Entitlement overrides (per-account exceptions)
CREATE TABLE IF NOT EXISTS entitlement_overrides (
  override_id INTEGER PRIMARY KEY AUTOINCREMENT,
  advisor_id INTEGER NOT NULL REFERENCES advisors(advisor_id) ON DELETE CASCADE,
  max_trips_per_month INTEGER,
  max_published INTEGER,
  weekly_ai_requests INTEGER,
  effective_from TIMESTAMP,
  effective_to TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_entitlement_overrides_advisor ON entitlement_overrides(advisor_id);

-- 5) Usage Events (atomic log)
CREATE TABLE IF NOT EXISTS usage_events (
  usage_id INTEGER PRIMARY KEY AUTOINCREMENT,
  advisor_id INTEGER NOT NULL REFERENCES advisors(advisor_id) ON DELETE CASCADE,
  trip_id INTEGER REFERENCES trips_v2(trip_id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN ('trip_created','trip_published','ai_request')),
  model TEXT,                 -- for ai_request
  tokens_in INTEGER DEFAULT 0,
  tokens_out INTEGER DEFAULT 0,
  cost_cents INTEGER DEFAULT 0,
  metadata JSON DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_usage_events_advisor_time ON usage_events(advisor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_events_action_time ON usage_events(action, created_at DESC);

-- 6) Monthly Rollup (fast entitlement checks)
CREATE TABLE IF NOT EXISTS usage_monthly_rollup (
  advisor_id INTEGER NOT NULL,
  year_month TEXT NOT NULL,              -- 'YYYY-MM'
  trips_created INTEGER DEFAULT 0,
  trips_published INTEGER DEFAULT 0,
  ai_requests INTEGER DEFAULT 0,
  tokens_in INTEGER DEFAULT 0,
  tokens_out INTEGER DEFAULT 0,
  cost_cents INTEGER DEFAULT 0,
  PRIMARY KEY (advisor_id, year_month),
  FOREIGN KEY (advisor_id) REFERENCES advisors(advisor_id) ON DELETE CASCADE
);

-- Trigger to upsert into monthly rollup on each usage event
CREATE TRIGGER IF NOT EXISTS trg_usage_events_rollup
AFTER INSERT ON usage_events
BEGIN
  INSERT INTO usage_monthly_rollup (
    advisor_id, year_month, trips_created, trips_published, ai_requests, tokens_in, tokens_out, cost_cents
  ) VALUES (
    NEW.advisor_id,
    strftime('%Y-%m', COALESCE(NEW.created_at, CURRENT_TIMESTAMP)),
    CASE WHEN NEW.action = 'trip_created'  THEN 1 ELSE 0 END,
    CASE WHEN NEW.action = 'trip_published' THEN 1 ELSE 0 END,
    CASE WHEN NEW.action = 'ai_request'    THEN 1 ELSE 0 END,
    COALESCE(NEW.tokens_in, 0),
    COALESCE(NEW.tokens_out, 0),
    COALESCE(NEW.cost_cents, 0)
  )
  ON CONFLICT(advisor_id, year_month) DO UPDATE SET
    trips_created   = trips_created   + (CASE WHEN NEW.action = 'trip_created'   THEN 1 ELSE 0 END),
    trips_published = trips_published + (CASE WHEN NEW.action = 'trip_published' THEN 1 ELSE 0 END),
    ai_requests     = ai_requests     + (CASE WHEN NEW.action = 'ai_request'     THEN 1 ELSE 0 END),
    tokens_in       = tokens_in       + COALESCE(NEW.tokens_in, 0),
    tokens_out      = tokens_out      + COALESCE(NEW.tokens_out, 0),
    cost_cents      = cost_cents      + COALESCE(NEW.cost_cents, 0);
END;

-- 7) Convenience View
DROP VIEW IF EXISTS billing_overview;
CREATE VIEW billing_overview AS
SELECT 
  a.advisor_id,
  a.email,
  s.tier,
  s.status,
  s.current_period_start,
  s.current_period_end,
  r.year_month,
  r.trips_created,
  r.trips_published,
  r.ai_requests,
  r.tokens_in,
  r.tokens_out,
  r.cost_cents
FROM advisors a
LEFT JOIN subscriptions s ON s.advisor_id = a.advisor_id
LEFT JOIN usage_monthly_rollup r ON r.advisor_id = a.advisor_id;

-- Track migration
INSERT OR IGNORE INTO schema_migrations(name) VALUES('026_billing_and_usage');
INSERT OR IGNORE INTO migration_status(migration_name, status, started_at, completed_at)
VALUES('billing_and_usage_schema','completed',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);

