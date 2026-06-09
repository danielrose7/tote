export type ClassicMigrationNode = {
	legacyJazzId: string;
	parentLegacyJazzId: string | null;
	type: "section" | "product" | "link" | "photo" | "note" | "text";
	title: string | null;
	properties: Record<string, unknown>;
	positionKey: string;
};

export type ClassicMigrationMember = {
	userId: string;
	role: "admin" | "editor" | "viewer";
};

export type ClassicMigrationCollection = {
	legacyJazzId: string;
	name: string;
	description: string | null;
	color: string | null;
	budgetCents: number | null;
	defaultViewMode: "grid" | "table" | null;
	publicLayout: "minimal" | "feature";
	copyPolicy: "disabled" | "members" | "public";
	positionKey: string;
	members?: ClassicMigrationMember[];
	nodes: ClassicMigrationNode[];
};

function canonicalize(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(canonicalize);
	if (value && typeof value === "object") {
		return Object.fromEntries(
			Object.entries(value as Record<string, unknown>)
				.sort(([left], [right]) => left.localeCompare(right))
				.map(([key, entryValue]) => [key, canonicalize(entryValue)]),
		);
	}
	return value;
}

export function normalizeClassicMigrationCollections(
	collectionsToNormalize: ClassicMigrationCollection[],
) {
	return collectionsToNormalize
		.map((collection) => ({
			...collection,
			members: [...(collection.members ?? [])].sort(
				(left, right) =>
					left.userId.localeCompare(right.userId) ||
					left.role.localeCompare(right.role),
			),
			nodes: [...collection.nodes].sort((left, right) => {
				if (left.parentLegacyJazzId === null && right.parentLegacyJazzId) {
					return -1;
				}
				if (left.parentLegacyJazzId && right.parentLegacyJazzId === null) {
					return 1;
				}
				return (
					(left.parentLegacyJazzId ?? "").localeCompare(
						right.parentLegacyJazzId ?? "",
					) ||
					left.positionKey.localeCompare(right.positionKey) ||
					left.legacyJazzId.localeCompare(right.legacyJazzId)
				);
			}),
		}))
		.sort(
			(left, right) =>
				left.positionKey.localeCompare(right.positionKey) ||
				left.legacyJazzId.localeCompare(right.legacyJazzId),
		);
}

export function serializeClassicMigrationCollections(
	collectionsToSerialize: ClassicMigrationCollection[],
) {
	return JSON.stringify(
		canonicalize(normalizeClassicMigrationCollections(collectionsToSerialize)),
	);
}

export async function fingerprintClassicMigrationCollectionsInBrowser(
	collectionsToFingerprint: ClassicMigrationCollection[],
) {
	const bytes = new TextEncoder().encode(
		serializeClassicMigrationCollections(collectionsToFingerprint),
	);
	const digest = await crypto.subtle.digest("SHA-256", bytes);
	return Array.from(new Uint8Array(digest), (byte) =>
		byte.toString(16).padStart(2, "0"),
	).join("");
}
