import { and, eq } from "drizzle-orm";
import {
	confirmCollectionMigration,
	fingerprintClassicMigrationCollections,
	getCollectionMigrationStatus,
	type ImportClassicCollectionsInput,
	importClassicCollections,
} from "../../lib/collections/migrationRepository";
import {
	accountCollectionMigrations,
	accountDataSources,
	collectionMembers,
	collectionNodes,
	collections,
} from "../schema";
import { dbTest, expect } from "../testing/vitest";

function migrationInput(): ImportClassicCollectionsInput {
	const collectionsToImport = [
		{
			legacyJazzId: "co_zCollectionOne",
			name: "Lighting ideas",
			description: "Imported from Jazz",
			color: "#6366f1",
			budgetCents: 50000,
			defaultViewMode: "grid" as const,
			publicLayout: "feature" as const,
			copyPolicy: "public" as const,
			positionKey: "a0",
			nodes: [
				{
					legacyJazzId: "co_zProductOne",
					parentLegacyJazzId: "co_zSectionOne",
					type: "product" as const,
					title: "Brass lamp",
					properties: {
						url: "https://example.com/lamp",
						price: "$129",
					},
					positionKey: "a0",
				},
				{
					legacyJazzId: "co_zSectionOne",
					parentLegacyJazzId: null,
					type: "section" as const,
					title: "Desk lamps",
					properties: { description: "Task lighting" },
					positionKey: "a0",
				},
				{
					legacyJazzId: "co_zNoteOne",
					parentLegacyJazzId: null,
					type: "note" as const,
					title: "Measure first",
					properties: { body: "Check the desk depth." },
					positionKey: "a1",
				},
			],
		},
	];
	return {
		migrationVersion: 1,
		sourceFingerprint:
			fingerprintClassicMigrationCollections(collectionsToImport),
		collections: collectionsToImport,
	};
}

dbTest(
	"imports and verifies an owned Jazz collection graph",
	async ({ db }) => {
		const input = migrationInput();
		const result = await importClassicCollections("migration_owner", input, db);
		expect(result.status).toBe("ok");
		if (result.status !== "ok") throw new Error("Expected migration import");
		expect(result.value).toMatchObject({
			replayed: false,
			collectionCount: 1,
			itemCount: 1,
		});

		const collectionId =
			result.value.collectionIdsByLegacyJazzId.co_zCollectionOne;
		const [collection] = await db
			.select()
			.from(collections)
			.where(eq(collections.id, collectionId));
		expect(collection).toMatchObject({
			ownerUserId: "migration_owner",
			legacyJazzId: "co_zCollectionOne",
			name: "Lighting ideas",
			originType: "import",
			itemCount: 1,
		});
		const [membership] = await db
			.select()
			.from(collectionMembers)
			.where(eq(collectionMembers.collectionId, collection.id));
		expect(membership).toMatchObject({
			userId: "migration_owner",
			role: "owner",
		});
		const nodes = await db
			.select()
			.from(collectionNodes)
			.where(eq(collectionNodes.collectionId, collection.id));
		expect(nodes).toHaveLength(3);
		const section = nodes.find((node) => node.type === "section");
		const product = nodes.find((node) => node.type === "product");
		expect(product?.parentId).toBe(section?.id);

		const [migration] = await db
			.select()
			.from(accountCollectionMigrations)
			.where(
				and(
					eq(accountCollectionMigrations.userId, "migration_owner"),
					eq(accountCollectionMigrations.migrationVersion, 1),
				),
			);
		expect(migration).toMatchObject({
			status: "completed",
			sourceCollectionCount: 1,
			sourceItemCount: 1,
			importedCollectionCount: 1,
			importedItemCount: 1,
			sourceFingerprint: input.sourceFingerprint,
			importFingerprint: input.sourceFingerprint,
		});
		const [account] = await db
			.select()
			.from(accountDataSources)
			.where(eq(accountDataSources.userId, "migration_owner"));
		expect(account).toMatchObject({
			dataSource: "neon_verifying",
			migrationVersion: 1,
		});
		expect(account.lastVerifiedAt).toBeInstanceOf(Date);
	},
);

