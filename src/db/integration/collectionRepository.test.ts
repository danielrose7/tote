import { and, eq, isNull } from "drizzle-orm";
import {
	createCollection,
	createCollectionNode,
	deleteCollection,
	deleteCollectionNode,
	getCollectionDetail,
	listCollectionSummaries,
	updateCollection,
	updateCollectionNode,
} from "../../lib/collections/repository";
import {
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

		expect(createdCollections).toHaveLength(1);
		expect(receipts).toHaveLength(1);
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
		positionKey: "a0",
	});
	const second = await collectionFactory.create({
		ownerUserId: "second_owner",
		name: "Second",
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

	expect(summaries.map(({ name, role }) => ({ name, role }))).toEqual([
		{ name: "First", role: "viewer" },
		{ name: "Second", role: "editor" },
	]);
});

dbTest(
	"returns active collection detail without soft-deleted nodes",
	async ({ db }) => {
		const collection = await createOwnedCollection("detail_owner");
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
			section.version,
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
