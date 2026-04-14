import { NextResponse } from 'next/server';
import { inngest } from '../../../../inngest/client';
import { isCurator } from '../../../../inngest/curator-auth';

export async function POST(request: Request) {
  if (!(await isCurator())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { sessionId, questions, answers } = await request.json();

  if (
    !sessionId ||
    !questions ||
    !Array.isArray(questions) ||
    !answers ||
    typeof answers !== 'object'
  ) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  await inngest.send({
    name: 'curation/answers',
    data: { sessionId, questions, answers, mode: 'normal' },
  });

  return NextResponse.json({ ok: true });
}
