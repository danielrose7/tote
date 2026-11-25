import type { QueryClient } from '@tanstack/react-query';
import { collectionQueryKeys } from '@/lib/collections/queryKeys';
import type {
  CollectionDetail,
  CollectionSummary,
} from '@/lib/collections/repository';

/**
 * The optimistic lifecycle every collection-scoped command shares: cancel
 * in-flight reads, snapshot, apply the command's cache update; on failure,
 * restore the snapshot and refetch.
 */

export type CollectionCacheUpdate = {
  detail?: (current: CollectionDetail) => CollectionDetail;
  summaries?: (current: CollectionSummary[]) => CollectionSummary[];
};

export type CacheSnapshot = {
  previousDetail: CollectionDetail | undefined;
  previousSummaries: CollectionSummary[] | undefined;
};

export async function applyOptimistic(
  queryClient: QueryClient,
  collectionId: string,
  buildUpdate: (detail: CollectionDetail | undefined) => CollectionCacheUpdate,
): Promise<CacheSnapshot> {
  const detailKey = collectionQueryKeys.detail(collectionId);
  await Promise.all([
    queryClient.cancelQueries({ queryKey: detailKey }),
    queryClient.cancelQueries({
      queryKey: collectionQueryKeys.all,
      exact: true,
    }),
  ]);
  const previousDetail = queryClient.getQueryData<CollectionDetail>(detailKey);
  const previousSummaries = queryClient.getQueryData<CollectionSummary[]>(
    collectionQueryKeys.all,
  );
  const { detail, summaries } = buildUpdate(previousDetail);
  if (detail) {
    queryClient.setQueryData<CollectionDetail>(detailKey, (current) =>
      current ? detail(current) : current,
    );
  }
  if (summaries) {
    queryClient.setQueryData<CollectionSummary[]>(
      collectionQueryKeys.all,
      (current) => (current ? summaries(current) : current),
    );
  }
  return { previousDetail, previousSummaries };
}

export function rollbackOptimistic(
  queryClient: QueryClient,
  collectionId: string,
  snapshot: CacheSnapshot | undefined,
) {
  const detailKey = collectionQueryKeys.detail(collectionId);
  if (snapshot) {
    queryClient.setQueryData(detailKey, snapshot.previousDetail);
    queryClient.setQueryData(
      collectionQueryKeys.all,
      snapshot.previousSummaries,
    );
  }
  // Other commands may have landed since the snapshot; refetch to be exact.
  void queryClient.invalidateQueries({ queryKey: detailKey });
  void queryClient.invalidateQueries({
    queryKey: collectionQueryKeys.all,
    exact: true,
  });
}
