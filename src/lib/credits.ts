/**
 * Credit balance helpers.
 *
 * Ledger lives in Neon Postgres:
 *   user_credits        — current balance per user (denormalized for fast reads)
 *   credit_transactions — immutable log of every grant and deduction
 *
 * Cost formula (raw — no margin multiplier yet):
 *   Sonnet 4.6:  $3.00 / 1M input tokens, $15.00 / 1M output tokens
 *   Haiku 4.5:   $0.80 / 1M input tokens,  $4.00 / 1M output tokens
 *   Brave Search: $5.00 / 1K requests ($0.005/search = 0.5 cents)
 *
 * MARGIN_MULTIPLIER is set to 1 until real cost data is collected across enough
 * runs. Increase to 5 once instrumented. See docs/CURATOR_PRICING_STRATEGY.md.
 */

import { sql } from './db';

const MARGIN_MULTIPLIER = 1; // TODO: raise to ~5 after cost calibration

// Token pricing in dollars per million tokens
const PRICING = {
  'claude-sonnet-4-6': { input: 3.0, output: 15.0 },
  'claude-haiku-4-5-20251001': { input: 0.8, output: 4.0 },
} as const;

type SupportedModel = keyof typeof PRICING;

const BRAVE_SEARCH_COST_CENTS = 0.5; // $5.00 / 1K requests

/** Total cost in cents for a step, given model, tokens, and web searches. */
export function runCostCents(
  inputTokens: number,
  outputTokens: number,
  webSearchRequests: number,
  model: SupportedModel = 'claude-sonnet-4-6',
): number {
  const { input: inputRate, output: outputRate } = PRICING[model];
  const tokenCost =
    (inputTokens / 1_000_000) * inputRate * 100 +
    (outputTokens / 1_000_000) * outputRate * 100;
  const searchCost = webSearchRequests * BRAVE_SEARCH_COST_CENTS;
  return Math.ceil((tokenCost + searchCost) * MARGIN_MULTIPLIER);
}

export async function grantCredits(
  userId: string,
  cents: number,
): Promise<number> {
  const rows = await sql`
    INSERT INTO user_credits (clerk_user_id, balance_cents, updated_at)
    VALUES (${userId}, ${cents}, now())
    ON CONFLICT (clerk_user_id) DO UPDATE
      SET balance_cents = user_credits.balance_cents + ${cents},
          updated_at    = now()
    RETURNING balance_cents
  `;

  await sql`
    INSERT INTO credit_transactions (clerk_user_id, amount_cents, type)
    VALUES (${userId}, ${cents}, 'free_grant')
  `;

  return rows[0].balance_cents as number;
}

export async function getCreditBalance(userId: string): Promise<number> {
  const rows = await sql`
    SELECT balance_cents FROM user_credits WHERE clerk_user_id = ${userId}
  `;
  return (rows[0]?.balance_cents as number | undefined) ?? 0;
}

export async function addCredits(
  userId: string,
  cents: number,
  stripeSessionId: string,
): Promise<number> {
  const rows = await sql`
    INSERT INTO user_credits (clerk_user_id, balance_cents, updated_at)
    VALUES (${userId}, ${cents}, now())
    ON CONFLICT (clerk_user_id) DO UPDATE
      SET balance_cents = user_credits.balance_cents + ${cents},
          updated_at    = now()
    RETURNING balance_cents
  `;

  await sql`
    INSERT INTO credit_transactions (clerk_user_id, amount_cents, type, stripe_session_id)
    VALUES (${userId}, ${cents}, 'purchase', ${stripeSessionId})
  `;

  return rows[0].balance_cents as number;
}

export type DeductExtras = {
  urlCount?: number;
  candidateCount?: number;
  durationMs?: number;
  codeExecutionCount?: number;
};

export async function deductCredits(
  userId: string,
  cents: number,
  curatorSessionId: string,
  inputTokens: number,
  outputTokens: number,
  webSearchRequests: number,
  stepLabel?: string,
  extras?: DeductExtras,
): Promise<number> {
  const rows = await sql`
    UPDATE user_credits
    SET balance_cents = GREATEST(0, balance_cents - ${cents}),
        updated_at    = now()
    WHERE clerk_user_id = ${userId}
    RETURNING balance_cents
  `;

  await sql`
    INSERT INTO credit_transactions
      (clerk_user_id, amount_cents, type, curator_session_id, input_tokens, output_tokens, web_search_requests, step_label,
       url_count, candidate_count, duration_ms, code_execution_count)
    VALUES
      (${userId}, ${-cents}, 'deduction', ${curatorSessionId}, ${inputTokens}, ${outputTokens}, ${webSearchRequests}, ${stepLabel ?? null},
       ${extras?.urlCount ?? null}, ${extras?.candidateCount ?? null}, ${extras?.durationMs ?? null}, ${extras?.codeExecutionCount ?? null})
  `;

  return (rows[0]?.balance_cents as number | undefined) ?? 0;
}
