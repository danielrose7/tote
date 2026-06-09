import type {
	PersistedClient,
	Persister,
} from "@tanstack/react-query-persist-client";
import { createStore, del, get, set } from "idb-keyval";

const collectionQueryStore = createStore(
	"tote-collections",
	"tanstack-query-cache",
);
const collectionSyncIssueStore = createStore("tote-collections", "sync-issues");

export const collectionQueryCacheBuster = "neon-collections-v1";
export const collectionQueryCacheMaxAge = 24 * 60 * 60 * 1_000;

function accountCacheKey(userId: string): string {
	return `account:${userId}`;
}

function accountSyncIssueKey(userId: string): string {
	return `issues:${userId}`;
}

export type CollectionSyncIssue = {
	id: string;
	operation: string;
	message: string;
	createdAt: string;
};

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
	await Promise.all([
		del(accountCacheKey(userId), collectionQueryStore),
		del(accountSyncIssueKey(userId), collectionSyncIssueStore),
	]);
}

export async function getCollectionSyncIssues(
	userId: string,
): Promise<CollectionSyncIssue[]> {
	return (
		(await get<CollectionSyncIssue[]>(
			accountSyncIssueKey(userId),
			collectionSyncIssueStore,
		)) ?? []
	);
}

export async function recordCollectionSyncIssue(
	userId: string,
	issue: CollectionSyncIssue,
): Promise<void> {
	const issues = await getCollectionSyncIssues(userId);
	const nextIssues = [
		issue,
		...issues.filter((existing) => existing.id !== issue.id),
	].slice(0, 20);
	await set(accountSyncIssueKey(userId), nextIssues, collectionSyncIssueStore);
}

export async function dismissCollectionSyncIssue(
	userId: string,
	issueId: string,
): Promise<void> {
	const issues = await getCollectionSyncIssues(userId);
	await set(
		accountSyncIssueKey(userId),
		issues.filter((issue) => issue.id !== issueId),
		collectionSyncIssueStore,
	);
}
