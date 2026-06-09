import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray } from "drizzle-orm";
import {
	accountCollectionMigrations,
	accountDataSources,
	collectionMembers,
	collectionNodes,
	collections,
} from "../../db/schema";
import { withTransactionalDb } from "../transactionalDb";
import { fingerprintMutationRequest } from "./idempotency";
import {
	type ClassicMigrationCollection,
	normalizeClassicMigrationCollections,
} from "./migrationPayload";
import { getRollbackExpiration } from "./migrationReceipt";
import type { CollectionDatabase } from "./repository";

export type { ClassicMigrationCollection } from "./migrationPayload";

export type ImportClassicCollectionsInput = {
	migrationVersion: 1;
	sourceFingerprint: string;
	collections: ClassicMigrationCollection[];
};

export type ImportClassicCollectionsResult =
	| {
			status: "ok";
			value: {
				replayed: boolean;
				collectionIdsByLegacyJazzId: Record<string, string>;
				collectionCount: number;
				itemCount: number;
			};
	  }
	| { status: "fingerprint_mismatch" }
	| { status: "migration_conflict" }
	| { status: "invalid_source"; reason: string };

export function fingerprintClassicMigrationCollections(
	collectionsToFingerprint: ClassicMigrationCollection[],
) {
	return fingerprintMutationRequest(
		normalizeClassicMigrationCollections(collectionsToFingerprint),
	);
}

function countItems(collectionsToImport: ClassicMigrationCollection[]) {
	return collectionsToImport.reduce(
		(total, collection) =>
			total +
			collection.nodes.filter((node) =>
				["product", "link", "photo"].includes(node.type),
			).length,
		0,
	);
}

function validateSource(collectionsToImport: ClassicMigrationCollection[]) {
	const collectionIds = new Set<string>();
	for (const collection of collectionsToImport) {
		if (collectionIds.has(collection.legacyJazzId)) {
			return `Duplicate collection legacy id: ${collection.legacyJazzId}`;
		}
		collectionIds.add(collection.legacyJazzId);

		const nodeIds = new Set(collection.nodes.map((node) => node.legacyJazzId));
		if (nodeIds.size !== collection.nodes.length) {
			return `Duplicate node legacy id in ${collection.legacyJazzId}`;
		}
		const nodesById = new Map(
			collection.nodes.map((node) => [node.legacyJazzId, node]),
		);
		for (const node of collection.nodes) {
			if (!node.parentLegacyJazzId) continue;
			const parent = nodesById.get(node.parentLegacyJazzId);
			if (!parent) {
				return `Missing parent ${node.parentLegacyJazzId}`;
			}
			if (parent.type !== "section") {
				return `Parent ${node.parentLegacyJazzId} is not a section`;
			}
			if (node.type === "section") {
				return `Section ${node.legacyJazzId} cannot have a parent`;
			}
		}
	}
	return null;
}

async function existingCollectionMapping(
	actorUserId: string,
	legacyJazzIds: string[],
	database: CollectionDatabase,
) {
	if (legacyJazzIds.length === 0) return {};
	const rows = await database
		.select({
			id: collections.id,
			legacyJazzId: collections.legacyJazzId,
		})
		.from(collections)
		.where(
			and(
				eq(collections.ownerUserId, actorUserId),
				inArray(collections.legacyJazzId, legacyJazzIds),
			),
		);
	return Object.fromEntries(
		rows.flatMap((row) =>
			row.legacyJazzId ? [[row.legacyJazzId, row.id]] : [],
		),
	);
}

