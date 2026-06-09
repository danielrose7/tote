import { randomUUID } from "node:crypto";
import { Factory } from "fishery";
import {
	type Collection,
	type CollectionMember,
	type CollectionNode,
	collectionMembers,
	collectionNodes,
	collections,
} from "../schema";
import { getTestDatabase, type TestDatabase } from "./context";

type DatabaseTransient = {
	db?: TestDatabase;
};

type NewCollectionFactory = typeof collections.$inferInsert;
type NewMemberFactory = typeof collectionMembers.$inferInsert;
type NewNodeFactory = typeof collectionNodes.$inferInsert;

export const collectionFactory = Factory.define<
	NewCollectionFactory,
	DatabaseTransient,
	Collection
>(({ sequence, transientParams, onCreate }) => {
	onCreate(async (attributes) => {
		const database = transientParams.db ?? getTestDatabase();
		const [collection] = await database
			.insert(collections)
			.values(attributes)
			.returning();
		return collection;
	});

	return {
		id: randomUUID(),
		ownerUserId: `owner_${sequence}`,
		name: `Collection ${sequence}`,
		positionKey: `a${sequence}`,
	};
});

export const collectionMemberFactory = Factory.define<
	NewMemberFactory,
	DatabaseTransient,
	CollectionMember
>(({ sequence, transientParams, onCreate }) => {
	onCreate(async (attributes) => {
		const database = transientParams.db ?? getTestDatabase();
		const [member] = await database
			.insert(collectionMembers)
			.values(attributes)
			.returning();
		return member;
	});

	return {
		collectionId: randomUUID(),
		userId: `member_${sequence}`,
		role: "viewer",
	};
});

export const collectionNodeFactory = Factory.define<
	NewNodeFactory,
	DatabaseTransient,
	CollectionNode
>(({ sequence, transientParams, onCreate }) => {
	onCreate(async (attributes) => {
		const database = transientParams.db ?? getTestDatabase();
		const [node] = await database
			.insert(collectionNodes)
			.values(attributes)
			.returning();
		return node;
	});

	return {
		id: randomUUID(),
		collectionId: randomUUID(),
		type: "product",
		title: `Node ${sequence}`,
		properties: {},
		positionKey: `a${sequence}`,
		createdByUserId: `user_${sequence}`,
	};
});
