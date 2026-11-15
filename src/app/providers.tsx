'use client';

import { ClerkProvider, useAuth } from '@clerk/nextjs';
import {
  defaultShouldDehydrateMutation,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from '@/i18n/client';
import { CollectionSyncCoordinator } from '../components/CollectionSyncCoordinator';
import { IosAppBanner } from '../components/IosAppBanner/IosAppBanner';
import { MaintenanceBanner } from '../components/MaintenanceBanner/MaintenanceBanner';
import { OfflineBanner } from '../components/OfflineBanner';
import { ToastProvider } from '../components/ToastNotification';
import {
  CollectionRequestError,
  createCollectionInviteMutation,
  createCollectionMutation,
  createCollectionNodeMutation,
  deleteCollectionMutation,
  deleteCollectionNodeMutation,
  publishCollectionMutation,
  removeCollectionMemberMutation,
  reorderCollectionNodesMutation,
  revokeCollectionInviteMutation,
  transferCollectionOwnershipMutation,
  unpublishCollectionMutation,
  updateCollectionMemberMutation,
  updateCollectionMutation,
  updateCollectionNodeMutation,
} from '../lib/collections/client';
import {
  collectionMutationKeys,
  collectionQueryKeys,
} from '../lib/collections/queryKeys';
import {
  collectionQueryCacheBuster,
  collectionQueryCacheMaxAge,
  createCollectionQueryPersister,
  removeCollectionQueryCache,
} from '../lib/collections/queryPersistence';

function AccountQueryProvider({
  children,
  userId,
}: {
  children: React.ReactNode;
  userId: string | null;
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            gcTime: collectionQueryCacheMaxAge,
            staleTime: 30_000,
          },
          mutations: {
            networkMode: 'online',
            retry: (failureCount, error) => {
              if (error instanceof CollectionRequestError) {
                const nonRetryable = [400, 401, 403, 404, 409];
                if (nonRetryable.includes(error.status)) return false;
              }
              return failureCount < 3;
            },
            retryDelay: (attemptIndex) => 2000 * 2 ** attemptIndex,
          },
        },
      }),
  );
  queryClient.setMutationDefaults(collectionMutationKeys.create, {
    mutationFn: createCollectionMutation,
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: collectionQueryKeys.all }),
  });
  queryClient.setMutationDefaults(collectionMutationKeys.update, {
    mutationFn: updateCollectionMutation,
    onSettled: (_data, _error, variables) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: collectionQueryKeys.all }),
        queryClient.invalidateQueries({
          queryKey: collectionQueryKeys.detail(variables.collectionId),
        }),
      ]),
  });
  queryClient.setMutationDefaults(collectionMutationKeys.delete, {
    mutationFn: deleteCollectionMutation,
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: collectionQueryKeys.all }),
  });
  const invalidateCollectionNodeQueries = (collectionId: string) =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: collectionQueryKeys.all }),
      queryClient.invalidateQueries({
        queryKey: collectionQueryKeys.detail(collectionId),
      }),
    ]);
  queryClient.setMutationDefaults(collectionMutationKeys.createNode, {
    mutationFn: createCollectionNodeMutation,
    onSettled: (_data, _error, variables) =>
      invalidateCollectionNodeQueries(variables.collectionId),
  });
  queryClient.setMutationDefaults(collectionMutationKeys.updateNode, {
    mutationFn: updateCollectionNodeMutation,
    onSettled: (_data, _error, variables) =>
      invalidateCollectionNodeQueries(variables.collectionId),
  });
  queryClient.setMutationDefaults(collectionMutationKeys.deleteNode, {
    mutationFn: deleteCollectionNodeMutation,
    onSettled: (_data, _error, variables) =>
      invalidateCollectionNodeQueries(variables.collectionId),
  });
  queryClient.setMutationDefaults(collectionMutationKeys.reorderNodes, {
    mutationFn: reorderCollectionNodesMutation,
    onSettled: (_data, _error, variables) =>
      invalidateCollectionNodeQueries(variables.collectionId),
  });
  const invalidateCollectionTeam = (collectionId: string) =>
    queryClient.invalidateQueries({
      queryKey: collectionQueryKeys.team(collectionId),
    });
  queryClient.setMutationDefaults(collectionMutationKeys.createInvite, {
    mutationFn: createCollectionInviteMutation,
    onSettled: (_data, _error, variables) =>
      invalidateCollectionTeam(variables.collectionId),
  });
  queryClient.setMutationDefaults(collectionMutationKeys.revokeInvite, {
    mutationFn: revokeCollectionInviteMutation,
    onSettled: (_data, _error, variables) =>
      invalidateCollectionTeam(variables.collectionId),
  });
  queryClient.setMutationDefaults(collectionMutationKeys.updateMember, {
    mutationFn: updateCollectionMemberMutation,
    onSettled: (_data, _error, variables) =>
      invalidateCollectionTeam(variables.collectionId),
  });
  queryClient.setMutationDefaults(collectionMutationKeys.removeMember, {
    mutationFn: removeCollectionMemberMutation,
    onSettled: (_data, _error, variables) =>
      invalidateCollectionTeam(variables.collectionId),
  });
  queryClient.setMutationDefaults(collectionMutationKeys.transferOwnership, {
    mutationFn: transferCollectionOwnershipMutation,
    onSettled: (_data, _error, variables) =>
      Promise.all([
        invalidateCollectionTeam(variables.collectionId),
        queryClient.invalidateQueries({ queryKey: collectionQueryKeys.all }),
        queryClient.invalidateQueries({
          queryKey: collectionQueryKeys.detail(variables.collectionId),
        }),
      ]),
  });
  const invalidatePublication = (collectionId: string) =>
    queryClient.invalidateQueries({
      queryKey: collectionQueryKeys.publication(collectionId),
    });
  queryClient.setMutationDefaults(collectionMutationKeys.publish, {
    mutationFn: publishCollectionMutation,
    onSettled: (_data, _error, variables) =>
      invalidatePublication(variables.collectionId),
  });
  queryClient.setMutationDefaults(collectionMutationKeys.unpublish, {
    mutationFn: unpublishCollectionMutation,
    onSettled: (_data, _error, variables) =>
      invalidatePublication(variables.collectionId),
  });
  const [persister] = useState(() =>
    userId ? createCollectionQueryPersister(userId) : null,
  );

  if (!persister) {
    return (
      <QueryClientProvider client={queryClient}>
        {userId && <CollectionSyncCoordinator userId={userId} />}
        {children}
      </QueryClientProvider>
    );
  }
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        buster: collectionQueryCacheBuster,
        maxAge: collectionQueryCacheMaxAge,
        dehydrateOptions: {
          shouldDehydrateMutation: defaultShouldDehydrateMutation,
          shouldDehydrateQuery: (query) => query.queryKey[0] === 'collections',
        },
      }}
      onSuccess={() => queryClient.resumePausedMutations()}
    >
      <CollectionSyncCoordinator userId={userId} />
      {children}
    </PersistQueryClientProvider>
  );
}

