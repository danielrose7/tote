import { eq } from "drizzle-orm";
import {
	listCaptureCollections,
	saveCapture,
} from "@/lib/collections/captureRepository";
import { collectionMembers, collectionNodes, collections } from "../schema";
import {
	collectionFactory,
	collectionMemberFactory,
	collectionNodeFactory,
} from "../testing/factories";
import { dbTest, expect } from "../testing/vitest";

dbTest(
	"lists writable collections with active sections for capture clients",
	async ({ db }) => {
		const actorUserId = "capture_actor";
		const owned = await collectionFactory.create({
			ownerUserId: actorUserId,
			name: "Owned",
			positionKey: "a0",
		});
		const shared = await collectionFactory.create({
			ownerUserId: "shared_owner",
			name: "Shared",
			positionKey: "a1",
		});
		const viewer = await collectionFactory.create({
			ownerUserId: "viewer_owner",
			name: "Viewer only",
			positionKey: "a2",
		});
		await collectionMemberFactory.create({
			collectionId: owned.id,
			userId: actorUserId,
			role: "owner",
		});
		await collectionMemberFactory.create({
			collectionId: shared.id,
			userId: actorUserId,
			role: "editor",
		});
		await collectionMemberFactory.create({
			collectionId: viewer.id,
			userId: actorUserId,
			role: "viewer",
		});
		await collectionNodeFactory.create({
			collectionId: shared.id,
			type: "section",
			title: "Lighting",
			positionKey: "a0",
			createdByUserId: "shared_owner",
		});
		await collectionNodeFactory.create({
			collectionId: shared.id,
			type: "section",
			title: "Deleted",
			positionKey: "a1",
			createdByUserId: "shared_owner",
			deletedAt: new Date(),
		});

		expect(await listCaptureCollections(actorUserId, db)).toEqual([
			{
				id: owned.id,
				name: "Owned",
				color: null,
				role: "owner",
				sections: [],
			},
			{
				id: shared.id,
				name: "Shared",
				color: null,
				role: "editor",
				sections: [
					expect.objectContaining({
						name: "Lighting",
					}),
				],
			},
		]);
	},
);

dbTest("saves an idempotent product capture into a section", async ({ db }) => {
	const actorUserId = "capture_owner";
	const collection = await collectionFactory.create({
		ownerUserId: actorUserId,
	});
	await collectionMemberFactory.create({
		collectionId: collection.id,
		userId: actorUserId,
		role: "owner",
	});
	const section = await collectionNodeFactory.create({
		collectionId: collection.id,
		type: "section",
		title: "Desk",
		createdByUserId: actorUserId,
	});
	const input = {
		id: "40000000-0000-4000-8000-000000000901",
		mutationId: "50000000-0000-4000-8000-000000000901",
		collectionId: collection.id,
		sectionId: section.id,
		title: "Task lamp",
		url: "https://example.com/lamp",
		imageUrl: "https://example.com/lamp.jpg",
		price: "$129",
	};

	const first = await saveCapture(actorUserId, input, db);
	expect(first.status).toBe("ok");
	expect(await saveCapture(actorUserId, input, db)).toMatchObject({
		status: "ok",
		replayed: true,
	});
	const [node] = await db
		.select()
		.from(collectionNodes)
		.where(eq(collectionNodes.id, input.id));
	expect(node).toMatchObject({
		collectionId: collection.id,
		parentId: section.id,
		type: "product",
		title: "Task lamp",
		positionKey: `z:${input.id}`,
		properties: {
			url: "https://example.com/lamp",
			imageUrl: "https://example.com/lamp.jpg",
			price: "$129",
		},
	});
	const [updatedCollection] = await db
		.select()
		.from(collections)
		.where(eq(collections.id, collection.id));
	expect(updatedCollection.itemCount).toBe(1);
});

dbTest("rejects a section from another collection", async ({ db }) => {
	const actorUserId = "capture_boundary_owner";
	const target = await collectionFactory.create({ ownerUserId: actorUserId });
	const other = await collectionFactory.create({ ownerUserId: actorUserId });
	await db.insert(collectionMembers).values([
		{ collectionId: target.id, userId: actorUserId, role: "owner" },
		{ collectionId: other.id, userId: actorUserId, role: "owner" },
	]);
	const otherSection = await collectionNodeFactory.create({
		collectionId: other.id,
		type: "section",
		createdByUserId: actorUserId,
	});

	expect(
		await saveCapture(
			actorUserId,
			{
				id: "40000000-0000-4000-8000-000000000902",
				mutationId: "50000000-0000-4000-8000-000000000902",
				collectionId: target.id,
				sectionId: otherSection.id,
				title: "Wrong parent",
				url: "https://example.com",
			},
			db,
		),
	).toEqual({ status: "not_found" });
});