dbTest(
	"replays a completed migration without duplicate rows",
	async ({ db }) => {
		const input = migrationInput();
		const first = await importClassicCollections("replay_migration", input, db);
		expect(first.status).toBe("ok");
		if (first.status !== "ok") throw new Error("Expected migration import");

		expect(
			await importClassicCollections("replay_migration", input, db),
		).toEqual({
			status: "ok",
			value: {
				replayed: true,
				collectionIdsByLegacyJazzId: first.value.collectionIdsByLegacyJazzId,
				collectionCount: 1,
				itemCount: 1,
			},
		});
		expect(
			await db
				.select()
				.from(collections)
				.where(eq(collections.ownerUserId, "replay_migration")),
		).toHaveLength(1);
	},
);

dbTest(
	"rejects forged fingerprints and changed completed sources",
	async ({ db }) => {
		const input = migrationInput();
		expect(
			await importClassicCollections(
				"bad_fingerprint_owner",
				{ ...input, sourceFingerprint: "0".repeat(64) },
				db,
			),
		).toEqual({ status: "fingerprint_mismatch" });

		await importClassicCollections("conflict_migration_owner", input, db);
		const changedCollections = [
			{
				...input.collections[0],
				name: "Changed after migration",
			},
		];
		expect(
			await importClassicCollections(
				"conflict_migration_owner",
				{
					...input,
					sourceFingerprint:
						fingerprintClassicMigrationCollections(changedCollections),
					collections: changedCollections,
				},
				db,
			),
		).toEqual({ status: "migration_conflict" });
	},
);

dbTest(
	"rejects malformed parent graphs before inserting rows",
	async ({ db }) => {
		const input = migrationInput();
		const malformedCollections = [
			{
				...input.collections[0],
				nodes: input.collections[0].nodes.map((node) =>
					node.type === "product"
						? { ...node, parentLegacyJazzId: "co_zMissing" }
						: node,
				),
			},
		];
		const result = await importClassicCollections(
			"invalid_graph_owner",
			{
				...input,
				sourceFingerprint:
					fingerprintClassicMigrationCollections(malformedCollections),
				collections: malformedCollections,
			},
			db,
		);
		expect(result).toEqual({
			status: "invalid_source",
			reason: "Missing parent co_zMissing",
		});
		expect(
			await db
				.select()
				.from(collections)
				.where(eq(collections.ownerUserId, "invalid_graph_owner")),
		).toEqual([]);
	},
);

dbTest(
	"requires verification before confirmed Neon cutover",
	async ({ db }) => {
		expect(await confirmCollectionMigration("cutover_owner", db)).toEqual({
			status: "not_ready",
		});
		const input = migrationInput();
		await importClassicCollections("cutover_owner", input, db);
		expect(
			await getCollectionMigrationStatus("cutover_owner", db),
		).toMatchObject({
			dataSource: "neon_verifying",
			status: "completed",
			collectionCount: 1,
			itemCount: 1,
			cutoverAt: null,
			rollbackExpiresAt: null,
		});

		const confirmed = await confirmCollectionMigration("cutover_owner", db);
		expect(confirmed.status).toBe("ok");
		if (confirmed.status !== "ok") throw new Error("Expected cutover");
		expect(
			confirmed.value.rollbackExpiresAt.getTime() -
				confirmed.value.cutoverAt.getTime(),
		).toBe(14 * 24 * 60 * 60 * 1_000);
		expect(
			await getCollectionMigrationStatus("cutover_owner", db),
		).toMatchObject({
			dataSource: "neon",
			status: "completed",
			cutoverAt: confirmed.value.cutoverAt,
			rollbackExpiresAt: confirmed.value.rollbackExpiresAt,
		});
	},
);
