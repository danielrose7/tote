import { NextResponse } from 'next/server';
import { inngest } from '../../../../inngest/client';
import { isCurator } from '../../../../inngest/curator-auth';

export async function POST(request: Request) {
  if (!(await isCurator())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { sessionId, questions, answers, mode } = await request.json();

  if (
    !sessionId ||
    !questions ||
    !Array.isArray(questions) ||
    !answers ||
    typeof answers !== 'object' ||
    !mode ||
    !['normal', 'debug'].includes(mode)
  ) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  await inngest.send({
    name: 'curation/answers',
    data: { sessionId, questions, answers, mode },
  });

  return NextResponse.json({ ok: true });
}
