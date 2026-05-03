ALTER TABLE curator_sessions
  ADD COLUMN IF NOT EXISTS input_tokens        INTEGER,
  ADD COLUMN IF NOT EXISTS output_tokens       INTEGER,
  ADD COLUMN IF NOT EXISTS web_search_requests INTEGER;
