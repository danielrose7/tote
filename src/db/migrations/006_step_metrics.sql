ALTER TABLE credit_transactions
  ADD COLUMN IF NOT EXISTS url_count           INTEGER,
  ADD COLUMN IF NOT EXISTS candidate_count     INTEGER,
  ADD COLUMN IF NOT EXISTS duration_ms         INTEGER,
  ADD COLUMN IF NOT EXISTS code_execution_count INTEGER;
