/**
 * Curator session persistence helpers.
 *
 * State lives in the `state` JSONB column on `curator_sessions` in Neon Postgres.
 * Phase and result are persisted server-side at each transition — in-progress
 * state lives in the browser via Inngest Realtime.
 */

import { sql } from './db';
import type {
  CurationGap,
  CuratorPhase,
  InterviewQuestion,
  InterviewRound,
  QueryType,
} from '../inngest/types';

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
  phase: 'complete';
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
