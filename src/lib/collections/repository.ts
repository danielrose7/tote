import { randomUUID } from "node:crypto";
import { and, asc, eq, isNull, type SQL, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type * as schema from "../../db/schema";
import {
	accountDataSources,
	type Collection,
	type CollectionNode,
	collectionMembers,
	collectionMutationReceipts,
	collectionNodes,
	collections,
} from "../../db/schema";
import { db as productionDb } from "../db";
import { fingerprintMutationRequest } from "./idempotency";
import { roleCan } from "./permissions";

export type CollectionDatabase = PgDatabase<PgQueryResultHKT, typeof schema>;

export type MutationFailure =
	| { status: "not_found" }
	| { status: "forbidden" }
	| { status: "version_conflict" }
	| { status: "idempotency_conflict" };

export type MutationSuccess<T> = {
	status: "ok";
	value: T;
	replayed?: true;
};
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
	mutationId?: string;
	name: string;
	description?: string;
	color?: string;
	positionKey: string;
};

export type CreateCollectionResult =
	| { status: "created"; id: string }
	| { status: "replayed"; id: string }
	| { status: "idempotency_conflict" };

export async function createCollection(
	actorUserId: string,
	input: CreateCollectionInput,
	database: CollectionDatabase = productionDb,
): Promise<CreateCollectionResult> {
	if (input.mutationId && !input.id) {
		throw new Error(
			"Idempotent collection creation requires a client-generated id",
		);
	}

	const collectionId = input.id ?? randomUUID();
	if (!input.mutationId) {
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

		return { status: "created", id: collectionId };
	}

	const operation = "collection.create.v1";
	const requestFingerprint = fingerprintMutationRequest({
		id: collectionId,
		name: input.name,
		description: input.description ?? null,
		color: input.color ?? null,
		positionKey: input.positionKey,
	});
	const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1_000);

	const existing = await getCollectionMutationReceipt(
		actorUserId,
		input.mutationId,
		database,
	);
	if (existing) {
		if (
			existing.operation !== operation ||
			existing.requestFingerprint !== requestFingerprint
		) {
			return { status: "idempotency_conflict" };
		}
		return { status: "replayed", id: existing.response.id as string };
	}

	try {
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
		),
		inserted_member AS (
			INSERT INTO collection_members (collection_id, user_id, role)
			SELECT id, ${actorUserId}, 'owner'::collection_role
			FROM inserted_collection
			RETURNING collection_id
		)
		INSERT INTO collection_mutation_receipts (
			user_id,
			mutation_id,
			operation,
			request_fingerprint,
			response,
			expires_at
		)
		SELECT
			${actorUserId},
			${input.mutationId},
			${operation},
			${requestFingerprint},
			jsonb_build_object('id', collection_id),
			${expiresAt}
		FROM inserted_member
		`);
	} catch (error) {
		const concurrentReceipt = await getCollectionMutationReceipt(
			actorUserId,
			input.mutationId,
			database,
		);
		if (
			concurrentReceipt?.operation === operation &&
			concurrentReceipt.requestFingerprint === requestFingerprint
		) {
			return {
				status: "replayed",
				id: concurrentReceipt.response.id as string,
			};
		}
		throw error;
	}

	return { status: "created", id: collectionId };
}

async function getCollectionMutationReceipt(
	userId: string,
	mutationId: string,
	database: CollectionDatabase,
): Promise<
	| {
			operation: string;
			requestFingerprint: string;
			response: Record<string, unknown>;
	  }
	| undefined
> {
	const [receipt] = await database
		.select({
			operation: collectionMutationReceipts.operation,
			requestFingerprint: collectionMutationReceipts.requestFingerprint,
			response: collectionMutationReceipts.response,
		})
		.from(collectionMutationReceipts)
		.where(
			and(
				eq(collectionMutationReceipts.userId, userId),
				eq(collectionMutationReceipts.mutationId, mutationId),
			),
		)
		.limit(1);

	return receipt;
}

export type UpdateCollectionInput = {
	expectedVersion: number;
	mutationId?: string;
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
	const operation = "collection.update.v1";
	const requestFingerprint = input.mutationId
		? fingerprintMutationRequest({
				collectionId,
				...input,
				mutationId: undefined,
			})
		: undefined;

	if (input.mutationId && requestFingerprint) {
		const existing = await getCollectionMutationReceipt(
			actorUserId,
			input.mutationId,
			database,
		);
		if (existing) {
			if (
				existing.operation !== operation ||
				existing.requestFingerprint !== requestFingerprint
			) {
				return { status: "idempotency_conflict" };
			}
			return {
				status: "ok",
				value: { version: existing.response.version as number },
				replayed: true,
			};
		}
	}

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

	const { expectedVersion, mutationId, ...fields } = input;
	if (mutationId && requestFingerprint) {
		const assignments: SQL[] = [];
		if (fields.name !== undefined) {
			assignments.push(sql`name = ${fields.name}`);
		}
		if (fields.description !== undefined) {
			assignments.push(sql`description = ${fields.description}`);
		}
		if (fields.color !== undefined) {
			assignments.push(sql`color = ${fields.color}`);
		}
		if (fields.budgetCents !== undefined) {
			assignments.push(sql`budget_cents = ${fields.budgetCents}`);
		}
		if (fields.defaultViewMode !== undefined) {
			assignments.push(sql`default_view_mode = ${fields.defaultViewMode}`);
		}
		if (fields.publicLayout !== undefined) {
			assignments.push(sql`public_layout = ${fields.publicLayout}`);
		}
		if (fields.copyPolicy !== undefined) {
			assignments.push(sql`copy_policy = ${fields.copyPolicy}`);
		}
		if (fields.positionKey !== undefined) {
			assignments.push(sql`position_key = ${fields.positionKey}`);
		}
		assignments.push(sql`version = version + 1`, sql`updated_at = now()`);

		const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1_000);
		try {
			const result = (await database.execute<{ response: { version: number } }>(
				sql`
					WITH updated AS (
						UPDATE collections
						SET ${sql.join(assignments, sql`, `)}
						WHERE id = ${collectionId}
							AND version = ${expectedVersion}
							AND deleted_at IS NULL
						RETURNING version
					),
					inserted_receipt AS (
						INSERT INTO collection_mutation_receipts (
							user_id,
							mutation_id,
							operation,
							request_fingerprint,
							response,
							expires_at
						)
						SELECT
							${actorUserId},
							${mutationId},
							${operation},
							${requestFingerprint},
							jsonb_build_object('version', version),
							${expiresAt}
						FROM updated
						RETURNING response
					)
					SELECT response
					FROM inserted_receipt
				`,
			)) as { rows: { response: { version: number } }[] };

			const receipt = result.rows[0];
			return receipt
				? { status: "ok", value: receipt.response }
				: { status: "version_conflict" };
		} catch (error) {
			const concurrentReceipt = await getCollectionMutationReceipt(
				actorUserId,
				mutationId,
				database,
			);
			if (concurrentReceipt) {
				if (
					concurrentReceipt.operation !== operation ||
					concurrentReceipt.requestFingerprint !== requestFingerprint
				) {
					return { status: "idempotency_conflict" };
				}
				return {
					status: "ok",
					value: { version: concurrentReceipt.response.version as number },
					replayed: true,
				};
			}
			throw error;
		}
	}

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

export type DeleteCollectionInput = {
	expectedVersion: number;
	mutationId?: string;
};

export async function deleteCollection(
	actorUserId: string,
	collectionId: string,
	input: DeleteCollectionInput,
	database: CollectionDatabase = productionDb,
): Promise<MutationResult<{ version: number }>> {
	const operation = "collection.delete.v1";
	const requestFingerprint = input.mutationId
		? fingerprintMutationRequest({
				collectionId,
				expectedVersion: input.expectedVersion,
			})
		: undefined;

	if (input.mutationId && requestFingerprint) {
		const existing = await getCollectionMutationReceipt(
			actorUserId,
			input.mutationId,
			database,
		);
		if (existing) {
			if (
				existing.operation !== operation ||
				existing.requestFingerprint !== requestFingerprint
			) {
				return { status: "idempotency_conflict" };
			}
			return {
				status: "ok",
				value: { version: existing.response.version as number },
				replayed: true,
			};
		}
	}

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

	const { expectedVersion, mutationId } = input;
	if (mutationId && requestFingerprint) {
		const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1_000);
		try {
			const result = (await database.execute<{ response: { version: number } }>(
				sql`
					WITH deleted AS (
						UPDATE collections
						SET deleted_at = now(),
							version = version + 1,
							updated_at = now()
						WHERE id = ${collectionId}
							AND version = ${expectedVersion}
							AND deleted_at IS NULL
						RETURNING version
					),
					inserted_receipt AS (
						INSERT INTO collection_mutation_receipts (
							user_id,
							mutation_id,
							operation,
							request_fingerprint,
							response,
							expires_at
						)
						SELECT
							${actorUserId},
							${mutationId},
							${operation},
							${requestFingerprint},
							jsonb_build_object('version', version),
							${expiresAt}
						FROM deleted
						RETURNING response
					)
					SELECT response
					FROM inserted_receipt
				`,
			)) as { rows: { response: { version: number } }[] };

			const receipt = result.rows[0];
			return receipt
				? { status: "ok", value: receipt.response }
				: { status: "version_conflict" };
		} catch (error) {
			const concurrentReceipt = await getCollectionMutationReceipt(
				actorUserId,
				mutationId,
				database,
			);
			if (concurrentReceipt) {
				if (
					concurrentReceipt.operation !== operation ||
					concurrentReceipt.requestFingerprint !== requestFingerprint
				) {
					return { status: "idempotency_conflict" };
				}
				return {
					status: "ok",
					value: { version: concurrentReceipt.response.version as number },
					replayed: true,
				};
			}
			throw error;
		}
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
