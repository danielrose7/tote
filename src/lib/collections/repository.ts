import { randomUUID } from "node:crypto";
import { and, asc, eq, isNull } from "drizzle-orm";
import {
	accountDataSources,
	type Collection,
	type CollectionNode,
	collectionMembers,
	collectionNodes,
	collections,
} from "../../db/schema";
import { db } from "../db";

export type CollectionSummary = Pick<
	Collection,
	| "id"
	| "ownerUserId"
	| "name"
	| "description"
	| "color"
	| "itemCount"
	| "positionKey"
	| "updatedAt"
> & {
	role: (typeof collectionMembers.$inferSelect)["role"];
};

export async function listCollectionSummaries(
	actorUserId: string,
): Promise<CollectionSummary[]> {
	return db
		.select({
			id: collections.id,
			ownerUserId: collections.ownerUserId,
			name: collections.name,
			description: collections.description,
			color: collections.color,
			itemCount: collections.itemCount,
			positionKey: collections.positionKey,
			updatedAt: collections.updatedAt,
			role: collectionMembers.role,
		})
		.from(collectionMembers)
		.innerJoin(collections, eq(collections.id, collectionMembers.collectionId))
		.where(
			and(
				eq(collectionMembers.userId, actorUserId),
				isNull(collectionMembers.revokedAt),
				isNull(collections.deletedAt),
			),
		)
		.orderBy(asc(collections.positionKey));
}

export type CollectionDetail = {
	collection: Collection;
	role: (typeof collectionMembers.$inferSelect)["role"];
	nodes: CollectionNode[];
};

export async function getCollectionDetail(
	actorUserId: string,
	collectionId: string,
): Promise<CollectionDetail | null> {
	const [access] = await db
		.select({
			collection: collections,
			role: collectionMembers.role,
		})
		.from(collectionMembers)
		.innerJoin(collections, eq(collections.id, collectionMembers.collectionId))
		.where(
			and(
				eq(collectionMembers.userId, actorUserId),
				eq(collectionMembers.collectionId, collectionId),
				isNull(collectionMembers.revokedAt),
				isNull(collections.deletedAt),
			),
		)
		.limit(1);

	if (!access) {
		return null;
	}

	const nodes = await db
		.select()
		.from(collectionNodes)
		.where(
			and(
				eq(collectionNodes.collectionId, collectionId),
				isNull(collectionNodes.deletedAt),
			),
		)
		.orderBy(asc(collectionNodes.parentId), asc(collectionNodes.positionKey));

	return {
		...access,
		nodes,
	};
}

export async function getAccountCollectionDataSource(
	actorUserId: string,
): Promise<(typeof accountDataSources.$inferSelect)["dataSource"]> {
	const [account] = await db
		.select({ dataSource: accountDataSources.dataSource })
		.from(accountDataSources)
		.where(eq(accountDataSources.userId, actorUserId))
		.limit(1);

	return account?.dataSource ?? "classic_jazz";
}

export type CreateCollectionInput = {
	id?: string;
	name: string;
	description?: string;
	color?: string;
	positionKey: string;
};

export async function createCollection(
	actorUserId: string,
	input: CreateCollectionInput,
): Promise<string> {
	const collectionId = input.id ?? randomUUID();

	await db.batch([
		db.insert(collections).values({
			id: collectionId,
			ownerUserId: actorUserId,
			name: input.name,
			description: input.description,
			color: input.color,
			positionKey: input.positionKey,
		}),
		db.insert(collectionMembers).values({
			collectionId,
			userId: actorUserId,
			role: "owner",
		}),
	]);

	return collectionId;
}
