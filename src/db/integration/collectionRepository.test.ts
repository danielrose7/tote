import { and, asc, eq, isNull, sql } from "drizzle-orm";
import {
	createCollection,
	createCollectionNode,
	deleteCollection,
	deleteCollectionNode,
	getCollectionDetail,
	listCollectionSummaries,
	reorderCollectionNodes,
	updateCollection,
	updateCollectionNode,
} from "../../lib/collections/repository";
import {
	ablyOutbox,
	collectionLineage,
	collectionMembers,
	collectionMutationReceipts,
	collectionNodes,
	collections,
} from "../schema";
import {
	collectionFactory,
	collectionMemberFactory,
	collectionNodeFactory,
} from "../testing/factories";
import { dbTest, expect } from "../testing/vitest";

async function createOwnedCollection(ownerUserId: string) {
	const collection = await collectionFactory.create({ ownerUserId });
	await collectionMemberFactory.create({
		collectionId: collection.id,
		userId: ownerUserId,
		role: "owner",
	});
	return collection;
}

dbTest(
	"creates a collection and owner membership atomically",
	async ({ db }) => {
		const result = await createCollection(
			"new_owner",
			{
				name: "Created through repository",
				positionKey: "a0",
			},
			db,
		);
		expect(result.status).toBe("created");
		if (result.status === "idempotency_conflict") {
			throw new Error("Expected collection creation to succeed");
		}
		const collectionId = result.id;

		const [collection] = await db
			.select()
			.from(collections)
			.where(eq(collections.id, collectionId));
		const [membership] = await db
			.select()
			.from(collectionMembers)
			.where(eq(collectionMembers.collectionId, collectionId));

		expect(collection.ownerUserId).toBe("new_owner");
		expect(membership).toMatchObject({
			userId: "new_owner",
			role: "owner",
		});
	},
);

dbTest(
	"assigns an end-of-list position key when the client omits one",
	async ({ db }) => {
		const input = {
			id: "40000000-0000-4000-8000-000000000031",
			mutationId: "50000000-0000-4000-8000-000000000031",
			name: "Capture-created collection",
		};

		expect(await createCollection("capture_owner", input, db)).toEqual({
			status: "created",
			id: input.id,
		});
		// The replay must fingerprint the same server-assigned key.
		expect(await createCollection("capture_owner", input, db)).toEqual({
			status: "replayed",
			id: input.id,
		});

		const [collection] = await db
			.select()
			.from(collections)
			.where(eq(collections.id, input.id));
		expect(collection.positionKey).toBe(`z:${input.id}`);
	},
);

dbTest(
	"replays an idempotent collection create without duplicating rows",
	async ({ db }) => {
		const input = {
			id: "40000000-0000-4000-8000-000000000001",
			mutationId: "50000000-0000-4000-8000-000000000001",
			name: "Retry-safe collection",
			positionKey: "a0",
		};

		expect(await createCollection("retry_owner", input, db)).toEqual({
			status: "created",
			id: input.id,
		});
		expect(await createCollection("retry_owner", input, db)).toEqual({
			status: "replayed",
			id: input.id,
		});

		const createdCollections = await db
			.select()
			.from(collections)
			.where(eq(collections.id, input.id));
		const receipts = await db
			.select()
			.from(collectionMutationReceipts)
			.where(eq(collectionMutationReceipts.mutationId, input.mutationId));
		const events = await db
			.select()
			.from(ablyOutbox)
			.where(eq(ablyOutbox.mutationId, input.mutationId));

		expect(createdCollections).toHaveLength(1);
		expect(receipts).toHaveLength(1);
		expect(events).toHaveLength(2);
		expect(events.map(({ channel, name }) => ({ channel, name }))).toEqual([
			{
				channel: `collection:${input.id}`,
				name: "collection.created",
			},
			{
				channel: "user:retry_owner:collections",
				name: "collection.index.updated",
			},
		]);
	},
);

dbTest(
	"rejects mutation id reuse with different collection input",
	async ({ db }) => {
		const id = "40000000-0000-4000-8000-000000000002";
		const mutationId = "50000000-0000-4000-8000-000000000002";

		await createCollection(
			"conflict_owner",
			{ id, mutationId, name: "Original", positionKey: "a0" },
			db,
		);

		expect(
			await createCollection(
				"conflict_owner",
				{ id, mutationId, name: "Changed", positionKey: "a0" },
				db,
			),
		).toEqual({ status: "idempotency_conflict" });
	},
);

