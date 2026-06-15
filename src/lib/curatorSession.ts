/**
 * Curator session persistence helpers.
 *
 * State lives in the `state` JSONB column on `curator_sessions` in Neon Postgres.
 * Phase and result are persisted server-side at each transition — in-progress
 * state lives in the browser via Inngest Realtime.
 */

import type {
	CurationGap,
	CuratorPhase,
	InterviewQuestion,
	InterviewRound,
	QueryType,
} from "../inngest/types";
import { sql } from "./db";

export interface TokenUsage {
	inputTokens: number;
	outputTokens: number;
	webSearchRequests: number;
}

export interface CuratorSessionData {
	phase?: CuratorPhase;
	topic?: string;
	title?: string;
	sectionCount?: number;
	itemCount?: number;
	json?: string;
	urlSections?: { title: string; slug: string; urls: string[] }[];
	tokenUsage?: TokenUsage;
	questions?: InterviewQuestion[];
	questionRound?: InterviewRound;
	answers?: Record<string, string>;
	answerRounds?: Partial<Record<InterviewRound, Record<string, string>>>;
	researchBriefJson?: string;
	marketLandscapeJson?: string;
	framingBriefJson?: string;
	extractedSlugs?: string[];
	refinementPass?: number;
	gaps?: CurationGap[];
	refinementUrlSections?: { title: string; slug: string; urls: string[] }[];
	lastProgressMessage?: string;
	queryType?: QueryType;
	collectionId?: string;
	collectionImportedAt?: string;
}

export interface CuratorSessionResult extends CuratorSessionData {
	phase: "complete";
	title: string;
	sectionCount: number;
	itemCount: number;
	json: string;
}

export async function readSession(
	sessionId: string,
): Promise<CuratorSessionData | null> {
	const rows = await sql`
    SELECT state FROM curator_sessions WHERE session_id = ${sessionId}
  `;
	const state = rows[0]?.state as CuratorSessionData | null | undefined;
	return state ?? null;
}

export async function patchSession(
	sessionId: string,
	patch: Partial<CuratorSessionData>,
): Promise<void> {
	await sql`
    UPDATE curator_sessions
    SET state = COALESCE(state, '{}'::jsonb) || ${JSON.stringify(patch)}::jsonb
    WHERE session_id = ${sessionId}
  `;
}

export async function persistSubmittedAnswers(
	sessionId: string,
	round: InterviewRound,
	answers: Record<string, string>,
): Promise<void> {
	const session = await readSession(sessionId);
	const answerRounds = {
		...(session?.answerRounds ?? {}),
		[round]: answers,
	};
	const mergedAnswers =
		round === 1 ? answers : { ...(session?.answers ?? {}), ...answers };

	await patchSession(sessionId, {
		answerRounds,
		answers: mergedAnswers,
		phase: round === 1 ? "researching" : "framing",
		lastProgressMessage:
			round === 1
				? "Round 1 answers received. Researching the category..."
				: "Round 2 answers received. Building curatorial brief...",
	});
}

export async function writeSession(
	sessionId: string,
	result: CuratorSessionResult,
): Promise<void> {
	await sql`
    UPDATE curator_sessions
    SET state = ${JSON.stringify(result)}::jsonb
    WHERE session_id = ${sessionId}
  `;
}
