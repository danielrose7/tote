import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import {
	collectionMembers,
	collectionNodes,
	collections,
} from "../../db/schema";
import {
	type CollectionDatabase,
	createCollectionNode,
	type MutationResult,
} from "./repository";

export type CaptureCollection = {
	id: string;
	name: string;
	color: string | null;
	role: "owner" | "admin" | "editor";
	sections: Array<{ id: string; name: string }>;
};

export async function listCaptureCollections(
	actorUserId: string,
	database: CollectionDatabase,
): Promise<CaptureCollection[]> {
	const rows = await database
		.select({
			collectionId: collections.id,
			name: collections.name,
			color: collections.color,
			positionKey: collections.positionKey,
			role: collectionMembers.role,
			sectionId: collectionNodes.id,
			sectionName: collectionNodes.title,
			sectionPositionKey: collectionNodes.positionKey,
		})
		.from(collectionMembers)
		.innerJoin(collections, eq(collections.id, collectionMembers.collectionId))
		.leftJoin(
			collectionNodes,
			and(
				eq(collectionNodes.collectionId, collections.id),
				eq(collectionNodes.type, "section"),
				isNull(collectionNodes.deletedAt),
			),
		)
		.where(
			and(
				eq(collectionMembers.userId, actorUserId),
				inArray(collectionMembers.role, ["owner", "admin", "editor"]),
				isNull(collectionMembers.revokedAt),
				isNull(collections.deletedAt),
			),
		)
		.orderBy(asc(collections.positionKey), asc(collectionNodes.positionKey));

	const byId = new Map<string, CaptureCollection>();
	for (const row of rows) {
		let collection = byId.get(row.collectionId);
		if (!collection) {
			collection = {
				id: row.collectionId,
				name: row.name,
				color: row.color,
				role: row.role as CaptureCollection["role"],
				sections: [],
			};
			byId.set(row.collectionId, collection);
		}
		if (row.sectionId) {
			collection.sections.push({
				id: row.sectionId,
				name: row.sectionName || "Unnamed section",
			});
		}
	}
	return Array.from(byId.values());
}

export type SaveCaptureInput = {
	id: string;
	mutationId: string;
	collectionId: string;
	sectionId?: string | null;
	title: string;
	url: string;
	imageUrl?: string;
	images?: string[];
	price?: string;
	description?: string;
};

export async function saveCapture(
	actorUserId: string,
	input: SaveCaptureInput,
	database: CollectionDatabase,
): Promise<
	MutationResult<{
		id: string;
		version: number;
		collectionVersion: number;
		itemCount: number;
	}>
> {
	if (input.sectionId) {
		const [section] = await database
			.select({ id: collectionNodes.id })
			.from(collectionNodes)
			.where(
				and(
					eq(collectionNodes.id, input.sectionId),
					eq(collectionNodes.collectionId, input.collectionId),
					eq(collectionNodes.type, "section"),
					isNull(collectionNodes.deletedAt),
				),
			)
			.limit(1);
		if (!section) return { status: "not_found" };
	}

	return createCollectionNode(
		actorUserId,
		input.collectionId,
		{
			id: input.id,
			mutationId: input.mutationId,
			parentId: input.sectionId ?? null,
			type: "product",
			title: input.title,
			properties: {
				url: input.url,
				...(input.imageUrl ? { imageUrl: input.imageUrl } : {}),
				...(input.images?.length ? { images: input.images } : {}),
				...(input.price ? { price: input.price } : {}),
				...(input.description ? { description: input.description } : {}),
			},
			positionKey: `z:${input.id}`,
		},
		database,
	);
}
