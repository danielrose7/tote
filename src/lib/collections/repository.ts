import { randomUUID } from "node:crypto";
import { and, asc, eq, isNull } from "drizzle-orm";
import {
	type Collection,
	collectionMembers,
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
