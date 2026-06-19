import { eq } from "drizzle-orm";
import {
	getCollectionPublicationStatus,
	publishCollectionSnapshot,
	unpublishCollectionSnapshot,
} from "@/lib/collections/publicationRepository";
import {
	ablyOutbox,
	collectionNodes,
	collections,
	publishedBlocks,
	publishedCollections,
} from "../schema";
import {
	collectionFactory,
	collectionMemberFactory,
	collectionNodeFactory,
} from "../testing/factories";
import { dbTest, expect } from "../testing/vitest";

async function createPublishableCollection(ownerUserId: string) {
	const collection = await collectionFactory.create({
		ownerUserId,
		name: "Lighting ideas",
		description: "Private working copy",
		color: "#6366f1",
		publicLayout: "feature",
		copyPolicy: "public",
		version: 3,
	});
	await collectionMemberFactory.create({
		collectionId: collection.id,
		userId: ownerUserId,
		role: "owner",
	});
	const section = await collectionNodeFactory.create({
		collectionId: collection.id,
		type: "section",
		title: "Desk lamps",
		positionKey: "a0",
		createdByUserId: ownerUserId,
	});
	await collectionNodeFactory.create({
		collectionId: collection.id,
		parentId: section.id,
		type: "product",
		title: "Brass lamp",
		properties: {
			url: "https://example.com/lamp",
			price: "$129",
			imageUrl: "https://example.com/lamp.jpg",
		},
		positionKey: "a0",
		createdByUserId: ownerUserId,
	});
	await collectionNodeFactory.create({
		collectionId: collection.id,
		type: "text",
		title: "Why these",
		properties: { body: "Warm task lighting." },
		positionKey: "a1",
		createdByUserId: ownerUserId,
	});
	return collection;
}

dbTest(
	"publishes and replaces an isolated collection snapshot",
	async ({ db }) => {
		const collection = await createPublishableCollection("publish_owner");
		const first = await publishCollectionSnapshot(
			"publish_owner",
			collection.id,
			{
				slug: "lighting-ideas",
				username: "dan",
				layout: "feature",
				allowCloning: true,
			},
			db,
		);
		expect(first.status).toBe("ok");
		if (first.status !== "ok") throw new Error("Expected publication");

		const firstBlocks = await db
			.select()
			.from(publishedBlocks)
			.where(eq(publishedBlocks.collectionId, first.value.id));
		expect(firstBlocks).toHaveLength(3);
		expect(firstBlocks.map((block) => block.type).sort()).toEqual([
			"product",
			"section",
			"text",
		]);

		await db
			.update(collections)
			.set({ name: "Updated lighting", version: 4 })
			.where(eq(collections.id, collection.id));
		await db
			.update(collectionNodes)
			.set({ title: "Updated brass lamp", version: 2 })
			.where(eq(collectionNodes.type, "product"));
		const [updatedCollection] = await db
			.select({ version: collections.version })
			.from(collections)
			.where(eq(collections.id, collection.id));

		const staleStatus = await getCollectionPublicationStatus(
			"publish_owner",
			collection.id,
			db,
		);
		expect(staleStatus).toMatchObject({
			status: "ok",
			value: {
				id: first.value.id,
				sourceVersion: first.value.sourceVersion,
				hasUnpublishedChanges: true,
			},
		});

		const replacement = await publishCollectionSnapshot(
			"publish_owner",
			collection.id,
			{
				slug: "lighting-ideas",
				username: "dan",
				layout: "minimal",
				allowCloning: false,
			},
			db,
		);
		expect(replacement).toMatchObject({
			status: "ok",
			value: {
				id: first.value.id,
				sourceVersion: updatedCollection.version,
				hasUnpublishedChanges: false,
			},
		});
		const [publication] = await db
			.select()
			.from(publishedCollections)
			.where(eq(publishedCollections.id, first.value.id));
		expect(publication).toMatchObject({
			name: "Updated lighting",
			layout: "minimal",
			allowCloning: false,
		});
		const publicationEvents = await db
			.select()
			.from(ablyOutbox)
			.where(eq(ablyOutbox.channel, `collection:${collection.id}`));
		expect(publicationEvents.map((event) => event.name)).toEqual([
			"publication.updated",
			"publication.updated",
		]);
	},
);

dbTest("enforces publish roles and public slug uniqueness", async ({ db }) => {
	const first = await createPublishableCollection("first_publish_owner");
	const second = await createPublishableCollection("first_publish_owner");
	await collectionMemberFactory.create({
		collectionId: first.id,
		userId: "publish_viewer",
		role: "viewer",
	});

	expect(
		await publishCollectionSnapshot(
			"publish_viewer",
			first.id,
			{
				slug: "private",
				layout: "minimal",
				allowCloning: false,
			},
			db,
		),
	).toEqual({ status: "forbidden" });

	await publishCollectionSnapshot(
		"first_publish_owner",
		first.id,
		{
			slug: "shared-slug",
			layout: "minimal",
			allowCloning: true,
		},
		db,
	);
	expect(
		await publishCollectionSnapshot(
			"first_publish_owner",
			second.id,
			{
				slug: "shared-slug",
				layout: "minimal",
				allowCloning: true,
			},
			db,
		),
	).toEqual({ status: "slug_conflict" });
});

dbTest("unpublishes only the public snapshot", async ({ db }) => {
	const collection = await createPublishableCollection("unpublish_owner");
	const published = await publishCollectionSnapshot(
		"unpublish_owner",
		collection.id,
		{
			slug: "temporary",
			layout: "minimal",
			allowCloning: true,
		},
		db,
	);
	if (published.status !== "ok") throw new Error("Expected publication");

	expect(
		await unpublishCollectionSnapshot("unpublish_owner", collection.id, db),
	).toEqual({ status: "ok", value: { unpublished: true } });
	expect(
		await db
			.select()
			.from(publishedCollections)
			.where(eq(publishedCollections.id, published.value.id)),
	).toEqual([]);
	expect(
		await db
			.select()
			.from(collections)
			.where(eq(collections.id, collection.id)),
	).toHaveLength(1);
	const events = await db
		.select()
		.from(ablyOutbox)
		.where(eq(ablyOutbox.channel, `collection:${collection.id}`));
	expect(events.map((event) => event.name)).toEqual([
		"publication.updated",
		"publication.deleted",
	]);
});

dbTest(
	"adopts an existing Postgres publication by legacy source id",
	async ({ db }) => {
		const collection = await createPublishableCollection("adoption_owner");
		await db
			.update(collections)
			.set({ legacyJazzId: "co_zLegacyPublicationSource" })
			.where(eq(collections.id, collection.id));
		const [legacyPublication] = await db
			.insert(publishedCollections)
			.values({
				sourceJazzId: "co_zLegacyPublicationSource",
				ownerClerkId: "adoption_owner",
				username: "dan",
				slug: "existing-url",
				name: "Existing public snapshot",
			})
			.returning();

		const result = await publishCollectionSnapshot(
			"adoption_owner",
			collection.id,
			{
				slug: "existing-url",
				username: "dan",
				layout: "minimal",
				allowCloning: true,
			},
			db,
		);
		expect(result).toMatchObject({
			status: "ok",
			value: { id: legacyPublication.id },
		});
		const [adopted] = await db
			.select()
			.from(publishedCollections)
			.where(eq(publishedCollections.id, legacyPublication.id));
		expect(adopted.sourceCollectionId).toBe(collection.id);
	},
);