function CollectionQueryProvider({ children }: { children: React.ReactNode }) {
  const { userId } = useAuth();
  const previousUserId = useRef<string | null>(null);

  useEffect(() => {
    const previous = previousUserId.current;
    previousUserId.current = userId;
    if (previous && previous !== userId) {
      void removeCollectionQueryCache(previous);
    }
  }, [userId]);

  return (
    <AccountQueryProvider key={userId ?? 'unauthenticated'} userId={userId}>
      {children}
    </AccountQueryProvider>
  );
}

type ClerkLocalization = React.ComponentProps<
  typeof ClerkProvider
>['localization'];

/**
 * Clerk's own UI (sign-in, profile) ships its own translations. Load only the
 * active language's file, and only when it isn't English, so English users pay
 * nothing. Until it arrives Clerk renders in English.
 */
function useClerkLocalization(language: string): ClerkLocalization {
  const [localization, setLocalization] = useState<{
    language: string;
    value: ClerkLocalization;
  } | null>(null);
  useEffect(() => {
    if (language !== 'es') return;
    let cancelled = false;
    import('@clerk/localizations')
      .then(({ esMX }) => {
        // Type-only skew: @clerk/localizations targets a newer @clerk/shared.
        if (!cancelled)
          setLocalization({ language, value: esMX as ClerkLocalization });
      })
      .catch((error: unknown) => {
        console.error('Could not load Clerk translations', error);
      });
    return () => {
      cancelled = true;
    };
  }, [language]);
  return localization?.language === language ? localization.value : undefined;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const { i18n } = useTranslation();
  const localization = useClerkLocalization(i18n.language);
  return (
    <ClerkProvider localization={localization}>
      <CollectionQueryProvider>
        <ToastProvider>
          <MaintenanceBanner />
          <OfflineBanner />
          <IosAppBanner />
          {children}
        </ToastProvider>
      </CollectionQueryProvider>
    </ClerkProvider>
  );
}