async function importClassicCollectionsWithDatabase(
	actorUserId: string,
	input: ImportClassicCollectionsInput,
	database: CollectionDatabase,
): Promise<ImportClassicCollectionsResult> {
	const computedSourceFingerprint = fingerprintClassicMigrationCollections(
		input.collections,
	);
	if (computedSourceFingerprint !== input.sourceFingerprint) {
		return { status: "fingerprint_mismatch" };
	}
	const invalidReason = validateSource(input.collections);
	if (invalidReason) {
		return { status: "invalid_source", reason: invalidReason };
	}

	const [existingMigration] = await database
		.select()
		.from(accountCollectionMigrations)
		.where(
			and(
				eq(accountCollectionMigrations.userId, actorUserId),
				eq(
					accountCollectionMigrations.migrationVersion,
					input.migrationVersion,
				),
			),
		)
		.limit(1);
	if (existingMigration?.status === "completed") {
		if (existingMigration.sourceFingerprint !== input.sourceFingerprint) {
			return { status: "migration_conflict" };
		}
		return {
			status: "ok",
			value: {
				replayed: true,
				collectionIdsByLegacyJazzId: await existingCollectionMapping(
					actorUserId,
					input.collections.map((collection) => collection.legacyJazzId),
					database,
				),
				collectionCount: existingMigration.importedCollectionCount ?? 0,
				itemCount: existingMigration.importedItemCount ?? 0,
			},
		};
	}

	const now = new Date();
	await database
		.insert(accountDataSources)
		.values({
			userId: actorUserId,
			dataSource: "migrating",
			migrationVersion: input.migrationVersion,
			updatedAt: now,
		})
		.onConflictDoUpdate({
			target: accountDataSources.userId,
			set: {
				dataSource: "migrating",
				migrationVersion: input.migrationVersion,
				updatedAt: now,
			},
		});
	await database
		.insert(accountCollectionMigrations)
		.values({
			userId: actorUserId,
			migrationVersion: input.migrationVersion,
			status: "importing",
			sourceCollectionCount: input.collections.length,
			sourceItemCount: countItems(input.collections),
			sourceFingerprint: input.sourceFingerprint,
			startedAt: now,
			updatedAt: now,
		})
		.onConflictDoUpdate({
			target: [
				accountCollectionMigrations.userId,
				accountCollectionMigrations.migrationVersion,
			],
			set: {
				status: "importing",
				sourceCollectionCount: input.collections.length,
				sourceItemCount: countItems(input.collections),
				sourceFingerprint: input.sourceFingerprint,
				error: null,
				startedAt: now,
				completedAt: null,
				updatedAt: now,
			},
		});

	const collectionIdsByLegacyJazzId: Record<string, string> = {};
	const nodeLegacyIdsByDatabaseId = new Map<string, string>();
	for (const collection of input.collections) {
		const collectionId = randomUUID();
		collectionIdsByLegacyJazzId[collection.legacyJazzId] = collectionId;
		await database.insert(collections).values({
			id: collectionId,
			ownerUserId: actorUserId,
			name: collection.name,
			description: collection.description,
			color: collection.color,
			budgetCents: collection.budgetCents,
			defaultViewMode: collection.defaultViewMode,
			publicLayout: collection.publicLayout,
			copyPolicy: collection.copyPolicy,
			positionKey: collection.positionKey,
			originType: "import",
			legacyJazzId: collection.legacyJazzId,
		});
		await database.insert(collectionMembers).values({
			collectionId,
			userId: actorUserId,
			role: "owner",
		});

		const nodeIds = new Map(
			collection.nodes.map((node) => [node.legacyJazzId, randomUUID()]),
		);
		for (const [legacyJazzId, databaseId] of nodeIds) {
			nodeLegacyIdsByDatabaseId.set(databaseId, legacyJazzId);
		}
		const nodeValues = collection.nodes.map((node) => ({
			id: nodeIds.get(node.legacyJazzId),
			collectionId,
			parentId: node.parentLegacyJazzId
				? nodeIds.get(node.parentLegacyJazzId)
				: null,
			type: node.type,
			title: node.title,
			properties: node.properties,
			positionKey: node.positionKey,
			createdByUserId: actorUserId,
		}));
		const topLevelNodes = nodeValues.filter((node) => node.parentId === null);
		const childNodes = nodeValues.filter((node) => node.parentId !== null);
		if (topLevelNodes.length > 0) {
			await database.insert(collectionNodes).values(topLevelNodes);
		}
		if (childNodes.length > 0) {
			await database.insert(collectionNodes).values(childNodes);
		}
	}

	const importedCollections =
		input.collections.length === 0
			? []
			: await database
					.select()
					.from(collections)
					.where(
						and(
							eq(collections.ownerUserId, actorUserId),
							inArray(
								collections.legacyJazzId,
								input.collections.map((collection) => collection.legacyJazzId),
							),
						),
					)
					.orderBy(asc(collections.positionKey));
	const importedNodes =
		importedCollections.length === 0
			? []
			: await database
					.select()
					.from(collectionNodes)
					.where(
						inArray(
							collectionNodes.collectionId,
							importedCollections.map((collection) => collection.id),
						),
					)
					.orderBy(
						asc(collectionNodes.collectionId),
						asc(collectionNodes.parentId),
						asc(collectionNodes.positionKey),
					);
	const importedNodesByCollectionId = Map.groupBy(
		importedNodes,
		(node) => node.collectionId,
	);
	const importedSemanticCollections: ClassicMigrationCollection[] =
		importedCollections.map((collection) => ({
			legacyJazzId: collection.legacyJazzId ?? "",
			name: collection.name,
			description: collection.description,
			color: collection.color,
			budgetCents: collection.budgetCents,
			defaultViewMode: collection.defaultViewMode,
			publicLayout: collection.publicLayout,
			copyPolicy: collection.copyPolicy,
			positionKey: collection.positionKey,
			nodes: (importedNodesByCollectionId.get(collection.id) ?? []).map(
				(node) => ({
					legacyJazzId: nodeLegacyIdsByDatabaseId.get(node.id) ?? "",
					parentLegacyJazzId: node.parentId
						? (nodeLegacyIdsByDatabaseId.get(node.parentId) ?? null)
						: null,
					type: node.type,
					title: node.title,
					properties: node.properties,
					positionKey: node.positionKey,
				}),
			),
		}));
	const importFingerprint = fingerprintClassicMigrationCollections(
		importedSemanticCollections,
	);
	const importedItemCount = importedCollections.reduce(
		(total, collection) => total + collection.itemCount,
		0,
	);
	if (
		importedCollections.length !== input.collections.length ||
		importedItemCount !== countItems(input.collections) ||
		importFingerprint !== input.sourceFingerprint
	) {
		throw new Error("Imported collection verification failed");
	}

	await database
		.update(accountCollectionMigrations)
		.set({
			status: "completed",
			importedCollectionCount: importedCollections.length,
			importedItemCount,
			importFingerprint,
			completedAt: now,
			updatedAt: now,
		})
		.where(
			and(
				eq(accountCollectionMigrations.userId, actorUserId),
				eq(
					accountCollectionMigrations.migrationVersion,
					input.migrationVersion,
				),
			),
		);
	await database
		.update(accountDataSources)
		.set({
			dataSource: "neon_verifying",
			lastVerifiedAt: now,
			updatedAt: now,
		})
		.where(eq(accountDataSources.userId, actorUserId));

	return {
		status: "ok",
		value: {
			replayed: false,
			collectionIdsByLegacyJazzId,
			collectionCount: importedCollections.length,
			itemCount: importedItemCount,
		},
	};
}

