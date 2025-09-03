-- 005_proposal_system.sql
-- Purpose: Enhanced proposals with versioning and image attachments

BEGIN TRANSACTION;

CREATE TABLE IF NOT EXISTS proposals_enhanced (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT DEFAULT 'draft', -- draft, sent, accepted, rejected
  title TEXT,
  summary TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (trip_id) REFERENCES Trips(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_proposals_ver
  ON proposals_enhanced(trip_id, version);

CREATE INDEX IF NOT EXISTS idx_proposals_status ON proposals_enhanced(status);
CREATE INDEX IF NOT EXISTS idx_proposals_created ON proposals_enhanced(created_at);

CREATE TABLE IF NOT EXISTS proposal_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  proposal_id INTEGER NOT NULL,
  image_url TEXT NOT NULL,
  caption TEXT,
  sort_order INTEGER DEFAULT 0,
  FOREIGN KEY (proposal_id) REFERENCES proposals_enhanced(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_proposal_images_proposal ON proposal_images(proposal_id);

COMMIT;

