import { eq } from "drizzle-orm";
import { copyCollection } from "../../lib/collections/copyRepository";
import {
	ablyOutbox,
	collectionInvites,
	collectionLineage,
	collectionMembers,
	collectionNodes,
	collections,
	publishedCollections,
} from "../schema";
import {
	collectionFactory,
	collectionMemberFactory,
	collectionNodeFactory,
} from "../testing/factories";
import { dbTest, expect } from "../testing/vitest";

async function createCopySource(
	ownerUserId: string,
	copyPolicy: "disabled" | "members" | "public",
) {
	const collection = await collectionFactory.create({
		ownerUserId,
		name: "Lighting ideas",
		description: "A source list",
		color: "#6366f1",
		budgetCents: 45000,
		defaultViewMode: "grid",
		publicLayout: "feature",
		copyPolicy,
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
		properties: { price: "$129" },
		positionKey: "a0",
		createdByUserId: ownerUserId,
	});
	return collection;
}

dbTest(
	"copies a collection graph with isolated ownership and lineage",
	async ({ db }) => {
		const source = await createCopySource("copy_owner", "members");
		await collectionMemberFactory.create({
			collectionId: source.id,
			userId: "copy_viewer",
			role: "viewer",
		});

		const result = await copyCollection(
			"copy_viewer",
			source.id,
			{
				mutationId: "7f094d97-6a69-4f90-bef0-9e0afc92f124",
				name: "My lighting",
			},
			db,
		);
		expect(result.status).toBe("ok");
		if (result.status !== "ok") throw new Error("Expected copy");

		const [copy] = await db
			.select()
			.from(collections)
			.where(eq(collections.id, result.value.id));
		expect(copy).toMatchObject({
			ownerUserId: "copy_viewer",
			name: "My lighting",
			description: source.description,
			color: source.color,
			budgetCents: source.budgetCents,
			defaultViewMode: source.defaultViewMode,
			publicLayout: source.publicLayout,
			copyPolicy: "disabled",
			originType: "copy",
			itemCount: 1,
		});

		const copiedMembers = await db
			.select()
			.from(collectionMembers)
			.where(eq(collectionMembers.collectionId, copy.id));
		expect(copiedMembers).toMatchObject([
			{ userId: "copy_viewer", role: "owner" },
		]);
		const sourceNodes = await db
			.select()
			.from(collectionNodes)
			.where(eq(collectionNodes.collectionId, source.id));
		const copiedNodes = await db
			.select()
			.from(collectionNodes)
			.where(eq(collectionNodes.collectionId, copy.id));
		expect(copiedNodes).toHaveLength(sourceNodes.length);
		expect(copiedNodes.map((node) => node.id)).not.toEqual(
			sourceNodes.map((node) => node.id),
		);
		const copiedSection = copiedNodes.find((node) => node.type === "section");
		const copiedProduct = copiedNodes.find((node) => node.type === "product");
		expect(copiedProduct?.parentId).toBe(copiedSection?.id);
		expect(copiedProduct?.properties).toEqual({ price: "$129" });

		const [lineage] = await db
			.select()
			.from(collectionLineage)
			.where(eq(collectionLineage.childCollectionId, copy.id));
		expect(lineage).toMatchObject({
			relationship: "copied",
			sourceCollectionId: source.id,
			sourceOwnerUserId: "copy_owner",
			sourceNameSnapshot: "Lighting ideas",
			createdByUserId: "copy_viewer",
		});
		expect(
			await db
				.select()
				.from(collectionInvites)
				.where(eq(collectionInvites.collectionId, copy.id)),
		).toEqual([]);
		expect(
			await db
				.select()
				.from(publishedCollections)
				.where(eq(publishedCollections.sourceCollectionId, copy.id)),
		).toEqual([]);
		const [event] = await db
			.select()
			.from(ablyOutbox)
			.where(eq(ablyOutbox.channel, `collection:${copy.id}`));
		expect(event).toMatchObject({
			mutationId: "7f094d97-6a69-4f90-bef0-9e0afc92f124",
			name: "collection.copied",
		});

		await db
			.update(collectionNodes)
			.set({ title: "Changed only in copy" })
			.where(eq(collectionNodes.id, copiedProduct?.id ?? ""));
		const sourceProduct = sourceNodes.find((node) => node.type === "product");
		const [unchangedSourceProduct] = await db
			.select()
			.from(collectionNodes)
			.where(eq(collectionNodes.id, sourceProduct?.id ?? ""));
		expect(unchangedSourceProduct.title).toBe("Brass lamp");
	},
);

dbTest(
	"enforces copy policy while allowing owner duplication",
	async ({ db }) => {
		const source = await createCopySource("policy_owner", "disabled");
		await collectionMemberFactory.create({
			collectionId: source.id,
			userId: "policy_viewer",
			role: "viewer",
		});

		expect(
			await copyCollection(
				"policy_viewer",
				source.id,
				{ mutationId: "826da3e4-d492-43bb-a8fa-0fb7807c615c" },
				db,
			),
		).toEqual({ status: "forbidden" });
		expect(
			await copyCollection(
				"policy_owner",
				source.id,
				{ mutationId: "29000151-6e61-483d-b6bb-bf2c7a7fcfeb" },
				db,
			),
		).toMatchObject({ status: "ok", value: { replayed: false } });
	},
);

dbTest("replays copies and rejects reused mutation ids", async ({ db }) => {
	const source = await createCopySource("replay_owner", "disabled");
	const input = {
		mutationId: "05d0edda-2d5d-43ee-92f8-f459736f099f",
		name: "First copy",
	};
	const first = await copyCollection("replay_owner", source.id, input, db);
	expect(first.status).toBe("ok");
	if (first.status !== "ok") throw new Error("Expected copy");

	expect(await copyCollection("replay_owner", source.id, input, db)).toEqual({
		status: "ok",
		value: { id: first.value.id, replayed: true },
	});
	expect(
		await copyCollection(
			"replay_owner",
			source.id,
			{ ...input, name: "Different copy" },
			db,
		),
	).toEqual({ status: "idempotency_conflict" });
});