dbTest("lists only active collections visible to the actor", async ({ db }) => {
	const actorUserId = "summary_actor";
	const first = await collectionFactory.create({
		ownerUserId: "first_owner",
		name: "First",
		legacyJazzId: "co_zFirst",
		positionKey: "a0",
	});
	const second = await collectionFactory.create({
		ownerUserId: "second_owner",
		name: "Second",
		legacyJazzId: "co_zSecond",
		positionKey: "a1",
	});
	const revoked = await collectionFactory.create({
		ownerUserId: "revoked_owner",
		name: "Revoked",
		positionKey: "a2",
	});

	await collectionMemberFactory.create({
		collectionId: second.id,
		userId: actorUserId,
		role: "editor",
	});
	await collectionMemberFactory.create({
		collectionId: first.id,
		userId: actorUserId,
		role: "viewer",
	});
	await collectionMemberFactory.create({
		collectionId: revoked.id,
		userId: actorUserId,
		role: "viewer",
		revokedAt: new Date(),
	});

	const summaries = await listCollectionSummaries(actorUserId, db);

	expect(
		summaries.map(({ name, role, legacyJazzId }) => ({
			name,
			role,
			legacyJazzId,
		})),
	).toEqual([
		{ name: "First", role: "viewer", legacyJazzId: "co_zFirst" },
		{ name: "Second", role: "editor", legacyJazzId: "co_zSecond" },
	]);
});

dbTest(
	"returns active collection detail without soft-deleted nodes",
	async ({ db }) => {
		const collection = await createOwnedCollection("detail_owner");
		const source = await createOwnedCollection("detail_owner");
		await db.insert(collectionLineage).values({
			childCollectionId: collection.id,
			relationship: "copied",
			sourceCollectionId: source.id,
			sourceOwnerUserId: "detail_owner",
			sourceVersion: source.version,
			sourceNameSnapshot: "Source snapshot",
			createdByUserId: "detail_owner",
		});
		const activeNode = await collectionNodeFactory.create({
			collectionId: collection.id,
			createdByUserId: "detail_owner",
			title: "Active",
		});
		await collectionNodeFactory.create({
			collectionId: collection.id,
			createdByUserId: "detail_owner",
			title: "Deleted",
			deletedAt: new Date(),
		});

		const detail = await getCollectionDetail("detail_owner", collection.id, db);

		expect(detail?.role).toBe("owner");
		expect(detail?.nodes.map((node) => node.id)).toEqual([activeNode.id]);
		expect(detail?.lineage).toEqual([
			{
				relationship: "copied",
				sourceName: "Source snapshot",
				sourceCollectionId: source.id,
				sourcePublicationId: null,
				sourceVersion: source.version,
			},
		]);

		await db
			.update(collectionMembers)
			.set({ revokedAt: new Date() })
			.where(
				and(
					eq(collectionMembers.collectionId, source.id),
					eq(collectionMembers.userId, "detail_owner"),
				),
			);
		const detailAfterRevocation = await getCollectionDetail(
			"detail_owner",
			collection.id,
			db,
		);
		expect(detailAfterRevocation?.lineage[0]?.sourceCollectionId).toBeNull();
	},
);

dbTest("enforces viewer and owner mutation capabilities", async ({ db }) => {
	const collection = await createOwnedCollection("capability_owner");
	await collectionMemberFactory.create({
		collectionId: collection.id,
		userId: "capability_viewer",
		role: "viewer",
	});

	expect(
		await updateCollection(
			"capability_viewer",
			collection.id,
			{ expectedVersion: collection.version, name: "Forbidden" },
			db,
		),
	).toEqual({ status: "forbidden" });

	expect(
		await deleteCollection(
			"capability_viewer",
			collection.id,
			{ expectedVersion: collection.version },
			db,
		),
	).toEqual({ status: "forbidden" });

	expect(
		await deleteCollection(
			"capability_owner",
			collection.id,
			{ expectedVersion: collection.version },
			db,
		),
	).toEqual({ status: "ok", value: { version: collection.version + 1 } });
});