export async function importClassicCollections(
	actorUserId: string,
	input: ImportClassicCollectionsInput,
	database?: CollectionDatabase,
): Promise<ImportClassicCollectionsResult> {
	if (database) {
		return importClassicCollectionsWithDatabase(actorUserId, input, database);
	}
	return withTransactionalDb((transactionalDatabase) =>
		transactionalDatabase.transaction(
			(transaction) =>
				importClassicCollectionsWithDatabase(actorUserId, input, transaction),
			{ isolationLevel: "repeatable read" },
		),
	);
}

export type CollectionMigrationStatus = {
	dataSource:
		| "classic_jazz"
		| "migrating"
		| "neon_verifying"
		| "neon"
		| "migration_failed";
	migrationVersion: number | null;
	status:
		| "pending"
		| "exporting"
		| "importing"
		| "verifying"
		| "completed"
		| "failed"
		| null;
	collectionCount: number | null;
	itemCount: number | null;
	cutoverAt: Date | null;
	rollbackExpiresAt: Date | null;
	error: Record<string, unknown> | null;
};

export async function getCollectionMigrationStatus(
	actorUserId: string,
	database: CollectionDatabase,
): Promise<CollectionMigrationStatus> {
	const [account] = await database
		.select()
		.from(accountDataSources)
		.where(eq(accountDataSources.userId, actorUserId))
		.limit(1);
	const [migration] = await database
		.select()
		.from(accountCollectionMigrations)
		.where(eq(accountCollectionMigrations.userId, actorUserId))
		.orderBy(asc(accountCollectionMigrations.migrationVersion))
		.limit(1);

	return {
		dataSource: account?.dataSource ?? "classic_jazz",
		migrationVersion: account?.migrationVersion ?? null,
		status: migration?.status ?? null,
		collectionCount: migration?.importedCollectionCount ?? null,
		itemCount: migration?.importedItemCount ?? null,
		cutoverAt: account?.cutoverAt ?? null,
		rollbackExpiresAt: account?.rollbackExpiresAt ?? null,
		error: migration?.error ?? null,
	};
}

export type ConfirmCollectionMigrationResult =
	| {
			status: "ok";
			value: { cutoverAt: Date; rollbackExpiresAt: Date };
	  }
	| { status: "not_ready" };

export async function confirmCollectionMigration(
	actorUserId: string,
	database: CollectionDatabase,
): Promise<ConfirmCollectionMigrationResult> {
	const status = await getCollectionMigrationStatus(actorUserId, database);
	if (status.dataSource !== "neon_verifying" || status.status !== "completed") {
		return { status: "not_ready" };
	}
	const cutoverAt = new Date();
	const rollbackExpiresAt = getRollbackExpiration(cutoverAt);
	const [updated] = await database
		.update(accountDataSources)
		.set({
			dataSource: "neon",
			cutoverAt,
			rollbackExpiresAt,
			updatedAt: cutoverAt,
		})
		.where(
			and(
				eq(accountDataSources.userId, actorUserId),
				eq(accountDataSources.dataSource, "neon_verifying"),
			),
		)
		.returning({ userId: accountDataSources.userId });
	if (!updated) return { status: "not_ready" };
	return { status: "ok", value: { cutoverAt, rollbackExpiresAt } };
}

export type RollbackCollectionMigrationResult =
	| { status: "ok" }
	| { status: "not_available" };

export async function rollbackCollectionMigration(
	actorUserId: string,
	database: CollectionDatabase,
	now = new Date(),
): Promise<RollbackCollectionMigrationResult> {
	const status = await getCollectionMigrationStatus(actorUserId, database);
	if (
		status.dataSource !== "neon" ||
		!status.rollbackExpiresAt ||
		status.rollbackExpiresAt <= now
	) {
		return { status: "not_available" };
	}
	const [updated] = await database
		.update(accountDataSources)
		.set({
			dataSource: "classic_jazz",
			updatedAt: now,
		})
		.where(
			and(
				eq(accountDataSources.userId, actorUserId),
				eq(accountDataSources.dataSource, "neon"),
			),
		)
		.returning({ userId: accountDataSources.userId });
	return updated ? { status: "ok" } : { status: "not_available" };
}
