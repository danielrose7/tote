import { eq } from "drizzle-orm";
import { collections } from "../schema";
import {
	collectionFactory,
	collectionMemberFactory,
	collectionNodeFactory,
} from "../testing/factories";
import { dbTest, expect } from "../testing/vitest";

dbTest(
	"factory create persists using the active test transaction",
	async ({ db }) => {
		const collection = await collectionFactory.create({
			name: "Factory collection",
		});

		const [persisted] = await db
			.select()
			.from(collections)
			.where(eq(collections.id, collection.id));

		expect(persisted.name).toBe("Factory collection");
	},
);

dbTest(
	"factories compose associations without passing db explicitly",
	async () => {
		const collection = await collectionFactory.create();
		const member = await collectionMemberFactory.create({
			collectionId: collection.id,
			userId: collection.ownerUserId,
			role: "owner",
		});
		const node = await collectionNodeFactory.create({
			collectionId: collection.id,
			createdByUserId: member.userId,
			type: "link",
		});

		expect(member.collectionId).toBe(collection.id);
		expect(node.collectionId).toBe(collection.id);
	},
);

dbTest("factory state rolls back between tests", async ({ db }) => {
	const rows = await db.select().from(collections);

	expect(rows).toHaveLength(1);
	expect(rows[0].name).toBe("Integration Test Collection");
});

dbTest(
	"transient db explicitly overrides the context client",
	async ({ db }) => {
		const collection = await collectionFactory.create(
			{ name: "Explicit database" },
			{ transient: { db } },
		);

		expect(collection.name).toBe("Explicit database");
	},
);
