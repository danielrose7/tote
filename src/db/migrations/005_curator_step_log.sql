CREATE TABLE IF NOT EXISTS curator_step_log (
  id          SERIAL PRIMARY KEY,
  session_id  TEXT        NOT NULL,
  step_name   TEXT        NOT NULL,
  status      TEXT        NOT NULL,
  data        JSONB,
  ts          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS curator_step_log_session_ts_idx
  ON curator_step_log (session_id, ts);
