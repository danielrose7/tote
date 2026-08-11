import { auth } from '@clerk/nextjs/server';
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query';
import { redirect } from 'next/navigation';
import { collectionQueryKeys } from '@/lib/collections/queryKeys';
import { listCollectionSummaries } from '@/lib/collections/repository';
import { NeonCollectionsPage } from './NeonCollectionsPage';

export default async function CollectionsPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect('/');
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
