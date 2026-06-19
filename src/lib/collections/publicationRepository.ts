import { randomUUID } from "node:crypto";
import { and, asc, eq, isNull, or } from "drizzle-orm";
import {
	ablyOutbox,
	collectionMembers,
	collectionNodes,
	collections,
	publishedBlocks,
	publishedCollections,
} from "@/db/schema";
import { db as productionDb } from "../db";
import { withTransactionalDb } from "../transactionalDb";
import { roleCan } from "./permissions";
import type { CollectionDatabase } from "./repository";

export type CollectionPublicationStatus = {
	id: string;
	slug: string;
	username: string | null;
	sourceVersion: number;
	layout: "minimal" | "feature";
	allowCloning: boolean;
	publishedAt: Date;
	updatedAt: Date;
	hasUnpublishedChanges: boolean;
};

export type PublishCollectionInput = {
	slug: string;
	username?: string;
	layout: "minimal" | "feature";
	allowCloning: boolean;
};

export type PublicationMutationResult<T> =
	| { status: "ok"; value: T }
	| { status: "not_found" }
	| { status: "forbidden" }
	| { status: "slug_conflict" };

async function getPublishAccess(
	actorUserId: string,
	collectionId: string,
	database: CollectionDatabase,
) {
	const [access] = await database
		.select({
			collection: collections,
			role: collectionMembers.role,
		})
		.from(collectionMembers)
		.innerJoin(collections, eq(collections.id, collectionMembers.collectionId))
		.where(
			and(
				eq(collectionMembers.collectionId, collectionId),
				eq(collectionMembers.userId, actorUserId),
				isNull(collectionMembers.revokedAt),
				isNull(collections.deletedAt),
			),
		)
		.limit(1);

	return access ?? null;
}

export async function getCollectionPublicationStatus(
	actorUserId: string,
	collectionId: string,
	database: CollectionDatabase = productionDb,
): Promise<PublicationMutationResult<CollectionPublicationStatus | null>> {
	const access = await getPublishAccess(actorUserId, collectionId, database);
	if (!access) return { status: "not_found" };
	if (!roleCan(access.role, "publish")) return { status: "forbidden" };

	const [publication] = await database
		.select()
		.from(publishedCollections)
		.where(eq(publishedCollections.sourceCollectionId, collectionId))
		.limit(1);

	return {
		status: "ok",
		value: publication
			? {
					id: publication.id,
					slug: publication.slug,
					username: publication.username,
					sourceVersion: publication.sourceVersion ?? 0,
					layout: publication.layout as "minimal" | "feature",
					allowCloning: publication.allowCloning,
					publishedAt: publication.publishedAt,
					updatedAt: publication.updatedAt,
					hasUnpublishedChanges:
						(publication.sourceVersion ?? 0) !== access.collection.version,
				}
			: null,
	};
}

function propertyText(
	properties: Record<string, unknown>,
	key: string,
): string | null {
	const value = properties[key];
	return typeof value === "string" || typeof value === "number"
		? String(value)
		: null;
}

