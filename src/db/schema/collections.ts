import { sql } from "drizzle-orm";
import {
	type AnyPgColumn,
	bigint,
	check,
	index,
	integer,
	jsonb,
	pgEnum,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";

export const collectionViewMode = pgEnum("collection_view_mode", [
	"grid",
	"table",
]);

export const collectionPublicLayout = pgEnum("collection_public_layout", [
	"minimal",
	"feature",
]);

export const collectionCopyPolicy = pgEnum("collection_copy_policy", [
	"disabled",
	"members",
	"public",
]);

export const collectionOriginType = pgEnum("collection_origin_type", [
	"manual",
	"import",
	"curator",
	"copy",
]);

export const collectionRole = pgEnum("collection_role", [
	"owner",
	"admin",
	"editor",
	"viewer",
]);

export const collectionNodeType = pgEnum("collection_node_type", [
	"section",
	"product",
	"link",
	"photo",
	"note",
	"text",
]);

export const collectionLineageRelationship = pgEnum(
	"collection_lineage_relationship",
	["copied", "imported", "curated", "templated"],
);

export const collectionMembershipAction = pgEnum(
	"collection_membership_action",
	[
		"invite_created",
		"invite_revoked",
		"invite_accepted",
		"role_changed",
		"member_removed",
		"ownership_transferred",
	],
);

export type CollectionNodeProperties = Record<string, unknown>;

export const collections = pgTable(
	"collections",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		ownerUserId: text("owner_user_id").notNull(),
		name: text("name").notNull(),
		description: text("description"),
		color: text("color"),
		budgetCents: integer("budget_cents"),
		defaultViewMode: collectionViewMode("default_view_mode"),
		publicLayout: collectionPublicLayout("public_layout")
			.notNull()
			.default("minimal"),
		copyPolicy: collectionCopyPolicy("copy_policy")
			.notNull()
			.default("disabled"),
		itemCount: integer("item_count").notNull().default(0),
		positionKey: text("position_key").notNull(),
		originType: collectionOriginType("origin_type").notNull().default("manual"),
		legacyJazzId: text("legacy_jazz_id"),
		version: bigint("version", { mode: "number" }).notNull().default(1),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		deletedAt: timestamp("deleted_at", { withTimezone: true }),
	},
	(table) => [
		index("collections_owner_position_idx").on(
			table.ownerUserId,
			table.positionKey,
		),
		index("collections_owner_updated_idx").on(
			table.ownerUserId,
			table.updatedAt,
		),
		uniqueIndex("collections_legacy_jazz_id_uidx")
			.on(table.legacyJazzId)
			.where(sql`${table.legacyJazzId} IS NOT NULL`),
		check("collections_item_count_nonnegative", sql`${table.itemCount} >= 0`),
		check(
			"collections_budget_cents_nonnegative",
			sql`${table.budgetCents} IS NULL OR ${table.budgetCents} >= 0`,
		),
	],
);

export const collectionMembers = pgTable(
	"collection_members",
	{
		collectionId: uuid("collection_id")
			.notNull()
			.references(() => collections.id, { onDelete: "cascade" }),
		userId: text("user_id").notNull(),
		role: collectionRole("role").notNull(),
		invitedByUserId: text("invited_by_user_id"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		revokedAt: timestamp("revoked_at", { withTimezone: true }),
	},
	(table) => [
		primaryKey({ columns: [table.collectionId, table.userId] }),
		index("collection_members_user_active_idx")
			.on(table.userId, table.collectionId)
			.where(sql`${table.revokedAt} IS NULL`),
	],
);

export const collectionInvites = pgTable(
	"collection_invites",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		collectionId: uuid("collection_id")
			.notNull()
			.references(() => collections.id, { onDelete: "cascade" }),
		createdByUserId: text("created_by_user_id").notNull(),
		role: collectionRole("role").notNull(),
		recipientHint: text("recipient_hint"),
		tokenHash: text("token_hash").notNull(),
		expiresAt: timestamp("expires_at", { withTimezone: true }),
		maxUses: integer("max_uses"),
		useCount: integer("use_count").notNull().default(0),
		revokedAt: timestamp("revoked_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		uniqueIndex("collection_invites_token_hash_uidx").on(table.tokenHash),
		index("collection_invites_collection_status_idx").on(
			table.collectionId,
			table.revokedAt,
			table.expiresAt,
		),
		check("collection_invites_role_not_owner", sql`${table.role} <> 'owner'`),
		check(
			"collection_invites_positive_max_uses",
			sql`${table.maxUses} IS NULL OR ${table.maxUses} > 0`,
		),
		check(
			"collection_invites_valid_use_count",
			sql`${table.useCount} >= 0 AND (${table.maxUses} IS NULL OR ${table.useCount} <= ${table.maxUses})`,
		),
	],
);

export const collectionMembershipEvents = pgTable(
	"collection_membership_events",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		collectionId: uuid("collection_id")
			.notNull()
			.references(() => collections.id, { onDelete: "cascade" }),
		actorUserId: text("actor_user_id").notNull(),
		subjectUserId: text("subject_user_id"),
		inviteId: uuid("invite_id").references(() => collectionInvites.id, {
			onDelete: "set null",
		}),
		action: collectionMembershipAction("action").notNull(),
		previousRole: collectionRole("previous_role"),
		nextRole: collectionRole("next_role"),
		metadata: jsonb("metadata")
			.$type<Record<string, unknown>>()
			.notNull()
			.default({}),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("collection_membership_events_collection_created_idx").on(
			table.collectionId,
			table.createdAt,
		),
		index("collection_membership_events_subject_idx").on(table.subjectUserId),
	],
);

