import { randomUUID } from "node:crypto";
import { and, asc, eq, isNull } from "drizzle-orm";
import {
	ablyOutbox,
	collectionLineage,
	collectionMembers,
	collectionMutationReceipts,
	collectionNodes,
	collections,
	publishedBlocks,
	publishedCollections,
} from "../../db/schema";
import { withTransactionalDb } from "../transactionalDb";
import { fingerprintMutationRequest } from "./idempotency";
import type { CollectionDatabase } from "./repository";

export type CopyCollectionInput = {
	mutationId: string;
	name?: string;
};

export type CopyCollectionResult =
	| { status: "ok"; value: { id: string; replayed: boolean } }
	| { status: "not_found" }
	| { status: "forbidden" }
	| { status: "idempotency_conflict" };

const operation = "collection.copy.v1";
const publicOperation = "publication.copy.v1";

async function getCopyReceipt(
	actorUserId: string,
	mutationId: string,
	database: CollectionDatabase,
) {
	const [receipt] = await database
		.select({
			operation: collectionMutationReceipts.operation,
			requestFingerprint: collectionMutationReceipts.requestFingerprint,
			response: collectionMutationReceipts.response,
		})
		.from(collectionMutationReceipts)
		.where(
			and(
				eq(collectionMutationReceipts.userId, actorUserId),
				eq(collectionMutationReceipts.mutationId, mutationId),
			),
		)
		.limit(1);
	return receipt;
}

async function copyCollectionWithDatabase(
	actorUserId: string,
	sourceCollectionId: string,
	input: CopyCollectionInput,
	database: CollectionDatabase,
): Promise<CopyCollectionResult> {
	const requestFingerprint = fingerprintMutationRequest({
		sourceCollectionId,
		name: input.name,
	});
	const existingReceipt = await getCopyReceipt(
		actorUserId,
		input.mutationId,
		database,
	);
	if (existingReceipt) {
		if (
			existingReceipt.operation !== operation ||
			existingReceipt.requestFingerprint !== requestFingerprint
		) {
			return { status: "idempotency_conflict" };
		}
		return {
			status: "ok",
			value: {
				id: existingReceipt.response.id as string,
				replayed: true,
			},
		};
	}

	const [access] = await database
		.select({
			collection: collections,
			role: collectionMembers.role,
		})
		.from(collectionMembers)
		.innerJoin(collections, eq(collections.id, collectionMembers.collectionId))
		.where(
			and(
				eq(collectionMembers.userId, actorUserId),
				eq(collectionMembers.collectionId, sourceCollectionId),
				isNull(collectionMembers.revokedAt),
				isNull(collections.deletedAt),
			),
		)
		.limit(1);
	if (!access) return { status: "not_found" };
	if (
		access.role !== "owner" &&
		!["members", "public"].includes(access.collection.copyPolicy)
	) {
		return { status: "forbidden" };
	}

	const sourceNodes = await database
		.select()
		.from(collectionNodes)
		.where(
			and(
				eq(collectionNodes.collectionId, sourceCollectionId),
				isNull(collectionNodes.deletedAt),
			),
		)
		.orderBy(asc(collectionNodes.parentId), asc(collectionNodes.positionKey));

	const copyId = randomUUID();
	const copyName = (
		input.name?.trim() || `Copy of ${access.collection.name}`
	).slice(0, 200);
	await database.insert(collections).values({
		id: copyId,
		ownerUserId: actorUserId,
		name: copyName,
		description: access.collection.description,
		color: access.collection.color,
		budgetCents: access.collection.budgetCents,
		defaultViewMode: access.collection.defaultViewMode,
		publicLayout: access.collection.publicLayout,
		copyPolicy: "disabled",
		positionKey: `z${Date.now().toString(36)}:${copyId}`,
		originType: "copy",
	});
	await database.insert(collectionMembers).values({
		collectionId: copyId,
		userId: actorUserId,
		role: "owner",
	});

	const copiedNodeIds = new Map(
		sourceNodes.map((sourceNode) => [sourceNode.id, randomUUID()]),
	);
	const copiedNodeValues = sourceNodes.map((sourceNode) => ({
		id: copiedNodeIds.get(sourceNode.id),
		collectionId: copyId,
		parentId: sourceNode.parentId
			? copiedNodeIds.get(sourceNode.parentId)
			: null,
		type: sourceNode.type,
		title: sourceNode.title,
		properties: sourceNode.properties,
		positionKey: sourceNode.positionKey,
		createdByUserId: actorUserId,
	}));
	const topLevelNodes = copiedNodeValues.filter(
		(node) => node.parentId === null,
	);
	const childNodes = copiedNodeValues.filter((node) => node.parentId !== null);
	if (topLevelNodes.length > 0) {
		await database.insert(collectionNodes).values(topLevelNodes);
	}
	if (childNodes.length > 0) {
		await database.insert(collectionNodes).values(childNodes);
	}

	await database.insert(collectionLineage).values({
		childCollectionId: copyId,
		relationship: "copied",
		sourceCollectionId,
		sourceOwnerUserId: access.collection.ownerUserId,
		sourceVersion: access.collection.version,
		sourceNameSnapshot: access.collection.name,
		sourceRef: `collection:${sourceCollectionId}`,
		createdByUserId: actorUserId,
	});
	await database.insert(ablyOutbox).values({
		mutationId: input.mutationId,
		channel: `collection:${copyId}`,
		name: "collection.copied",
		data: {
			collectionId: copyId,
			sourceCollectionId,
			sourceVersion: access.collection.version,
		},
	});
	await database.insert(collectionMutationReceipts).values({
		userId: actorUserId,
		mutationId: input.mutationId,
		operation,
		requestFingerprint,
		response: { id: copyId },
		expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1_000),
	});

	return { status: "ok", value: { id: copyId, replayed: false } };
}