dbTest("replays collection updates and deletions", async ({ db }) => {
	const updatedCollection = await createOwnedCollection("mutation_owner");
	const updateInput = {
		expectedVersion: updatedCollection.version,
		mutationId: "50000000-0000-4000-8000-000000000010",
		name: "Updated once",
	};

	expect(
		await updateCollection(
			"mutation_owner",
			updatedCollection.id,
			updateInput,
			db,
		),
	).toEqual({
		status: "ok",
		value: { version: updatedCollection.version + 1 },
	});
	expect(
		await updateCollection(
			"mutation_owner",
			updatedCollection.id,
			updateInput,
			db,
		),
	).toEqual({
		status: "ok",
		value: { version: updatedCollection.version + 1 },
		replayed: true,
	});
	expect(
		await updateCollection(
			"mutation_owner",
			updatedCollection.id,
			{ ...updateInput, name: "Different request" },
			db,
		),
	).toEqual({ status: "idempotency_conflict" });

	const deletedCollection = await createOwnedCollection("mutation_owner");
	const deleteInput = {
		expectedVersion: deletedCollection.version,
		mutationId: "50000000-0000-4000-8000-000000000011",
	};
	expect(
		await deleteCollection(
			"mutation_owner",
			deletedCollection.id,
			deleteInput,
			db,
		),
	).toEqual({
		status: "ok",
		value: { version: deletedCollection.version + 1 },
	});
	expect(
		await deleteCollection(
			"mutation_owner",
			deletedCollection.id,
			deleteInput,
			db,
		),
	).toEqual({
		status: "ok",
		value: { version: deletedCollection.version + 1 },
		replayed: true,
	});

	const events = await db
		.select({
			mutationId: ablyOutbox.mutationId,
			channel: ablyOutbox.channel,
			name: ablyOutbox.name,
		})
		.from(ablyOutbox)
		.where(
			sql`${ablyOutbox.mutationId} IN (${updateInput.mutationId}, ${deleteInput.mutationId})`,
		);

	expect(events).toHaveLength(4);
	expect(events.filter((event) => event.name === "collection.updated")).toEqual(
		[
			{
				mutationId: updateInput.mutationId,
				channel: `collection:${updatedCollection.id}`,
				name: "collection.updated",
			},
		],
	);
	expect(events.filter((event) => event.name === "collection.deleted")).toEqual(
		[
			{
				mutationId: deleteInput.mutationId,
				channel: `collection:${deletedCollection.id}`,
				name: "collection.deleted",
			},
		],
	);
});

dbTest("detects stale collection and node versions", async ({ db }) => {
	const collection = await createOwnedCollection("version_owner");
	const updated = await updateCollection(
		"version_owner",
		collection.id,
		{ expectedVersion: collection.version, name: "Updated" },
		db,
	);

	expect(updated).toEqual({
		status: "ok",
		value: { version: collection.version + 1 },
	});
	expect(
		await updateCollection(
			"version_owner",
			collection.id,
			{ expectedVersion: collection.version, name: "Stale" },
			db,
		),
	).toEqual({ status: "version_conflict" });

	const node = await collectionNodeFactory.create({
		collectionId: collection.id,
		createdByUserId: "version_owner",
	});
	await updateCollectionNode(
		"version_owner",
		collection.id,
		node.id,
		{ expectedVersion: node.version, title: "Updated node" },
		db,
	);

	expect(
		await updateCollectionNode(
			"version_owner",
			collection.id,
			node.id,
			{ expectedVersion: node.version, title: "Stale node" },
			db,
		),
	).toEqual({ status: "version_conflict" });
});

dbTest(
	"node mutations return refreshed item counts and collection versions",
	async ({ db }) => {
		const collection = await createOwnedCollection("count_owner");

		const created = await createCollectionNode(
			"count_owner",
			collection.id,
			{
				type: "product",
				title: "Counted product",
				positionKey: "a0",
			},
			db,
		);
		expect(created).toEqual({
			status: "ok",
			value: {
				id: expect.any(String),
				version: 1,
				collectionVersion: collection.version + 1,
				itemCount: 1,
			},
		});
		if (created.status !== "ok") {
			throw new Error("Expected node creation to succeed");
		}

		const changedType = await updateCollectionNode(
			"count_owner",
			collection.id,
			created.value.id,
			{ expectedVersion: 1, type: "note" },
			db,
		);
		expect(changedType).toEqual({
			status: "ok",
			value: {
				version: 2,
				collectionVersion: collection.version + 2,
				itemCount: 0,
			},
		});
	},
);

