import type {
	PersistedClient,
	Persister,
} from "@tanstack/react-query-persist-client";
import { createStore, del, get, set } from "idb-keyval";

const collectionQueryStore = createStore(
	"tote-collections",
	"tanstack-query-cache",
);

export const collectionQueryCacheBuster = "neon-collections-v1";
export const collectionQueryCacheMaxAge = 24 * 60 * 60 * 1_000;

function accountCacheKey(userId: string): string {
	return `account:${userId}`;
}

export function createCollectionQueryPersister(userId: string): Persister {
	const key = accountCacheKey(userId);
	return {
		persistClient: (client) => set(key, client, collectionQueryStore),
		restoreClient: () => get<PersistedClient>(key, collectionQueryStore),
		removeClient: () => del(key, collectionQueryStore),
	};
}

export async function removeCollectionQueryCache(
	userId: string,
): Promise<void> {
	await del(accountCacheKey(userId), collectionQueryStore);
}