async function publishCollectionSnapshotWithDatabase(
	actorUserId: string,
	collectionId: string,
	input: PublishCollectionInput,
	database: CollectionDatabase,
): Promise<PublicationMutationResult<CollectionPublicationStatus>> {
	const access = await getPublishAccess(actorUserId, collectionId, database);
	if (!access) return { status: "not_found" };
	if (!roleCan(access.role, "publish")) return { status: "forbidden" };

	const [existingPublication] = await database
		.select()
		.from(publishedCollections)
		.where(
			access.collection.legacyJazzId
				? or(
						eq(publishedCollections.sourceCollectionId, collectionId),
						eq(
							publishedCollections.sourceJazzId,
							access.collection.legacyJazzId,
						),
					)
				: eq(publishedCollections.sourceCollectionId, collectionId),
		)
		.limit(1);
	const [conflictingPublication] = await database
		.select({ id: publishedCollections.id })
		.from(publishedCollections)
		.where(
			and(
				eq(publishedCollections.ownerClerkId, access.collection.ownerUserId),
				eq(publishedCollections.slug, input.slug),
			),
		)
		.limit(1);
	if (
		conflictingPublication &&
		conflictingPublication.id !== existingPublication?.id
	) {
		return { status: "slug_conflict" };
	}

	const nodes = await database
		.select()
		.from(collectionNodes)
		.where(
			and(
				eq(collectionNodes.collectionId, collectionId),
				isNull(collectionNodes.deletedAt),
			),
		)
		.orderBy(asc(collectionNodes.parentId), asc(collectionNodes.positionKey));

	const publicationValues = {
		sourceCollectionId: collectionId,
		sourceVersion: access.collection.version,
		schemaVersion: 2,
		ownerClerkId: access.collection.ownerUserId,
		username:
			actorUserId === access.collection.ownerUserId
				? (input.username ?? null)
				: (existingPublication?.username ?? null),
		slug: input.slug,
		name: access.collection.name,
		description: access.collection.description,
		color: access.collection.color,
		layout: input.layout,
		allowCloning: input.allowCloning,
		updatedAt: new Date(),
	};
	const [publication] = existingPublication
		? await database
				.update(publishedCollections)
				.set(publicationValues)
				.where(eq(publishedCollections.id, existingPublication.id))
				.returning()
		: await database
				.insert(publishedCollections)
				.values(publicationValues)
				.returning();
	if (!publication) {
		throw new Error("Publication snapshot did not return a row");
	}

	await database
		.delete(publishedBlocks)
		.where(eq(publishedBlocks.collectionId, publication.id));

	const publicationNodeIds = new Map(
		nodes.map((node) => [node.id, randomUUID()]),
	);
	const sortOrderByParent = new Map<string, number>();
	const blockRows = nodes.map((node) => {
		const parentKey = node.parentId ?? "root";
		const sortOrder = sortOrderByParent.get(parentKey) ?? 0;
		sortOrderByParent.set(parentKey, sortOrder + 1);
		const properties = node.properties as Record<string, unknown>;

		return {
			id: publicationNodeIds.get(node.id),
			collectionId: publication.id,
			sourceNodeId: node.id,
			parentBlockId: node.parentId
				? publicationNodeIds.get(node.parentId)
				: null,
			type: node.type,
			sortOrder,
			slotName: node.type === "section" ? node.title : null,
			slotDescription:
				node.type === "section"
					? propertyText(properties, "description")
					: null,
			title: node.title,
			url: propertyText(properties, "url"),
			description:
				node.type === "note" || node.type === "text"
					? propertyText(properties, "body")
					: propertyText(properties, "description"),
			price: propertyText(properties, "price"),
			imageUrl: propertyText(properties, "imageUrl"),
			brand: propertyText(properties, "brand"),
			merchant: propertyText(properties, "merchant"),
			properties,
		};
	});
	if (blockRows.length > 0) {
		await database.insert(publishedBlocks).values(blockRows);
	}

	await database.insert(ablyOutbox).values({
		mutationId: randomUUID(),
		channel: `collection:${collectionId}`,
		name: "publication.updated",
		data: {
			collectionId,
			publicationId: publication.id,
			sourceVersion: publication.sourceVersion,
		},
	});

	return {
		status: "ok",
		value: {
			id: publication.id,
			slug: publication.slug,
			username: publication.username,
			sourceVersion: publication.sourceVersion ?? 0,
			layout: publication.layout as "minimal" | "feature",
			allowCloning: publication.allowCloning,
			publishedAt: publication.publishedAt,
			updatedAt: publication.updatedAt,
			hasUnpublishedChanges: false,
		},
	};
}

export async function publishCollectionSnapshot(
	actorUserId: string,
	collectionId: string,
	input: PublishCollectionInput,
	database?: CollectionDatabase,
): Promise<PublicationMutationResult<CollectionPublicationStatus>> {
	if (database) {
		return publishCollectionSnapshotWithDatabase(
			actorUserId,
			collectionId,
			input,
			database,
		);
	}

	return withTransactionalDb((transactionalDatabase) =>
		transactionalDatabase.transaction((transaction) =>
			publishCollectionSnapshotWithDatabase(
				actorUserId,
				collectionId,
				input,
				transaction,
			),
		),
	);
}

async function unpublishCollectionSnapshotWithDatabase(
	actorUserId: string,
	collectionId: string,
	database: CollectionDatabase,
): Promise<PublicationMutationResult<{ unpublished: true }>> {
	const access = await getPublishAccess(actorUserId, collectionId, database);
	if (!access) return { status: "not_found" };
	if (!roleCan(access.role, "publish")) return { status: "forbidden" };

	const [deletedPublication] = await database
		.delete(publishedCollections)
		.where(eq(publishedCollections.sourceCollectionId, collectionId))
		.returning({ id: publishedCollections.id });
	if (deletedPublication) {
		await database.insert(ablyOutbox).values({
			mutationId: randomUUID(),
			channel: `collection:${collectionId}`,
			name: "publication.deleted",
			data: {
				collectionId,
				publicationId: deletedPublication.id,
			},
		});
	}

	return { status: "ok", value: { unpublished: true } };
}

export async function unpublishCollectionSnapshot(
	actorUserId: string,
	collectionId: string,
	database?: CollectionDatabase,
): Promise<PublicationMutationResult<{ unpublished: true }>> {
	if (database) {
		return unpublishCollectionSnapshotWithDatabase(
			actorUserId,
			collectionId,
			database,
		);
	}

	return withTransactionalDb((transactionalDatabase) =>
		transactionalDatabase.transaction((transaction) =>
			unpublishCollectionSnapshotWithDatabase(
				actorUserId,
				collectionId,
				transaction,
			),
		),
	);
}
