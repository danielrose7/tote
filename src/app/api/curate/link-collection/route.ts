import { NextResponse } from 'next/server';
import { isCurator } from '../../../../inngest/curator-auth';
import { patchSession } from '../../../../lib/curatorSession';

export async function POST(request: Request) {
  if (!(await isCurator())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { sessionId, collectionId } = await request.json();

  if (
    typeof sessionId !== 'string' ||
    !sessionId.trim() ||
    typeof collectionId !== 'string' ||
    !collectionId.trim()
  ) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  await patchSession(sessionId, {
    collectionId,
    collectionImportedAt: new Date().toISOString(),
  });

  return NextResponse.json({ ok: true });
}
