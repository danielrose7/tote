import type { CollectionSummary } from "./repository";

export type ClassicSharedCollectionReference = {
	collectionId: string;
	name: string | null;
	role: "reader" | "writer" | "admin";
};

type JazzSharedReference = {
	$isLoaded?: boolean;
	collectionId?: unknown;
	name?: unknown;
	role?: unknown;
};

function loadedReferences(value: unknown): JazzSharedReference[] {
	if (!value || typeof value !== "object") return [];
	try {
		return Array.from(value as Iterable<unknown>).filter(
			(reference): reference is JazzSharedReference =>
				Boolean(reference) &&
				typeof reference === "object" &&
				(reference as JazzSharedReference).$isLoaded === true,
		);
	} catch {
		return [];
	}
}

export function getWaitingClassicSharedCollections(
	sharedWithMe: unknown,
	collections: CollectionSummary[],
): ClassicSharedCollectionReference[] {
	const migratedLegacyIds = new Set(
		collections.flatMap((collection) =>
			collection.legacyJazzId ? [collection.legacyJazzId] : [],
		),
	);

	return loadedReferences(sharedWithMe).flatMap((reference) => {
		if (
			typeof reference.collectionId !== "string" ||
			migratedLegacyIds.has(reference.collectionId) ||
			!["reader", "writer", "admin"].includes(String(reference.role))
		) {
			return [];
		}
		return [
			{
				collectionId: reference.collectionId,
				name: typeof reference.name === "string" ? reference.name : null,
				role: reference.role as "reader" | "writer" | "admin",
			},
		];
	});
}
