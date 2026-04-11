import { NextResponse } from 'next/server';
import { inngest } from '../../../../inngest/client';
import { isCurator } from '../../../../inngest/curator-auth';
import type { CurationExtractionsEvent } from '../../../../inngest/types';

export async function POST(request: Request) {
  if (!(await isCurator())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { sessionId, sections } = await request.json();

  if (!sessionId || !Array.isArray(sections)) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  await inngest.send({
    name: 'curation/extractions' as CurationExtractionsEvent['name'],
    data: { sessionId, sections },
  });

  return NextResponse.json({ ok: true });
}
