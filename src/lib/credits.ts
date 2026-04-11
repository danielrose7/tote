/**
 * Credit balance helpers.
 *
 * Ledger lives in Neon Postgres:
 *   user_credits        — current balance per user (denormalized for fast reads)
 *   credit_transactions — immutable log of every grant and deduction
 *
 * Cost formula (Claude Sonnet 4.6 pricing, raw — no margin multiplier yet):
 *   $3.00 / 1M input tokens
 *   $15.00 / 1M output tokens
 *   $10.00 / 1K web search requests ($0.01/search)
 *
 * MARGIN_MULTIPLIER is set to 1 until real cost data is collected across enough
 * runs. Increase to 5 once instrumented. See docs/CURATOR_PRICING_STRATEGY.md.
 */

import { sql } from './db';

const MARGIN_MULTIPLIER = 1; // TODO: raise to ~5 after cost calibration

/** Total cost in cents for a curator run, including tokens and web searches. */
export function runCostCents(
  inputTokens: number,
  outputTokens: number,
  webSearchRequests: number,
): number {
  const tokenCost =
    (inputTokens / 1_000_000) * 300 + (outputTokens / 1_000_000) * 1500;
  const searchCost = webSearchRequests * 1; // $0.01/search = 1 cent
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

export async function deductCredits(
  userId: string,
  cents: number,
  curatorSessionId: string,
  inputTokens: number,
  outputTokens: number,
  webSearchRequests: number,
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
      (clerk_user_id, amount_cents, type, curator_session_id, input_tokens, output_tokens, web_search_requests)
    VALUES
      (${userId}, ${-cents}, 'deduction', ${curatorSessionId}, ${inputTokens}, ${outputTokens}, ${webSearchRequests})
  `;

  return (rows[0]?.balance_cents as number | undefined) ?? 0;
}
