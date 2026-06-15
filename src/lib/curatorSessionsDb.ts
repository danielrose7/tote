import { sql } from "./db";

export interface CuratorSessionRow {
	sessionId: string;
	topic: string;
	phase: string;
	createdAt: Date;
	title: string | null;
	sectionCount: number | null;
	itemCount: number | null;
	inputTokens: number | null;
	outputTokens: number | null;
	webSearchRequests: number | null;
}

export async function listCuratorSessions(
	clerkUserId: string,
): Promise<CuratorSessionRow[]> {
	const rows = await sql`
    SELECT
      session_id,
      topic,
      COALESCE(phase, 'started') AS phase,
      created_at,
      state->>'title' AS title,
      section_count,
      item_count,
      COALESCE((state->'tokenUsage'->>'inputTokens')::int,  input_tokens)        AS input_tokens,
      COALESCE((state->'tokenUsage'->>'outputTokens')::int, output_tokens)       AS output_tokens,
      COALESCE((state->'tokenUsage'->>'webSearchRequests')::int, web_search_requests) AS web_search_requests
    FROM curator_sessions
    WHERE clerk_user_id = ${clerkUserId}
    ORDER BY created_at DESC
  `;
	return rows.map((r) => ({
		sessionId: r.session_id as string,
		topic: r.topic as string,
		phase: r.phase as string,
		createdAt: r.created_at as Date,
		title: (r.title as string | null) ?? null,
		sectionCount: (r.section_count as number | null) ?? null,
		itemCount: (r.item_count as number | null) ?? null,
		inputTokens: (r.input_tokens as number | null) ?? null,
		outputTokens: (r.output_tokens as number | null) ?? null,
		webSearchRequests: (r.web_search_requests as number | null) ?? null,
	}));
}

export async function createCuratorSession(
	sessionId: string,
	clerkUserId: string,
	topic: string,
): Promise<void> {
	await sql`
    INSERT INTO curator_sessions (session_id, clerk_user_id, topic)
    VALUES (${sessionId}, ${clerkUserId}, ${topic})
    ON CONFLICT (session_id) DO NOTHING
  `;
}

export async function completeCuratorSession(
	sessionId: string,
	data: {
		mode: string;
		model: string;
		phase: string;
		sectionCount: number;
		itemCount: number;
	},
): Promise<void> {
	await sql`
    UPDATE curator_sessions
    SET
      mode          = ${data.mode},
      model         = ${data.model},
      phase         = ${data.phase},
      section_count = ${data.sectionCount},
      item_count    = ${data.itemCount},
      completed_at  = now()
    WHERE session_id = ${sessionId}
  `;
}

export async function failCuratorSession(sessionId: string): Promise<void> {
	await sql`
    UPDATE curator_sessions
    SET phase = 'error', completed_at = now()
    WHERE session_id = ${sessionId}
  `;
}