export const collectionNodes = pgTable(
	"collection_nodes",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		collectionId: uuid("collection_id")
			.notNull()
			.references(() => collections.id, { onDelete: "cascade" }),
		parentId: uuid("parent_id").references(
			(): AnyPgColumn => collectionNodes.id,
			{ onDelete: "cascade" },
		),
		type: collectionNodeType("type").notNull(),
		title: text("title"),
		properties: jsonb("properties")
			.$type<CollectionNodeProperties>()
			.notNull()
			.default({}),
		positionKey: text("position_key").notNull(),
		version: bigint("version", { mode: "number" }).notNull().default(1),
		createdByUserId: text("created_by_user_id").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		deletedAt: timestamp("deleted_at", { withTimezone: true }),
	},
	(table) => [
		index("collection_nodes_collection_parent_position_idx").on(
			table.collectionId,
			table.parentId,
			table.positionKey,
		),
		index("collection_nodes_collection_type_idx").on(
			table.collectionId,
			table.type,
		),
		index("collection_nodes_parent_idx").on(table.parentId),
		check(
			"collection_nodes_parent_shape",
			sql`${table.type} <> 'section' OR ${table.parentId} IS NULL`,
		),
	],
);

export const collectionLineage = pgTable(
	"collection_lineage",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		childCollectionId: uuid("child_collection_id")
			.notNull()
			.references(() => collections.id, { onDelete: "cascade" }),
		relationship: collectionLineageRelationship("relationship").notNull(),
		sourceCollectionId: uuid("source_collection_id").references(
			() => collections.id,
			{ onDelete: "set null" },
		),
		sourcePublicationId: uuid("source_publication_id"),
		sourceOwnerUserId: text("source_owner_user_id"),
		sourceVersion: bigint("source_version", { mode: "number" }),
		sourceNameSnapshot: text("source_name_snapshot").notNull(),
		sourceRef: text("source_ref"),
		createdByUserId: text("created_by_user_id").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("collection_lineage_child_idx").on(table.childCollectionId),
		index("collection_lineage_source_idx").on(table.sourceCollectionId),
		check(
			"collection_lineage_not_self",
			sql`${table.sourceCollectionId} IS NULL OR ${table.sourceCollectionId} <> ${table.childCollectionId}`,
		),
	],
);

export type Collection = typeof collections.$inferSelect;
export type NewCollection = typeof collections.$inferInsert;
export type CollectionMember = typeof collectionMembers.$inferSelect;
export type CollectionInvite = typeof collectionInvites.$inferSelect;
export type CollectionMembershipEvent =
	typeof collectionMembershipEvents.$inferSelect;
export type CollectionNode = typeof collectionNodes.$inferSelect;
export type NewCollectionNode = typeof collectionNodes.$inferInsert;
export type CollectionLineage = typeof collectionLineage.$inferSelect;

export const itemNodeTypes = ["product", "link", "photo"] as const;

export function isItemNodeType(
	type: (typeof collectionNodeType.enumValues)[number],
): boolean {
	return (itemNodeTypes as readonly string[]).includes(type);
}

export function isActiveItemNode(
	node: Pick<CollectionNode, "type" | "deletedAt">,
): boolean {
	return node.deletedAt === null && isItemNodeType(node.type);
}

export const supportsChildren = (type: CollectionNode["type"]): boolean =>
	type === "section";

export const collectionNodeIsDeleted = (
	node: Pick<CollectionNode, "deletedAt">,
): boolean => node.deletedAt !== null;
