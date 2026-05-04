import { sql } from './db';

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
