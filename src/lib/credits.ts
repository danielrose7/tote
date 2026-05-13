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

import { sql } from "./db";
import { MODELS } from "./models";

const MARGIN_MULTIPLIER = 1; // TODO: raise to ~5 after cost calibration

// Token pricing in dollars per million tokens
const PRICING = {
	[MODELS.sonnet]: { input: 3.0, output: 15.0 },
	[MODELS.haiku]: { input: 0.8, output: 4.0 },
	[MODELS.geminiFlash]: { input: 0.3, output: 2.5 },
} as const;

type SupportedModel = keyof typeof PRICING;

function serializeCreatedAt(value: unknown): string {
	return value instanceof Date ? value.toISOString() : String(value);
}

const BRAVE_SEARCH_COST_CENTS = 0.5; // $5.00 / 1K requests
const ANTHROPIC_WEB_SEARCH_COST_CENTS = 1.0; // $10.00 / 1K requests
export const CF_PUPPETEER_COST_CENTS = 0.2; // $2.00 / 1K Browser Rendering sessions

/** Total cost in cents for a step, given model, tokens, web searches, and CF sessions. */
export function runCostCents(
	inputTokens: number,
	outputTokens: number,
	webSearchRequests: number,
	model: SupportedModel = MODELS.sonnet,
	anthropicWebSearchRequests = 0,
	cfSessions = 0,
): number {
	const { input: inputRate, output: outputRate } = PRICING[model];
	const tokenCost =
		(inputTokens / 1_000_000) * inputRate * 100 +
		(outputTokens / 1_000_000) * outputRate * 100;
	const searchCost = webSearchRequests * BRAVE_SEARCH_COST_CENTS;
	const anthropicSearchCost =
		anthropicWebSearchRequests * ANTHROPIC_WEB_SEARCH_COST_CENTS;
	const cfCost = cfSessions * CF_PUPPETEER_COST_CENTS;
	return Math.ceil(
		(tokenCost + searchCost + anthropicSearchCost + cfCost) * MARGIN_MULTIPLIER,
	);
}

export type CreditTransaction = {
	id: number;
	amountCents: number;
	type: "free_grant" | "purchase" | "deduction";
	feature: string;
	referenceId: string | null;
	stepLabel: string | null;
	inputTokens: number | null;
	outputTokens: number | null;
	webSearchRequests: number | null;
	urlCount: number | null;
	candidateCount: number | null;
	durationMs: number | null;
	codeExecutionCount: number | null;
	cfCount: number | null;
	geminiCount: number | null;
	failedCount: number | null;
	provider: string | null;
	model: string | null;
	balanceAfterCents: number | null;
	metadataJson: Record<string, unknown> | null;
	createdAt: string;
};

export async function getCreditTransactions(
	userId: string,
	limit = 20,
): Promise<CreditTransaction[]> {
	const rows = await sql`
    SELECT
      id,
      amount_cents,
      type,
      COALESCE(
        feature,
        CASE
          WHEN curator_session_id LIKE 'chat:%' THEN 'chat'
          WHEN type IN ('purchase', 'free_grant') THEN 'billing'
          ELSE 'curator'
        END
      ) AS feature,
      COALESCE(
        reference_id,
        CASE
          WHEN curator_session_id LIKE 'chat:%' THEN substring(curator_session_id from 6)
          ELSE curator_session_id
        END
      ) AS reference_id,
      step_label,
      input_tokens,
      output_tokens,
      web_search_requests,
      url_count,
      candidate_count,
      duration_ms,
      code_execution_count,
      cf_count,
      gemini_count,
      failed_count,
      provider,
      model,
      balance_after_cents,
      metadata_json,
      created_at
    FROM credit_transactions
    WHERE clerk_user_id = ${userId}
    ORDER BY created_at DESC, id DESC
    LIMIT ${limit}
  `;

	return rows.map((row) => ({
		id: row.id as number,
		amountCents: row.amount_cents as number,
		type: row.type as CreditTransaction["type"],
		feature: row.feature as string,
		referenceId: (row.reference_id as string | null) ?? null,
		stepLabel: (row.step_label as string | null) ?? null,
		inputTokens: (row.input_tokens as number | null) ?? null,
		outputTokens: (row.output_tokens as number | null) ?? null,
		webSearchRequests: (row.web_search_requests as number | null) ?? null,
		urlCount: (row.url_count as number | null) ?? null,
		candidateCount: (row.candidate_count as number | null) ?? null,
		durationMs: (row.duration_ms as number | null) ?? null,
		codeExecutionCount: (row.code_execution_count as number | null) ?? null,
		cfCount: (row.cf_count as number | null) ?? null,
		geminiCount: (row.gemini_count as number | null) ?? null,
		failedCount: (row.failed_count as number | null) ?? null,
		provider: (row.provider as string | null) ?? null,
		model: (row.model as string | null) ?? null,
		balanceAfterCents: (row.balance_after_cents as number | null) ?? null,
		metadataJson: (row.metadata_json as Record<string, unknown> | null) ?? null,
		createdAt: serializeCreatedAt(row.created_at),
	}));
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

	const balanceCents = rows[0].balance_cents as number;

	await sql`
    INSERT INTO credit_transactions (clerk_user_id, amount_cents, type, feature, balance_after_cents)
    VALUES (${userId}, ${cents}, 'free_grant', 'billing', ${balanceCents})
  `;

	return balanceCents;
}

