import { randomUUID } from 'node:crypto';
import { and, asc, eq, inArray, isNull, type SQL, sql } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import type * as schema from '@/db/schema';
import {
  accountDataSources,
  type Collection,
  type CollectionNode,
  collectionLineage,
  collectionMembers,
  collectionMutationReceipts,
  collectionNodes,
  collections,
} from '@/db/schema';
import { db as productionDb } from '../db';
import { fingerprintMutationRequest } from './idempotency';
import { roleCan } from './permissions';

export type CollectionDatabase = PgDatabase<PgQueryResultHKT, typeof schema>;

export type MutationFailure =
  | { status: 'not_found' }
  | { status: 'forbidden' }
  | { status: 'version_conflict' }
  | { status: 'idempotency_conflict' };

export type MutationSuccess<T> = {
  status: 'ok';
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
  role: (typeof collectionMembers.$inferSelect)['role'];
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
    throw new Error('Collection disappeared during mutation');
  }

  return summary;
}

export type CollectionSummary = Pick<
  Collection,
  | 'id'
  | 'ownerUserId'
  | 'name'
  | 'description'
  | 'color'
  | 'itemCount'
  | 'legacyJazzId'
  | 'positionKey'
  | 'updatedAt'
> & {
  role: (typeof collectionMembers.$inferSelect)['role'];
  previewImages: { url: string; title: string | null; nodeId: string }[];
};