dbTest("replays idempotent node mutations", async ({ db }) => {
	const collection = await createOwnedCollection("node_retry_owner");
	const createInput = {
		id: "40000000-0000-4000-8000-000000000020",
		mutationId: "50000000-0000-4000-8000-000000000020",
		type: "product" as const,
		title: "Retry-safe node",
		positionKey: "a0",
	};

	const created = await createCollectionNode(
		"node_retry_owner",
		collection.id,
		createInput,
		db,
	);
	expect(created).toEqual({
		status: "ok",
		value: {
			id: createInput.id,
			version: 1,
			collectionVersion: collection.version + 1,
			itemCount: 1,
		},
	});
	expect(
		await createCollectionNode(
			"node_retry_owner",
			collection.id,
			createInput,
			db,
		),
	).toEqual({
		status: "ok",
		value: {
			id: createInput.id,
			version: 1,
			collectionVersion: collection.version + 1,
			itemCount: 1,
		},
		replayed: true,
	});

	const updateInput = {
		expectedVersion: 1,
		mutationId: "50000000-0000-4000-8000-000000000021",
		title: "Updated once",
	};
	expect(
		await updateCollectionNode(
			"node_retry_owner",
			collection.id,
			createInput.id,
			updateInput,
			db,
		),
	).toEqual({
		status: "ok",
		value: {
			version: 2,
			collectionVersion: collection.version + 2,
			itemCount: 1,
		},
	});
	expect(
		await updateCollectionNode(
			"node_retry_owner",
			collection.id,
			createInput.id,
			updateInput,
			db,
		),
	).toEqual({
		status: "ok",
		value: {
			version: 2,
			collectionVersion: collection.version + 2,
			itemCount: 1,
		},
		replayed: true,
	});
	expect(
		await updateCollectionNode(
			"node_retry_owner",
			collection.id,
			createInput.id,
			{ ...updateInput, title: "Different request" },
			db,
		),
	).toEqual({ status: "idempotency_conflict" });

	const deleteInput = {
		expectedVersion: 2,
		mutationId: "50000000-0000-4000-8000-000000000022",
	};
	expect(
		await deleteCollectionNode(
			"node_retry_owner",
			collection.id,
			createInput.id,
			deleteInput,
			db,
		),
	).toEqual({
		status: "ok",
		value: {
			deletedNodeCount: 1,
			collectionVersion: collection.version + 3,
			itemCount: 0,
		},
	});
	expect(
		await deleteCollectionNode(
			"node_retry_owner",
			collection.id,
			createInput.id,
			deleteInput,
			db,
		),
	).toEqual({
		status: "ok",
		value: {
			deletedNodeCount: 1,
			collectionVersion: collection.version + 3,
			itemCount: 0,
		},
		replayed: true,
	});

	const events = await db
		.select({
			mutationId: ablyOutbox.mutationId,
			channel: ablyOutbox.channel,
			name: ablyOutbox.name,
			data: ablyOutbox.data,
		})
		.from(ablyOutbox)
		.where(
			sql`${ablyOutbox.mutationId} IN (
				${createInput.mutationId},
				${updateInput.mutationId},
				${deleteInput.mutationId}
			)`,
		);

	expect(events).toHaveLength(6);
	expect(
		events
			.filter((event) => event.channel === `collection:${collection.id}`)
			.map(({ name, data }) => ({ name, data })),
	).toEqual([
		{
			name: "collection.node.created",
			data: {
				collectionId: collection.id,
				nodeId: createInput.id,
				version: 1,
			},
		},
		{
			name: "collection.node.updated",
			data: {
				collectionId: collection.id,
				nodeId: createInput.id,
				version: 2,
			},
		},
		{
			name: "collection.node.deleted",
			data: {
				collectionId: collection.id,
				nodeId: createInput.id,
				deletedNodeCount: 1,
			},
		},
	]);
});

