import type { CollectionDetail, CollectionSummary } from "./repository";

async function fetchJson<T>(input: RequestInfo | URL): Promise<T> {
	const response = await fetch(input, {
		credentials: "same-origin",
	});
	if (!response.ok) {
		throw new Error(`Collection request failed with status ${response.status}`);
	}
	return response.json() as Promise<T>;
}

function hydrateCollectionSummary(
	collection: CollectionSummary,
): CollectionSummary {
	return {
		...collection,
		updatedAt: new Date(collection.updatedAt),
	};
}

export async function fetchCollectionSummaries(): Promise<CollectionSummary[]> {
	const response = await fetchJson<{ collections: CollectionSummary[] }>(
		"/api/v2/collections",
	);
	return response.collections.map(hydrateCollectionSummary);
}

export async function fetchCollectionDetail(
	collectionId: string,
): Promise<CollectionDetail> {
	const detail = await fetchJson<CollectionDetail>(
		`/api/v2/collections/${collectionId}`,
	);
	return {
		...detail,
		collection: {
			...detail.collection,
			createdAt: new Date(detail.collection.createdAt),
			updatedAt: new Date(detail.collection.updatedAt),
			deletedAt: detail.collection.deletedAt
				? new Date(detail.collection.deletedAt)
				: null,
		},
		nodes: detail.nodes.map((node) => ({
			...node,
			createdAt: new Date(node.createdAt),
			updatedAt: new Date(node.updatedAt),
			deletedAt: node.deletedAt ? new Date(node.deletedAt) : null,
		})),
	};
}
