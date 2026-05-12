ALTER TABLE credit_transactions
  ADD COLUMN IF NOT EXISTS feature TEXT,
  ADD COLUMN IF NOT EXISTS reference_id TEXT,
  ADD COLUMN IF NOT EXISTS balance_after_cents INTEGER,
  ADD COLUMN IF NOT EXISTS metadata_json JSONB,
  ADD COLUMN IF NOT EXISTS cf_count INTEGER,
  ADD COLUMN IF NOT EXISTS gemini_count INTEGER,
  ADD COLUMN IF NOT EXISTS failed_count INTEGER;

UPDATE credit_transactions
SET
  feature = CASE
    WHEN feature IS NOT NULL THEN feature
    WHEN curator_session_id LIKE 'chat:%' THEN 'chat'
    WHEN type IN ('purchase', 'free_grant') THEN 'billing'
    ELSE 'curator'
  END,
  reference_id = CASE
    WHEN reference_id IS NOT NULL THEN reference_id
    WHEN curator_session_id LIKE 'chat:%' THEN substring(curator_session_id from 6)
    ELSE curator_session_id
  END
WHERE feature IS NULL OR reference_id IS NULL;