export async function getCreditBalance(userId: string): Promise<number> {
	const rows = await sql`
    SELECT balance_cents FROM user_credits WHERE clerk_user_id = ${userId}
  `;
	return (rows[0]?.balance_cents as number | undefined) ?? 0;
}

export async function hasPositiveCreditBalance(
	userId: string,
): Promise<boolean> {
	return (await getCreditBalance(userId)) > 0;
}

export async function addCredits(
	userId: string,
	cents: number,
	stripeSessionId: string,
): Promise<number> {
	const rows = await sql`
    WITH inserted_tx AS (
      INSERT INTO credit_transactions (clerk_user_id, amount_cents, type, stripe_session_id, feature)
      VALUES (${userId}, ${cents}, 'purchase', ${stripeSessionId}, 'billing')
      ON CONFLICT (stripe_session_id) WHERE stripe_session_id IS NOT NULL DO NOTHING
      RETURNING id, amount_cents
    ),
    updated_balance AS (
      INSERT INTO user_credits (clerk_user_id, balance_cents, updated_at)
      SELECT ${userId}, amount_cents, now()
      FROM inserted_tx
      ON CONFLICT (clerk_user_id) DO UPDATE
        SET balance_cents = user_credits.balance_cents + EXCLUDED.balance_cents,
            updated_at    = now()
      RETURNING balance_cents
    ),
    marked_tx AS (
      UPDATE credit_transactions
      SET balance_after_cents = (SELECT balance_cents FROM updated_balance)
      WHERE id IN (SELECT id FROM inserted_tx)
      RETURNING id
    )
    SELECT balance_cents FROM updated_balance
    UNION ALL
    SELECT balance_cents
    FROM user_credits
    WHERE clerk_user_id = ${userId}
      AND NOT EXISTS (SELECT 1 FROM updated_balance)
    LIMIT 1
  `;

	return (rows[0]?.balance_cents as number | undefined) ?? 0;
}

export type DeductExtras = {
	urlCount?: number;
	candidateCount?: number;
	durationMs?: number;
	codeExecutionCount?: number;
	cfCount?: number;
	geminiCount?: number;
	failedCount?: number;
	provider?: string;
	model?: string;
	feature?: string;
	referenceId?: string;
	metadata?: Record<string, unknown>;
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
	const feature =
		extras?.feature ??
		(curatorSessionId.startsWith("chat:") ? "chat" : "curator");
	const referenceId =
		extras?.referenceId ??
		(curatorSessionId.startsWith("chat:")
			? curatorSessionId.slice("chat:".length)
			: curatorSessionId);

	const rows = await sql`
    UPDATE user_credits
    SET balance_cents = GREATEST(0, balance_cents - ${cents}),
        updated_at    = now()
    WHERE clerk_user_id = ${userId}
    RETURNING balance_cents
  `;

	const balanceAfterCents = (rows[0]?.balance_cents as number | undefined) ?? 0;

	await sql`
    INSERT INTO credit_transactions
      (clerk_user_id, amount_cents, type, curator_session_id, input_tokens, output_tokens, web_search_requests, step_label,
       url_count, candidate_count, duration_ms, code_execution_count, provider, model, feature, reference_id, balance_after_cents,
       metadata_json, cf_count, gemini_count, failed_count)
    VALUES
      (${userId}, ${-cents}, 'deduction', ${curatorSessionId}, ${inputTokens}, ${outputTokens}, ${webSearchRequests}, ${stepLabel ?? null},
       ${extras?.urlCount ?? null}, ${extras?.candidateCount ?? null}, ${extras?.durationMs ?? null}, ${extras?.codeExecutionCount ?? null},
       ${extras?.provider ?? null}, ${extras?.model ?? null}, ${feature}, ${referenceId}, ${balanceAfterCents},
       ${extras?.metadata ? JSON.stringify(extras.metadata) : null}::jsonb, ${extras?.cfCount ?? null}, ${extras?.geminiCount ?? null}, ${extras?.failedCount ?? null})
  `;

	return balanceAfterCents;
}