export async function listCollectionSummaries(
  actorUserId: string,
  database: CollectionDatabase = productionDb,
): Promise<CollectionSummary[]> {
  const rows = await database
    .select({
      id: collections.id,
      ownerUserId: collections.ownerUserId,
      name: collections.name,
      description: collections.description,
      color: collections.color,
      itemCount: collections.itemCount,
      legacyJazzId: collections.legacyJazzId,
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

  if (rows.length === 0) return [];

  const collectionIds = rows.map((r) => r.id);

  const [productRows, sectionRows] = await Promise.all([
    database
      .select({
        collectionId: collectionNodes.collectionId,
        nodeId: collectionNodes.id,
        parentId: collectionNodes.parentId,
        imageUrl: sql<string>`${collectionNodes.properties}->>'imageUrl'`,
        title: collectionNodes.title,
        positionKey: collectionNodes.positionKey,
      })
      .from(collectionNodes)
      .where(
        and(
          inArray(collectionNodes.collectionId, collectionIds),
          eq(collectionNodes.type, 'product'),
          isNull(collectionNodes.deletedAt),
          sql`${collectionNodes.properties}->>'imageUrl' IS NOT NULL`,
        ),
      ),
    database
      .select({
        nodeId: collectionNodes.id,
        positionKey: collectionNodes.positionKey,
      })
      .from(collectionNodes)
      .where(
        and(
          inArray(collectionNodes.collectionId, collectionIds),
          eq(collectionNodes.type, 'section'),
          isNull(collectionNodes.deletedAt),
        ),
      ),
  ]);

  const sectionPositionKey = new Map(
    sectionRows.map((s) => [s.nodeId, s.positionKey]),
  );

  const productsByCollection = new Map<string, typeof productRows>();
  for (const p of productRows) {
    if (!productsByCollection.has(p.collectionId))
      productsByCollection.set(p.collectionId, []);
    productsByCollection.get(p.collectionId)!.push(p);
  }

  const imagesByCollection = new Map<
    string,
    { url: string; title: string | null; nodeId: string }[]
  >();
  for (const collId of collectionIds) {
    const products = productsByCollection.get(collId) ?? [];

    // Group products by their slot (parentId for nested, nodeId for top-level)
    const slotMap = new Map<
      string,
      { slotPositionKey: string; products: typeof productRows }
    >();
    for (const p of products) {
      const slotKey = p.parentId ?? p.nodeId;
      if (!slotMap.has(slotKey)) {
        const slotPk = p.parentId
          ? (sectionPositionKey.get(p.parentId) ?? p.positionKey)
          : p.positionKey;
        slotMap.set(slotKey, { slotPositionKey: slotPk, products: [] });
      }
      slotMap.get(slotKey)!.products.push(p);
    }

    for (const slot of slotMap.values())
      slot.products.sort((a, b) => a.positionKey.localeCompare(b.positionKey));

    const sortedSlots = [...slotMap.values()].sort((a, b) =>
      a.slotPositionKey.localeCompare(b.slotPositionKey),
    );

    // Interleave: first image from each slot, then second, etc.
    const imgs: { url: string; title: string | null; nodeId: string }[] = [];
    outer: for (let rank = 0; ; rank++) {
      let added = false;
      for (const slot of sortedSlots) {
        if (rank < slot.products.length) {
          const p = slot.products[rank];
          imgs.push({ url: p.imageUrl, title: p.title, nodeId: p.nodeId });
          added = true;
          if (imgs.length === 3) break outer;
        }
      }
      if (!added) break;
    }

    imagesByCollection.set(collId, imgs);
  }

  return rows.map((r) => ({
    ...r,
    previewImages: imagesByCollection.get(r.id) ?? [],
  }));
}

export type CollectionDetail = {
  collection: Collection;
  role: (typeof collectionMembers.$inferSelect)['role'];
  nodes: CollectionNode[];
  lineage: Array<{
    relationship: (typeof collectionLineage.$inferSelect)['relationship'];
    sourceName: string;
    sourceCollectionId: string | null;
    sourcePublicationId: string | null;
    sourceVersion: number | null;
  }>;
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
  const lineageRows = await database
    .select()
    .from(collectionLineage)
    .where(eq(collectionLineage.childCollectionId, collectionId))
    .orderBy(asc(collectionLineage.createdAt));
  const lineage = await Promise.all(
    lineageRows.map(async (entry) => {
      let visibleSourceCollectionId: string | null = null;
      if (entry.sourceCollectionId) {
        const sourceAccess = await getActiveCollectionAccess(
          actorUserId,
          entry.sourceCollectionId,
          database,
        );
        if (sourceAccess) {
          visibleSourceCollectionId = entry.sourceCollectionId;
        }
      }
      return {
        relationship: entry.relationship,
        sourceName: entry.sourceNameSnapshot,
        sourceCollectionId: visibleSourceCollectionId,
        sourcePublicationId: entry.sourcePublicationId,
        sourceVersion: entry.sourceVersion,
      };
    }),
  );

  return {
    ...access,
    nodes,
    lineage,
  };
}

export async function getAccountCollectionDataSource(
  actorUserId: string,
  database: CollectionDatabase = productionDb,
): Promise<(typeof accountDataSources.$inferSelect)['dataSource']> {
  const [account] = await database
    .select({ dataSource: accountDataSources.dataSource })
    .from(accountDataSources)
    .where(eq(accountDataSources.userId, actorUserId))
    .limit(1);

  return account?.dataSource ?? 'classic_jazz';
}

export type CreateCollectionInput = {
  id?: string;
  mutationId?: string;
  name: string;
  description?: string;
  color?: string;
  positionKey?: string;
};

export type CreateCollectionResult =
  | { status: 'created'; id: string }
  | { status: 'replayed'; id: string }
  | { status: 'idempotency_conflict' };

export async function createCollection(
  actorUserId: string,
  input: CreateCollectionInput,
  database: CollectionDatabase = productionDb,
): Promise<CreateCollectionResult> {
  if (input.mutationId && !input.id) {
    throw new Error(
      'Idempotent collection creation requires a client-generated id',
    );
  }

  const collectionId = input.id ?? randomUUID();
  // Capture clients omit positionKey; assign a canonical end-of-list key
  // using the same convention as captured nodes.
  const positionKey = input.positionKey ?? `z:${collectionId}`;
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
					${positionKey}
				)
				RETURNING id
			)
			INSERT INTO collection_members (collection_id, user_id, role)
			SELECT id, ${actorUserId}, 'owner'::collection_role
			FROM inserted_collection
		`);

    return { status: 'created', id: collectionId };
  }

  const operation = 'collection.create.v1';
  const requestFingerprint = fingerprintMutationRequest({
    id: collectionId,
    name: input.name,
    description: input.description ?? null,
    color: input.color ?? null,
    positionKey,
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
      return { status: 'idempotency_conflict' };
    }
    return { status: 'replayed', id: existing.response.id as string };
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
				${positionKey}
			)
			RETURNING id
		),
		inserted_member AS (
			INSERT INTO collection_members (collection_id, user_id, role)
			SELECT id, ${actorUserId}, 'owner'::collection_role
			FROM inserted_collection
			RETURNING collection_id
		),
		inserted_realtime_events AS (
			INSERT INTO ably_outbox (
				mutation_id,
				channel,
				name,
				data
			)
			SELECT
				${input.mutationId},
				'collection:' || collection_id,
				'collection.created',
				jsonb_build_object(
					'collectionId',
					collection_id,
					'version',
					1
				)
			FROM inserted_member
			UNION ALL
			SELECT
				${input.mutationId},
				'user:' || ${actorUserId} || ':collections',
				'collection.index.updated',
				jsonb_build_object('collectionId', collection_id)
			FROM inserted_member
			RETURNING mutation_id
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
		WHERE EXISTS (SELECT 1 FROM inserted_realtime_events)
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
        status: 'replayed',
        id: concurrentReceipt.response.id as string,
      };
    }
    throw error;
  }

  return { status: 'created', id: collectionId };
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
  defaultViewMode?: 'grid' | 'table' | null;
  publicLayout?: 'minimal' | 'feature';
  copyPolicy?: 'disabled' | 'members' | 'public';
  positionKey?: string;
};

export async function updateCollection(
  actorUserId: string,
  collectionId: string,
  input: UpdateCollectionInput,
  database: CollectionDatabase = productionDb,
): Promise<MutationResult<{ version: number }>> {
  const operation = 'collection.update.v1';
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
        return { status: 'idempotency_conflict' };
      }
      return {
        status: 'ok',
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
    return { status: 'not_found' };
  }
  if (!roleCan(access.role, 'edit')) {
    return { status: 'forbidden' };
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
					),
					inserted_realtime_events AS (
						INSERT INTO ably_outbox (
							mutation_id,
							channel,
							name,
							data
						)
						SELECT
							${mutationId},
							'collection:' || ${collectionId},
							'collection.updated',
							jsonb_build_object(
								'collectionId',
								${collectionId}::text,
								'version',
								(response ->> 'version')::bigint
							)
						FROM inserted_receipt
						UNION ALL
						SELECT
							${mutationId},
							'user:' || member.user_id || ':collections',
							'collection.index.updated',
							jsonb_build_object(
								'collectionId',
								${collectionId}::text,
								'version',
								(receipt.response ->> 'version')::bigint
							)
						FROM inserted_receipt receipt
						INNER JOIN collection_members member
							ON member.collection_id = ${collectionId}
							AND member.revoked_at IS NULL
						RETURNING mutation_id
					)
					SELECT receipt.response
					FROM inserted_receipt receipt
					WHERE EXISTS (SELECT 1 FROM inserted_realtime_events)
				`,
      )) as { rows: { response: { version: number } }[] };

      const receipt = result.rows[0];
      return receipt
        ? { status: 'ok', value: receipt.response }
        : { status: 'version_conflict' };
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
          return { status: 'idempotency_conflict' };
        }
        return {
          status: 'ok',
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
    ? { status: 'ok', value: updated }
    : { status: 'version_conflict' };
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
  const operation = 'collection.delete.v1';
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
        return { status: 'idempotency_conflict' };
      }
      return {
        status: 'ok',
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
    return { status: 'not_found' };
  }
  if (!roleCan(access.role, 'delete')) {
    return { status: 'forbidden' };
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
					),
					inserted_realtime_events AS (
						INSERT INTO ably_outbox (
							mutation_id,
							channel,
							name,
							data
						)
						SELECT
							${mutationId},
							'collection:' || ${collectionId},
							'collection.deleted',
							jsonb_build_object(
								'collectionId',
								${collectionId}::text,
								'version',
								(response ->> 'version')::bigint
							)
						FROM inserted_receipt
						UNION ALL
						SELECT
							${mutationId},
							'user:' || member.user_id || ':collections',
							'collection.index.updated',
							jsonb_build_object(
								'collectionId',
								${collectionId}::text,
								'deleted',
								true
							)
						FROM inserted_receipt
						INNER JOIN collection_members member
							ON member.collection_id = ${collectionId}
							AND member.revoked_at IS NULL
						RETURNING mutation_id
					)
					SELECT receipt.response
					FROM inserted_receipt receipt
					WHERE EXISTS (SELECT 1 FROM inserted_realtime_events)
				`,
      )) as { rows: { response: { version: number } }[] };

      const receipt = result.rows[0];
      return receipt
        ? { status: 'ok', value: receipt.response }
        : { status: 'version_conflict' };
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
          return { status: 'idempotency_conflict' };
        }
        return {
          status: 'ok',
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
    ? { status: 'ok', value: deleted }
    : { status: 'version_conflict' };
}

export type CreateCollectionNodeInput = {
  id?: string;
  mutationId?: string;
  parentId?: string | null;
  type: CollectionNode['type'];
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
  if (input.mutationId && !input.id) {
    throw new Error('Idempotent node creation requires a client-generated id');
  }

  const nodeId = input.id ?? randomUUID();
  const operation = 'collection_node.create.v1';
  const requestFingerprint = input.mutationId
    ? fingerprintMutationRequest({
        collectionId,
        id: nodeId,
        parentId: input.parentId ?? null,
        type: input.type,
        title: input.title ?? null,
        properties: input.properties ?? {},
        positionKey: input.positionKey,
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
        return { status: 'idempotency_conflict' };
      }
      return {
        status: 'ok',
        value: {
          id: existing.response.id as string,
          version: existing.response.version as number,
          ...(await getCollectionMutationSummary(collectionId, database)),
        },
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
    return { status: 'not_found' };
  }
  if (!roleCan(access.role, 'edit')) {
    return { status: 'forbidden' };
  }

  if (input.mutationId && requestFingerprint) {
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1_000);
    try {
      const result = (await database.execute<{
        response: { id: string; version: number };
      }>(sql`
				WITH inserted_node AS (
					INSERT INTO collection_nodes (
						id,
						collection_id,
						parent_id,
						type,
						title,
						properties,
						position_key,
						created_by_user_id
					) VALUES (
						${nodeId},
						${collectionId},
						${input.parentId ?? null},
						${input.type},
						${input.title ?? null},
						${JSON.stringify(input.properties ?? {})}::jsonb,
						${input.positionKey},
						${actorUserId}
					)
					RETURNING id, version
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
						${input.mutationId},
						${operation},
						${requestFingerprint},
						jsonb_build_object('id', id, 'version', version),
						${expiresAt}
					FROM inserted_node
					RETURNING response
				),
				inserted_realtime_events AS (
					INSERT INTO ably_outbox (
						mutation_id,
						channel,
						name,
						data
					)
					SELECT
						${input.mutationId},
						'collection:' || ${collectionId},
						'collection.node.created',
						jsonb_build_object(
							'collectionId',
							${collectionId}::text,
							'nodeId',
							response ->> 'id',
							'version',
							(response ->> 'version')::bigint
						)
					FROM inserted_receipt
					UNION ALL
					SELECT
						${input.mutationId},
						'user:' || member.user_id || ':collections',
						'collection.index.updated',
						jsonb_build_object('collectionId', ${collectionId}::text)
					FROM inserted_receipt
					INNER JOIN collection_members member
						ON member.collection_id = ${collectionId}
						AND member.revoked_at IS NULL
					RETURNING mutation_id
				)
				SELECT receipt.response
				FROM inserted_receipt receipt
				WHERE EXISTS (SELECT 1 FROM inserted_realtime_events)
			`)) as { rows: { response: { id: string; version: number } }[] };

      const receipt = result.rows[0];
      if (!receipt) {
        throw new Error('Node creation did not produce a mutation receipt');
      }
      return {
        status: 'ok',
        value: {
          ...receipt.response,
          ...(await getCollectionMutationSummary(collectionId, database)),
        },
      };
    } catch (error) {
      const concurrentReceipt = await getCollectionMutationReceipt(
        actorUserId,
        input.mutationId,
        database,
      );
      if (concurrentReceipt) {
        if (
          concurrentReceipt.operation !== operation ||
          concurrentReceipt.requestFingerprint !== requestFingerprint
        ) {
          return { status: 'idempotency_conflict' };
        }
        return {
          status: 'ok',
          value: {
            id: concurrentReceipt.response.id as string,
            version: concurrentReceipt.response.version as number,
            ...(await getCollectionMutationSummary(collectionId, database)),
          },
          replayed: true,
        };
      }
      throw error;
    }
  }

  const [node] = await database
    .insert(collectionNodes)
    .values({
      id: nodeId,
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
    status: 'ok',
    value: {
      ...node,
      ...(await getCollectionMutationSummary(collectionId, database)),
    },
  };
}

export type UpdateCollectionNodeInput = {
  expectedVersion: number;
  mutationId?: string;
  parentId?: string | null;
  type?: CollectionNode['type'];
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
  const operation = 'collection_node.update.v1';
  const requestFingerprint = input.mutationId
    ? fingerprintMutationRequest({
        collectionId,
        nodeId,
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
        return { status: 'idempotency_conflict' };
      }
      return {
        status: 'ok',
        value: {
          version: existing.response.version as number,
          ...(await getCollectionMutationSummary(collectionId, database)),
        },
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
    return { status: 'not_found' };
  }
  if (!roleCan(access.role, 'edit')) {
    return { status: 'forbidden' };
  }

  const { expectedVersion, mutationId, ...fields } = input;
  if (mutationId && requestFingerprint) {
    const assignments: SQL[] = [];
    if (fields.parentId !== undefined) {
      assignments.push(sql`parent_id = ${fields.parentId}`);
    }
    if (fields.type !== undefined) {
      assignments.push(sql`type = ${fields.type}`);
    }
    if (fields.title !== undefined) {
      assignments.push(sql`title = ${fields.title}`);
    }
    if (fields.properties !== undefined) {
      assignments.push(
        sql`properties = ${JSON.stringify(fields.properties)}::jsonb`,
      );
    }
    if (fields.positionKey !== undefined) {
      assignments.push(sql`position_key = ${fields.positionKey}`);
    }
    assignments.push(sql`version = version + 1`, sql`updated_at = now()`);

    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1_000);
    try {
      const result = (await database.execute<{
        response: { version: number };
      }>(sql`
				WITH updated_node AS (
					UPDATE collection_nodes
					SET ${sql.join(assignments, sql`, `)}
					WHERE id = ${nodeId}
						AND collection_id = ${collectionId}
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
					FROM updated_node
					RETURNING response
				),
				inserted_realtime_events AS (
					INSERT INTO ably_outbox (
						mutation_id,
						channel,
						name,
						data
					)
					SELECT
						${mutationId},
						'collection:' || ${collectionId},
						'collection.node.updated',
						jsonb_build_object(
							'collectionId',
							${collectionId}::text,
							'nodeId',
							${nodeId}::text,
							'version',
							(response ->> 'version')::bigint
						)
					FROM inserted_receipt
					UNION ALL
					SELECT
						${mutationId},
						'user:' || member.user_id || ':collections',
						'collection.index.updated',
						jsonb_build_object('collectionId', ${collectionId}::text)
					FROM inserted_receipt
					INNER JOIN collection_members member
						ON member.collection_id = ${collectionId}
						AND member.revoked_at IS NULL
					RETURNING mutation_id
				)
				SELECT receipt.response
				FROM inserted_receipt receipt
				WHERE EXISTS (SELECT 1 FROM inserted_realtime_events)
			`)) as { rows: { response: { version: number } }[] };

      const receipt = result.rows[0];
      if (receipt) {
        return {
          status: 'ok',
          value: {
            ...receipt.response,
            ...(await getCollectionMutationSummary(collectionId, database)),
          },
        };
      }
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
          return { status: 'idempotency_conflict' };
        }
        return {
          status: 'ok',
          value: {
            version: concurrentReceipt.response.version as number,
            ...(await getCollectionMutationSummary(collectionId, database)),
          },
          replayed: true,
        };
      }
      throw error;
    }
  }

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
      status: 'ok',
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

  return existing ? { status: 'version_conflict' } : { status: 'not_found' };
}

export type DeleteCollectionNodeInput = {
  expectedVersion: number;
  mutationId?: string;
};

export type ReorderCollectionNodesInput = {
  mutationId: string;
  nodes: Array<{
    id: string;
    expectedVersion: number;
    positionKey: string;
  }>;
};

export async function reorderCollectionNodes(
  actorUserId: string,
  collectionId: string,
  input: ReorderCollectionNodesInput,
  database: CollectionDatabase = productionDb,
): Promise<
  MutationResult<{
    nodeCount: number;
    collectionVersion: number;
    itemCount: number;
  }>
> {
  const operation = 'collection_nodes.reorder.v1';
  const requestFingerprint = fingerprintMutationRequest({
    collectionId,
    nodes: input.nodes,
  });
  const existingReceipt = await getCollectionMutationReceipt(
    actorUserId,
    input.mutationId,
    database,
  );
  if (existingReceipt) {
    if (
      existingReceipt.operation !== operation ||
      existingReceipt.requestFingerprint !== requestFingerprint
    ) {
      return { status: 'idempotency_conflict' };
    }
    return {
      status: 'ok',
      value: {
        nodeCount: existingReceipt.response.nodeCount as number,
        ...(await getCollectionMutationSummary(collectionId, database)),
      },
      replayed: true,
    };
  }

  const access = await getActiveCollectionAccess(
    actorUserId,
    collectionId,
    database,
  );
  if (!access) {
    return { status: 'not_found' };
  }
  if (!roleCan(access.role, 'edit')) {
    return { status: 'forbidden' };
  }

  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1_000);
  try {
    const result = (await database.execute<{
      response: { nodeCount: number };
    }>(sql`
			WITH requested AS (
				SELECT *
				FROM jsonb_to_recordset(${JSON.stringify(input.nodes)}::jsonb) AS row(
					id uuid,
					"expectedVersion" bigint,
					"positionKey" text
				)
			),
			matched_nodes AS (
				SELECT
					node.id,
					node.parent_id,
					node.type
				FROM collection_nodes node
				INNER JOIN requested
					ON requested.id = node.id
					AND requested."expectedVersion" = node.version
				WHERE node.collection_id = ${collectionId}
					AND node.deleted_at IS NULL
			),
			reorder_group AS (
				SELECT
					parent_id,
					type = 'section'::collection_node_type AS is_section_group
				FROM matched_nodes
				LIMIT 1
			),
			valid_reorder AS (
				SELECT 1
				FROM reorder_group group_shape
				WHERE (SELECT count(*) FROM matched_nodes) =
						(SELECT count(*) FROM requested)
					AND NOT EXISTS (
						SELECT 1
						FROM matched_nodes matched
						WHERE matched.parent_id IS DISTINCT FROM group_shape.parent_id
							OR (
								group_shape.parent_id IS NULL
								AND (matched.type = 'section'::collection_node_type)
									IS DISTINCT FROM group_shape.is_section_group
							)
					)
					AND (
						SELECT count(*)
						FROM collection_nodes sibling
						WHERE sibling.collection_id = ${collectionId}
							AND sibling.deleted_at IS NULL
							AND sibling.parent_id IS NOT DISTINCT FROM group_shape.parent_id
							AND (
								group_shape.parent_id IS NOT NULL
								OR (sibling.type = 'section'::collection_node_type) =
									group_shape.is_section_group
							)
					) = (SELECT count(*) FROM requested)
			),
			updated_nodes AS (
				UPDATE collection_nodes node
				SET position_key = requested."positionKey",
					version = node.version + 1,
					updated_at = now()
				FROM requested
				WHERE node.id = requested.id
					AND node.collection_id = ${collectionId}
					AND node.version = requested."expectedVersion"
					AND node.deleted_at IS NULL
					AND EXISTS (SELECT 1 FROM valid_reorder)
				RETURNING node.id
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
					${input.mutationId},
					${operation},
					${requestFingerprint},
					jsonb_build_object('nodeCount', count(*)),
					${expiresAt}
				FROM updated_nodes
				HAVING count(*) = (SELECT count(*) FROM requested)
					AND count(*) > 0
				RETURNING response
			),
			inserted_realtime_events AS (
				INSERT INTO ably_outbox (
					mutation_id,
					channel,
					name,
					data
				)
				SELECT
					${input.mutationId},
					'collection:' || ${collectionId},
					'collection.nodes.reordered',
					jsonb_build_object(
						'collectionId',
						${collectionId}::text,
						'nodeIds',
						(SELECT jsonb_agg(id ORDER BY "positionKey") FROM requested)
					)
				FROM inserted_receipt
				UNION ALL
				SELECT
					${input.mutationId},
					'user:' || member.user_id || ':collections',
					'collection.index.updated',
					jsonb_build_object('collectionId', ${collectionId}::text)
				FROM inserted_receipt
				INNER JOIN collection_members member
					ON member.collection_id = ${collectionId}
					AND member.revoked_at IS NULL
				RETURNING mutation_id
			)
			SELECT receipt.response
			FROM inserted_receipt receipt
			WHERE EXISTS (SELECT 1 FROM inserted_realtime_events)
		`)) as { rows: Array<{ response: { nodeCount: number } }> };

    const receipt = result.rows[0];
    if (!receipt) {
      return { status: 'version_conflict' };
    }
    return {
      status: 'ok',
      value: {
        ...receipt.response,
        ...(await getCollectionMutationSummary(collectionId, database)),
      },
    };
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
        status: 'ok',
        value: {
          nodeCount: concurrentReceipt.response.nodeCount as number,
          ...(await getCollectionMutationSummary(collectionId, database)),
        },
        replayed: true,
      };
    }
    throw error;
  }
}

export async function deleteCollectionNode(
  actorUserId: string,
  collectionId: string,
  nodeId: string,
  input: DeleteCollectionNodeInput,
  database: CollectionDatabase = productionDb,
): Promise<
  MutationResult<{
    deletedNodeCount: number;
    collectionVersion: number;
    itemCount: number;
  }>
> {
  const operation = 'collection_node.delete.v1';
  const requestFingerprint = input.mutationId
    ? fingerprintMutationRequest({
        collectionId,
        nodeId,
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
        return { status: 'idempotency_conflict' };
      }
      return {
        status: 'ok',
        value: {
          deletedNodeCount: existing.response.deletedNodeCount as number,
          ...(await getCollectionMutationSummary(collectionId, database)),
        },
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
    return { status: 'not_found' };
  }
  if (!roleCan(access.role, 'edit')) {
    return { status: 'forbidden' };
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
    return { status: 'not_found' };
  }
  if (existing.version !== input.expectedVersion) {
    return { status: 'version_conflict' };
  }

  const { expectedVersion, mutationId } = input;
  if (mutationId && requestFingerprint) {
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1_000);
    try {
      const result = (await database.execute<{
        response: { deletedNodeCount: number };
      }>(sql`
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
				),
				deleted_nodes AS (
					UPDATE collection_nodes
					SET deleted_at = now(),
						version = version + 1,
						updated_at = now()
					WHERE id IN (SELECT id FROM subtree)
					RETURNING id
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
						jsonb_build_object('deletedNodeCount', count(*)),
						${expiresAt}
					FROM deleted_nodes
					HAVING count(*) > 0
					RETURNING response
				),
				inserted_realtime_events AS (
					INSERT INTO ably_outbox (
						mutation_id,
						channel,
						name,
						data
					)
					SELECT
						${mutationId},
						'collection:' || ${collectionId},
						'collection.node.deleted',
						jsonb_build_object(
							'collectionId',
							${collectionId}::text,
							'nodeId',
							${nodeId}::text,
							'deletedNodeCount',
							(response ->> 'deletedNodeCount')::integer
						)
					FROM inserted_receipt
					UNION ALL
					SELECT
						${mutationId},
						'user:' || member.user_id || ':collections',
						'collection.index.updated',
						jsonb_build_object('collectionId', ${collectionId}::text)
					FROM inserted_receipt
					INNER JOIN collection_members member
						ON member.collection_id = ${collectionId}
						AND member.revoked_at IS NULL
					RETURNING mutation_id
				)
				SELECT receipt.response
				FROM inserted_receipt receipt
				WHERE EXISTS (SELECT 1 FROM inserted_realtime_events)
			`)) as { rows: { response: { deletedNodeCount: number } }[] };

      const receipt = result.rows[0];
      if (receipt) {
        return {
          status: 'ok',
          value: {
            ...receipt.response,
            ...(await getCollectionMutationSummary(collectionId, database)),
          },
        };
      }
      return { status: 'version_conflict' };
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
          return { status: 'idempotency_conflict' };
        }
        return {
          status: 'ok',
          value: {
            deletedNodeCount: concurrentReceipt.response
              .deletedNodeCount as number,
            ...(await getCollectionMutationSummary(collectionId, database)),
          },
          replayed: true,
        };
      }
      throw error;
    }
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
    return { status: 'version_conflict' };
  }

  return {
    status: 'ok',
    value: {
      deletedNodeCount: deleted.rows.length,
      ...(await getCollectionMutationSummary(collectionId, database)),
    },
  };
}

export async function clearNodeImageUrl(
  actorUserId: string,
  collectionId: string,
  nodeId: string,
  imageUrl: string,
  database: CollectionDatabase = productionDb,
): Promise<
  { status: 'ok' } | { status: 'not_found' } | { status: 'forbidden' }
> {
  const access = await getActiveCollectionAccess(
    actorUserId,
    collectionId,
    database,
  );
  if (!access) return { status: 'not_found' };
  if (!roleCan(access.role, 'edit')) return { status: 'forbidden' };

  await database.execute(sql`
    UPDATE collection_nodes
    SET properties = properties - 'imageUrl',
        updated_at = now()
    WHERE id = ${nodeId}
      AND collection_id = ${collectionId}
      AND deleted_at IS NULL
      AND properties->>'imageUrl' = ${imageUrl}
  `);

  return { status: 'ok' };
}
