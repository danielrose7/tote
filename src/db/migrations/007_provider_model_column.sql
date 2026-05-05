-- Add provider and model columns to credit_transactions for billing attribution and cost analysis.
ALTER TABLE credit_transactions
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS model    text;

-- Back-populate based on step_label patterns.
-- Steps using Haiku (via llm.batchSearch / generateWithSearch):
--   find-urls-*, deduct-credits-urls-*, category-research, market-landscape
-- Steps using Puppeteer (CF browser run with zero LLM tokens):
--   extract-section-* with input_tokens = 0
-- Everything else with tokens → Sonnet.

UPDATE credit_transactions
SET
  provider = CASE
    WHEN input_tokens > 0 THEN 'anthropic'
    WHEN input_tokens = 0
         AND step_label LIKE 'extract-section-%' THEN 'cloudflare'
    ELSE NULL
  END,
  model = CASE
    WHEN input_tokens > 0
         AND step_label IN ('deduct-credits-category-research', 'deduct-credits-market-landscape')
         THEN 'claude-haiku-4-5-20251001'
    WHEN input_tokens > 0
         AND step_label LIKE 'deduct-credits-urls-%'
         THEN 'claude-haiku-4-5-20251001'
    WHEN input_tokens > 0 THEN 'claude-sonnet-4-6'
    WHEN input_tokens = 0
         AND step_label LIKE 'extract-section-%' THEN 'puppeteer'
    ELSE NULL
  END
WHERE provider IS NULL;
