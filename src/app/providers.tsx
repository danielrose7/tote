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
import { OfflineBanner } from "../components/OfflineBanner";
import { ToastProvider } from "../components/ToastNotification";
import { createCollectionMutation } from "../lib/collections/client";
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
					},
				},
			}),
	);
	queryClient.setMutationDefaults(collectionMutationKeys.create, {
		mutationFn: createCollectionMutation,
		onSettled: () =>
			queryClient.invalidateQueries({ queryKey: collectionQueryKeys.all }),
	});
	const [persister] = useState(() =>
		userId ? createCollectionQueryPersister(userId) : null,
	);

	if (!persister) {
		return (
			<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
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
