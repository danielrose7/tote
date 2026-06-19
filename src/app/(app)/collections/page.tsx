import { auth } from '@clerk/nextjs/server';
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query';
import { redirect } from 'next/navigation';
import { Header } from '@/components/Header';
import { canUseNeonCollections } from '@/lib/collections/api';
import { getCollectionMigrationStatus } from '@/lib/collections/migrationRepository';
import { collectionQueryKeys } from '@/lib/collections/queryKeys';
import {
  getAccountCollectionDataSource,
  listCollectionSummaries,
} from '@/lib/collections/repository';
import { db } from '@/lib/db';
import { ClassicCollectionsPage } from './ClassicCollectionsPage';
import { ClassicMigrationCoordinator } from './ClassicMigrationCoordinator';
import { NeonCollectionsPage } from './NeonCollectionsPage';

export default async function CollectionsPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect('/');
  }

  const dataSource = await getAccountCollectionDataSource(userId);
  if (dataSource === 'neon_verifying') {
    const status = await getCollectionMigrationStatus(userId, db);
    return (
      <>
        <Header />
        <ClassicMigrationCoordinator
          initialReady={{
            collectionCount: status.collectionCount ?? 0,
            itemCount: status.itemCount ?? 0,
          }}
        />
      </>
    );
  }
  if (!canUseNeonCollections(dataSource)) {
    return <ClassicCollectionsPage />;
  }

  const collections = await listCollectionSummaries(userId);
  const queryClient = new QueryClient();
  queryClient.setQueryData(collectionQueryKeys.all, collections);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <NeonCollectionsPage
        realtimeEnabled={Boolean(process.env.ABLY_ROOT_KEY)}
      />
    </HydrationBoundary>
  );
}