export async function copyCollection(
	actorUserId: string,
	sourceCollectionId: string,
	input: CopyCollectionInput,
	database?: CollectionDatabase,
): Promise<CopyCollectionResult> {
	if (database) {
		return copyCollectionWithDatabase(
			actorUserId,
			sourceCollectionId,
			input,
			database,
		);
	}

	return withTransactionalDb((transactionalDatabase) =>
		transactionalDatabase.transaction(
			(transaction) =>
				copyCollectionWithDatabase(
					actorUserId,
					sourceCollectionId,
					input,
					transaction,
				),
			{ isolationLevel: "repeatable read" },
		),
	);
}

async function copyPublishedCollectionWithDatabase(
	actorUserId: string,
	publicationId: string,
	input: CopyCollectionInput,
	database: CollectionDatabase,
): Promise<CopyCollectionResult> {
	const requestFingerprint = fingerprintMutationRequest({
		publicationId,
		name: input.name,
	});
	const existingReceipt = await getCopyReceipt(
		actorUserId,
		input.mutationId,
		database,
	);
	if (existingReceipt) {
		if (
			existingReceipt.operation !== publicOperation ||
			existingReceipt.requestFingerprint !== requestFingerprint
		) {
			return { status: "idempotency_conflict" };
		}
		return {
			status: "ok",
			value: {
				id: existingReceipt.response.id as string,
				replayed: true,
			},
		};
	}

	const [publication] = await database
		.select()
		.from(publishedCollections)
		.where(eq(publishedCollections.id, publicationId))
		.limit(1);
	if (!publication) return { status: "not_found" };
	if (!publication.allowCloning) return { status: "forbidden" };

	const publishedNodes = await database
		.select()
		.from(publishedBlocks)
		.where(eq(publishedBlocks.collectionId, publicationId))
		.orderBy(
			asc(publishedBlocks.parentBlockId),
			asc(publishedBlocks.sortOrder),
		);
	const copyId = randomUUID();
	const copyName = (input.name?.trim() || `Copy of ${publication.name}`).slice(
		0,
		200,
	);
	await database.insert(collections).values({
		id: copyId,
		ownerUserId: actorUserId,
		name: copyName,
		description: publication.description,
		color: publication.color,
		publicLayout: publication.layout as "minimal" | "feature",
		copyPolicy: "disabled",
		positionKey: `z${Date.now().toString(36)}:${copyId}`,
		originType: "copy",
	});
	await database.insert(collectionMembers).values({
		collectionId: copyId,
		userId: actorUserId,
		role: "owner",
	});

	const copiedNodeIds = new Map(
		publishedNodes.map((publishedNode) => [publishedNode.id, randomUUID()]),
	);
	const copiedNodeValues = publishedNodes.map((publishedNode) => {
		const type = publishedNode.type === "slot" ? "section" : publishedNode.type;
		const properties = {
			...(publishedNode.properties ?? {}),
			...(publishedNode.url ? { url: publishedNode.url } : {}),
			...(publishedNode.description
				? type === "note" || type === "text"
					? { body: publishedNode.description }
					: { description: publishedNode.description }
				: {}),
			...(publishedNode.price ? { price: publishedNode.price } : {}),
			...(publishedNode.imageUrl ? { imageUrl: publishedNode.imageUrl } : {}),
			...(publishedNode.brand ? { brand: publishedNode.brand } : {}),
			...(publishedNode.merchant ? { merchant: publishedNode.merchant } : {}),
		};
		return {
			id: copiedNodeIds.get(publishedNode.id),
			collectionId: copyId,
			parentId: publishedNode.parentBlockId
				? copiedNodeIds.get(publishedNode.parentBlockId)
				: null,
			type: type as "section" | "product" | "link" | "photo" | "note" | "text",
			title:
				type === "section"
					? (publishedNode.slotName ?? publishedNode.title)
					: publishedNode.title,
			properties:
				type === "section" && publishedNode.slotDescription
					? { ...properties, description: publishedNode.slotDescription }
					: properties,
			positionKey: `p${String(publishedNode.sortOrder).padStart(8, "0")}`,
			createdByUserId: actorUserId,
		};
	});
	const topLevelNodes = copiedNodeValues.filter(
		(node) => node.parentId === null,
	);
	const childNodes = copiedNodeValues.filter((node) => node.parentId !== null);
	if (topLevelNodes.length > 0) {
		await database.insert(collectionNodes).values(topLevelNodes);
	}
	if (childNodes.length > 0) {
		await database.insert(collectionNodes).values(childNodes);
	}

	await database.insert(collectionLineage).values({
		childCollectionId: copyId,
		relationship: "copied",
		sourceCollectionId: publication.sourceCollectionId,
		sourcePublicationId: publication.id,
		sourceOwnerUserId: publication.ownerClerkId,
		sourceVersion: publication.sourceVersion,
		sourceNameSnapshot: publication.name,
		sourceRef: `publication:${publication.id}`,
		createdByUserId: actorUserId,
	});
	await database.insert(ablyOutbox).values({
		mutationId: input.mutationId,
		channel: `collection:${copyId}`,
		name: "collection.copied",
		data: {
			collectionId: copyId,
			sourcePublicationId: publication.id,
			sourceVersion: publication.sourceVersion,
		},
	});
	await database.insert(collectionMutationReceipts).values({
		userId: actorUserId,
		mutationId: input.mutationId,
		operation: publicOperation,
		requestFingerprint,
		response: { id: copyId },
		expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1_000),
	});

	return { status: "ok", value: { id: copyId, replayed: false } };
}

export async function copyPublishedCollection(
	actorUserId: string,
	publicationId: string,
	input: CopyCollectionInput,
	database?: CollectionDatabase,
): Promise<CopyCollectionResult> {
	if (database) {
		return copyPublishedCollectionWithDatabase(
			actorUserId,
			publicationId,
			input,
			database,
		);
	}

	return withTransactionalDb((transactionalDatabase) =>
		transactionalDatabase.transaction(
			(transaction) =>
				copyPublishedCollectionWithDatabase(
					actorUserId,
					publicationId,
					input,
					transaction,
				),
			{ isolationLevel: "repeatable read" },
		),
	);
}
