import { CuratePageClient } from '../CuratePageClient';

export default async function CurateSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  return <CuratePageClient initialSessionId={sessionId} />;
}