dbTest("reorders sibling nodes atomically and idempotently", async ({ db }) => {
	const collection = await createOwnedCollection("reorder_owner");
	const first = await collectionNodeFactory.create({
		collectionId: collection.id,
		createdByUserId: "reorder_owner",
		positionKey: "a0",
	});
	const second = await collectionNodeFactory.create({
		collectionId: collection.id,
		createdByUserId: "reorder_owner",
		positionKey: "a1",
	});
	const third = await collectionNodeFactory.create({
		collectionId: collection.id,
		createdByUserId: "reorder_owner",
		positionKey: "a2",
	});
	const input = {
		mutationId: "50000000-0000-4000-8000-000000000030",
		nodes: [
			{ id: third.id, expectedVersion: third.version, positionKey: "r:0" },
			{ id: first.id, expectedVersion: first.version, positionKey: "r:1" },
			{ id: second.id, expectedVersion: second.version, positionKey: "r:2" },
		],
	};

	const reordered = await reorderCollectionNodes(
		"reorder_owner",
		collection.id,
		input,
		db,
	);
	expect(reordered).toMatchObject({
		status: "ok",
		value: { nodeCount: 3 },
	});
	expect(
		await reorderCollectionNodes("reorder_owner", collection.id, input, db),
	).toMatchObject({
		status: "ok",
		value: { nodeCount: 3 },
		replayed: true,
	});

	const orderedNodes = await db
		.select({ id: collectionNodes.id })
		.from(collectionNodes)
		.where(eq(collectionNodes.collectionId, collection.id))
		.orderBy(asc(collectionNodes.positionKey));
	expect(orderedNodes.map(({ id }) => id)).toEqual([
		third.id,
		first.id,
		second.id,
	]);

	const events = await db
		.select()
		.from(ablyOutbox)
		.where(eq(ablyOutbox.mutationId, input.mutationId));
	expect(events).toHaveLength(2);
	expect(events[0]).toMatchObject({
		channel: `collection:${collection.id}`,
		name: "collection.nodes.reordered",
	});

	expect(
		await reorderCollectionNodes(
			"reorder_owner",
			collection.id,
			{
				mutationId: "50000000-0000-4000-8000-000000000031",
				nodes: [
					{ id: first.id, expectedVersion: 2, positionKey: "p0" },
					{ id: second.id, expectedVersion: 2, positionKey: "p1" },
				],
			},
			db,
		),
	).toEqual({ status: "version_conflict" });

	const staleResult = await reorderCollectionNodes(
		"reorder_owner",
		collection.id,
		{
			mutationId: "50000000-0000-4000-8000-000000000032",
			nodes: [
				{ id: first.id, expectedVersion: first.version, positionKey: "z0" },
				{ id: second.id, expectedVersion: 2, positionKey: "z1" },
			],
		},
		db,
	);
	expect(staleResult).toEqual({ status: "version_conflict" });

	const unchangedNodes = await db
		.select({ id: collectionNodes.id })
		.from(collectionNodes)
		.where(eq(collectionNodes.collectionId, collection.id))
		.orderBy(asc(collectionNodes.positionKey));
	expect(unchangedNodes.map(({ id }) => id)).toEqual([
		third.id,
		first.id,
		second.id,
	]);
});

dbTest(
	"deleting a section soft-deletes its subtree and updates itemCount",
	async ({ db }) => {
		const collection = await createOwnedCollection("subtree_owner");
		const section = await collectionNodeFactory.create({
			collectionId: collection.id,
			createdByUserId: "subtree_owner",
			type: "section",
			parentId: null,
		});
		await collectionNodeFactory.create({
			collectionId: collection.id,
			createdByUserId: "subtree_owner",
			type: "product",
			parentId: section.id,
		});
		await collectionNodeFactory.create({
			collectionId: collection.id,
			createdByUserId: "subtree_owner",
			type: "link",
			parentId: section.id,
		});

		const result = await deleteCollectionNode(
			"subtree_owner",
			collection.id,
			section.id,
			{ expectedVersion: section.version },
			db,
		);

		expect(result).toEqual({
			status: "ok",
			value: {
				deletedNodeCount: 3,
				collectionVersion: collection.version + 6,
				itemCount: 0,
			},
		});

		const activeNodes = await db
			.select()
			.from(collectionNodes)
			.where(
				and(
					eq(collectionNodes.collectionId, collection.id),
					isNull(collectionNodes.deletedAt),
				),
			);
		expect(activeNodes).toHaveLength(0);
	},
);
