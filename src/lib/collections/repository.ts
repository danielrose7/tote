import { randomUUID } from "node:crypto";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type * as schema from "../../db/schema";
import {
	accountDataSources,
	type Collection,
	type CollectionNode,
	collectionMembers,
	collectionNodes,
	collections,
} from "../../db/schema";
import { db as productionDb } from "../db";
import { roleCan } from "./permissions";

export type CollectionDatabase = PgDatabase<PgQueryResultHKT, typeof schema>;

export type MutationFailure =
	| { status: "not_found" }
	| { status: "forbidden" }
	| { status: "version_conflict" };

export type MutationSuccess<T> = { status: "ok"; value: T };
export type MutationResult<T> = MutationSuccess<T> | MutationFailure;

async function getActiveCollectionAccess(
	actorUserId: string,
	collectionId: string,
	database: CollectionDatabase,
): Promise<{
	collection: Collection;
	role: (typeof collectionMembers.$inferSelect)["role"];
} | null> {
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
				eq(collectionMembers.collectionId, collectionId),
				isNull(collectionMembers.revokedAt),
				isNull(collections.deletedAt),
			),
		)
		.limit(1);

	return access ?? null;
}

async function getCollectionMutationSummary(
	collectionId: string,
	database: CollectionDatabase,
): Promise<{
	collectionVersion: number;
	itemCount: number;
}> {
	const [summary] = await database
		.select({
			collectionVersion: collections.version,
			itemCount: collections.itemCount,
		})
		.from(collections)
		.where(eq(collections.id, collectionId))
		.limit(1);

	if (!summary) {
		throw new Error("Collection disappeared during mutation");
	}

	return summary;
}

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
	database: CollectionDatabase = productionDb,
): Promise<CollectionSummary[]> {
	return database
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
	database: CollectionDatabase = productionDb,
): Promise<CollectionDetail | null> {
	const access = await getActiveCollectionAccess(
		actorUserId,
		collectionId,
		database,
	);

	if (!access) {
		return null;
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

	return {
		...access,
		nodes,
	};
}

export async function getAccountCollectionDataSource(
	actorUserId: string,
	database: CollectionDatabase = productionDb,
): Promise<(typeof accountDataSources.$inferSelect)["dataSource"]> {
	const [account] = await database
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
	database: CollectionDatabase = productionDb,
): Promise<string> {
	const collectionId = input.id ?? randomUUID();

	await database.execute(sql`
		WITH inserted_collection AS (
			INSERT INTO collections (
				id,
				owner_user_id,
				name,
				description,
				color,
				position_key
			) VALUES (
				${collectionId},
				${actorUserId},
				${input.name},
				${input.description ?? null},
				${input.color ?? null},
				${input.positionKey}
			)
			RETURNING id
		)
		INSERT INTO collection_members (collection_id, user_id, role)
		SELECT id, ${actorUserId}, 'owner'::collection_role
		FROM inserted_collection
	`);

	return collectionId;
}

export type UpdateCollectionInput = {
	expectedVersion: number;
	name?: string;
	description?: string | null;
	color?: string | null;
	budgetCents?: number | null;
	defaultViewMode?: "grid" | "table" | null;
	publicLayout?: "minimal" | "feature";
	copyPolicy?: "disabled" | "members" | "public";
	positionKey?: string;
};

export async function updateCollection(
	actorUserId: string,
	collectionId: string,
	input: UpdateCollectionInput,
	database: CollectionDatabase = productionDb,
): Promise<MutationResult<{ version: number }>> {
	const access = await getActiveCollectionAccess(
		actorUserId,
		collectionId,
		database,
	);
	if (!access) {
		return { status: "not_found" };
	}
	if (!roleCan(access.role, "edit")) {
		return { status: "forbidden" };
	}

	const { expectedVersion, ...fields } = input;
	const [updated] = await database
		.update(collections)
		.set({
			...fields,
			version: sql`${collections.version} + 1`,
			updatedAt: new Date(),
		})
		.where(
			and(
				eq(collections.id, collectionId),
				eq(collections.version, expectedVersion),
				isNull(collections.deletedAt),
			),
		)
		.returning({ version: collections.version });

	return updated
		? { status: "ok", value: updated }
		: { status: "version_conflict" };
}

export async function deleteCollection(
	actorUserId: string,
	collectionId: string,
	expectedVersion: number,
	database: CollectionDatabase = productionDb,
): Promise<MutationResult<{ version: number }>> {
	const access = await getActiveCollectionAccess(
		actorUserId,
		collectionId,
		database,
	);
	if (!access) {
		return { status: "not_found" };
	}
	if (!roleCan(access.role, "delete")) {
		return { status: "forbidden" };
	}

	const [deleted] = await database
		.update(collections)
		.set({
			deletedAt: new Date(),
			version: sql`${collections.version} + 1`,
			updatedAt: new Date(),
		})
		.where(
			and(
				eq(collections.id, collectionId),
				eq(collections.version, expectedVersion),
				isNull(collections.deletedAt),
			),
		)
		.returning({ version: collections.version });

	return deleted
		? { status: "ok", value: deleted }
		: { status: "version_conflict" };
}

export type CreateCollectionNodeInput = {
	id?: string;
	parentId?: string | null;
	type: CollectionNode["type"];
	title?: string | null;
	properties?: Record<string, unknown>;
	positionKey: string;
};

export async function createCollectionNode(
	actorUserId: string,
	collectionId: string,
	input: CreateCollectionNodeInput,
	database: CollectionDatabase = productionDb,
): Promise<
	MutationResult<{
		id: string;
		version: number;
		collectionVersion: number;
		itemCount: number;
	}>
> {
	const access = await getActiveCollectionAccess(
		actorUserId,
		collectionId,
		database,
	);
	if (!access) {
		return { status: "not_found" };
	}
	if (!roleCan(access.role, "edit")) {
		return { status: "forbidden" };
	}

	const [node] = await database
		.insert(collectionNodes)
		.values({
			id: input.id ?? randomUUID(),
			collectionId,
			parentId: input.parentId,
			type: input.type,
			title: input.title,
			properties: input.properties,
			positionKey: input.positionKey,
			createdByUserId: actorUserId,
		})
		.returning({ id: collectionNodes.id, version: collectionNodes.version });

	return {
		status: "ok",
		value: {
			...node,
			...(await getCollectionMutationSummary(collectionId, database)),
		},
	};
}

export type UpdateCollectionNodeInput = {
	expectedVersion: number;
	parentId?: string | null;
	type?: CollectionNode["type"];
	title?: string | null;
	properties?: Record<string, unknown>;
	positionKey?: string;
};

export async function updateCollectionNode(
	actorUserId: string,
	collectionId: string,
	nodeId: string,
	input: UpdateCollectionNodeInput,
	database: CollectionDatabase = productionDb,
): Promise<
	MutationResult<{
		version: number;
		collectionVersion: number;
		itemCount: number;
	}>
> {
	const access = await getActiveCollectionAccess(
		actorUserId,
		collectionId,
		database,
	);
	if (!access) {
		return { status: "not_found" };
	}
	if (!roleCan(access.role, "edit")) {
		return { status: "forbidden" };
	}

	const { expectedVersion, ...fields } = input;
	const [updated] = await database
		.update(collectionNodes)
		.set({
			...fields,
			version: sql`${collectionNodes.version} + 1`,
			updatedAt: new Date(),
		})
		.where(
			and(
				eq(collectionNodes.id, nodeId),
				eq(collectionNodes.collectionId, collectionId),
				eq(collectionNodes.version, expectedVersion),
				isNull(collectionNodes.deletedAt),
			),
		)
		.returning({ version: collectionNodes.version });

	if (updated) {
		return {
			status: "ok",
			value: {
				...updated,
				...(await getCollectionMutationSummary(collectionId, database)),
			},
		};
	}

	const [existing] = await database
		.select({ id: collectionNodes.id })
		.from(collectionNodes)
		.where(
			and(
				eq(collectionNodes.id, nodeId),
				eq(collectionNodes.collectionId, collectionId),
				isNull(collectionNodes.deletedAt),
			),
		)
		.limit(1);

	return existing ? { status: "version_conflict" } : { status: "not_found" };
}

export async function deleteCollectionNode(
	actorUserId: string,
	collectionId: string,
	nodeId: string,
	expectedVersion: number,
	database: CollectionDatabase = productionDb,
): Promise<
	MutationResult<{
		deletedNodeCount: number;
		collectionVersion: number;
		itemCount: number;
	}>
> {
	const access = await getActiveCollectionAccess(
		actorUserId,
		collectionId,
		database,
	);
	if (!access) {
		return { status: "not_found" };
	}
	if (!roleCan(access.role, "edit")) {
		return { status: "forbidden" };
	}

	const [existing] = await database
		.select({ version: collectionNodes.version })
		.from(collectionNodes)
		.where(
			and(
				eq(collectionNodes.id, nodeId),
				eq(collectionNodes.collectionId, collectionId),
				isNull(collectionNodes.deletedAt),
			),
		)
		.limit(1);

	if (!existing) {
		return { status: "not_found" };
	}
	if (existing.version !== expectedVersion) {
		return { status: "version_conflict" };
	}

	const deleted = (await database.execute<{ id: string }>(sql`
		WITH RECURSIVE subtree AS (
			SELECT id
			FROM collection_nodes
			WHERE id = ${nodeId}
				AND collection_id = ${collectionId}
				AND version = ${expectedVersion}
				AND deleted_at IS NULL

			UNION ALL

			SELECT child.id
			FROM collection_nodes child
			INNER JOIN subtree parent ON child.parent_id = parent.id
			WHERE child.collection_id = ${collectionId}
				AND child.deleted_at IS NULL
		)
		UPDATE collection_nodes
		SET deleted_at = now(),
			version = version + 1,
			updated_at = now()
		WHERE id IN (SELECT id FROM subtree)
		RETURNING id
	`)) as { rows: { id: string }[] };

	if (deleted.rows.length === 0) {
		return { status: "version_conflict" };
	}

	return {
		status: "ok",
		value: {
			deletedNodeCount: deleted.rows.length,
			...(await getCollectionMutationSummary(collectionId, database)),
		},
	};
}
