CREATE TABLE IF NOT EXISTS user_credits (
  clerk_user_id      TEXT PRIMARY KEY,
  balance_cents      INTEGER NOT NULL DEFAULT 0,
  stripe_customer_id TEXT,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS credit_transactions (
  id                  SERIAL PRIMARY KEY,
  clerk_user_id       TEXT NOT NULL,
  amount_cents        INTEGER NOT NULL,
  type                TEXT NOT NULL CHECK (type IN ('free_grant', 'purchase', 'deduction')),
  stripe_session_id   TEXT,
  curator_session_id  TEXT,
  input_tokens        INTEGER,
  output_tokens       INTEGER,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS credit_transactions_user_idx
  ON credit_transactions (clerk_user_id, created_at DESC);
