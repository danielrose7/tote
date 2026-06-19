import { auth } from '@clerk/nextjs/server';
import { Rest } from 'ably';
import { NextResponse } from 'next/server';
import {
  canUseNeonCollections,
  neonCollectionsApiEnabled,
} from '@/lib/collections/api';
import { collectionRealtimeCapabilities } from '@/lib/collections/realtime';
import {
  getAccountCollectionDataSource,
  listCollectionSummaries,
} from '@/lib/collections/repository';

export async function POST() {
  if (!neonCollectionsApiEnabled() || !process.env.ABLY_ROOT_KEY) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const dataSource = await getAccountCollectionDataSource(userId);
  if (!canUseNeonCollections(dataSource)) {
    return NextResponse.json(
      { error: 'Neon collections are not enabled', dataSource },
      { status: 409 },
    );
  }

  const summaries = await listCollectionSummaries(userId);
  const capability = collectionRealtimeCapabilities(
    userId,
    summaries.map((collection) => collection.id),
  );
  const token = await new Rest(process.env.ABLY_ROOT_KEY).auth.requestToken({
    clientId: userId,
    capability: JSON.stringify(capability),
    ttl: 10 * 60 * 1_000,
  });
  return NextResponse.json(token);
}
