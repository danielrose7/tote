import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { isCurator } from '../../../../inngest/curator-auth';
import { listCuratorSessions } from '../../../../lib/curatorSessionsDb';

export async function GET() {
  if (!(await isCurator())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sessions = await listCuratorSessions(userId);
  return NextResponse.json(sessions);
}
