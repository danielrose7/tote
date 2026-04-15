import { NextResponse } from 'next/server';
import { isCurator } from '../../../../../inngest/curator-auth';
import { readSession } from '../../../../../lib/curatorSession';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  if (!(await isCurator())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { sessionId } = await params;
  const session = await readSession(sessionId);

  return NextResponse.json({
    phase: session?.phase ?? null,
    topic: session?.topic ?? null,
    questions: session?.questions ?? null,
    questionRound: session?.questionRound ?? null,
    answers: session?.answers ?? null,
    researchBriefJson: session?.researchBriefJson ?? null,
    framingBriefJson: session?.framingBriefJson ?? null,
    refinementPass: session?.refinementPass ?? null,
    result:
      session?.phase === 'complete'
        ? {
            title: session.title,
            sectionCount: session.sectionCount,
            itemCount: session.itemCount,
            json: session.json,
          }
        : null,
    urlSections: session?.urlSections ?? null,
    extractedSlugs: session?.extractedSlugs ?? null,
    tokenUsage: session?.tokenUsage ?? null,
    refinementUrlSections: session?.refinementUrlSections ?? null,
  });
}
