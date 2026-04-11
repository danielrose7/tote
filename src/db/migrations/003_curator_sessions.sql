CREATE TABLE IF NOT EXISTS curator_sessions (
  session_id    TEXT PRIMARY KEY,
  clerk_user_id TEXT NOT NULL,
  topic         TEXT,
  mode          TEXT,
  model         TEXT,
  phase         TEXT,
  section_count INTEGER,
  item_count    INTEGER,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS curator_sessions_user_idx
  ON curator_sessions (clerk_user_id, created_at DESC);
