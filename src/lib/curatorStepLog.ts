import { sql } from './db';

export interface StepLogEntry {
  id: number;
  session_id: string;
  step_name: string;
  status: string;
  data: unknown;
  ts: string;
}

export interface ProgressEntry {
  step: string;
  message: string;
  detail?: string;
  ts: number;
}

export async function logStep(
  sessionId: string,
  stepName: string,
  status: 'started' | 'completed' | 'failed',
  data?: unknown,
): Promise<void> {
  try {
    await sql`
      INSERT INTO curator_step_log (session_id, step_name, status, data)
      VALUES (
        ${sessionId},
        ${stepName},
        ${status},
        ${data !== undefined ? JSON.stringify(data) : null}
      )
    `;
  } catch {
    // best-effort — don't let logging failures break the curator
  }
}

export async function logProgressEvent(
  sessionId: string,
  entry: ProgressEntry,
): Promise<void> {
  try {
    await sql`
      INSERT INTO curator_step_log (session_id, step_name, status, data)
      VALUES (
        ${sessionId},
        ${entry.step},
        'progress',
        ${JSON.stringify({ message: entry.message, detail: entry.detail, ts: entry.ts })}
      )
    `;
  } catch {
    // best-effort
  }
}

export async function getProgressLog(
  sessionId: string,
): Promise<ProgressEntry[]> {
  const rows = await sql`
    SELECT step_name, data
    FROM curator_step_log
    WHERE session_id = ${sessionId}
      AND status = 'progress'
    ORDER BY id ASC
  `;
  return rows.map((r) => {
    const d = r.data as { message: string; detail?: string; ts: number };
    return {
      step: r.step_name as string,
      message: d.message,
      detail: d.detail,
      ts: d.ts,
    };
  });
}

export async function getStepLog(sessionId: string): Promise<StepLogEntry[]> {
  const rows = await sql`
    SELECT id, session_id, step_name, status, data, ts
    FROM curator_step_log
    WHERE session_id = ${sessionId}
    ORDER BY ts ASC
  `;
  return rows as StepLogEntry[];
}
