"use client";

import { ClerkProvider, useAuth, useClerk } from "@clerk/nextjs";
import {
	defaultShouldDehydrateMutation,
	QueryClient,
	QueryClientProvider,
} from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { JazzInspector } from "jazz-tools/inspector";
import { JazzReactProviderWithClerk } from "jazz-tools/react";
import { useEffect, useRef, useState } from "react";
import { apiKey } from "../apiKey";
import { CollectionSyncCoordinator } from "../components/CollectionSyncCoordinator";
import { MaintenanceBanner } from "../components/MaintenanceBanner/MaintenanceBanner";
import { OfflineBanner } from "../components/OfflineBanner";
import { ToastProvider } from "../components/ToastNotification";
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
} from "../lib/collections/client";
import {
	collectionMutationKeys,
	collectionQueryKeys,
} from "../lib/collections/queryKeys";
import {
	collectionQueryCacheBuster,
	collectionQueryCacheMaxAge,
	createCollectionQueryPersister,
	removeCollectionQueryCache,
} from "../lib/collections/queryPersistence";
import { JazzAccount } from "../schema";

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
						networkMode: "online",
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
					shouldDehydrateQuery: (query) => query.queryKey[0] === "collections",
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
		<AccountQueryProvider key={userId ?? "unauthenticated"} userId={userId}>
			{children}
		</AccountQueryProvider>
	);
}

function JazzProvider({ children }: { children: React.ReactNode }) {
	const clerk = useClerk();
	const { userId } = useAuth();

	return (
		<JazzReactProviderWithClerk
			key={userId ?? "unauthenticated"}
			clerk={clerk}
			AccountSchema={JazzAccount}
			sync={{
				peer: `wss://cloud.jazz.tools/?key=${apiKey}`,
			}}
		>
			<ToastProvider>
				<MaintenanceBanner />
				<OfflineBanner />
				{children}
				{process.env.NODE_ENV === "development" && <JazzInspector />}
			</ToastProvider>
		</JazzReactProviderWithClerk>
	);
}

export function Providers({ children }: { children: React.ReactNode }) {
	return (
		<ClerkProvider>
			<CollectionQueryProvider>
				<JazzProvider>{children}</JazzProvider>
			</CollectionQueryProvider>
		</ClerkProvider>
	);
}
