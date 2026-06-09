import { sql } from "drizzle-orm";
import {
	type AnyPgColumn,
	bigint,
	boolean,
	check,
	index,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
	unique,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import { collectionNodes, collections } from "./collections";

export const publishedCollections = pgTable(
	"published_collections",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		sourceJazzId: text("source_jazz_id"),
		jazzPublishedId: text("jazz_published_id"),
		sourceCollectionId: uuid("source_collection_id").references(
			() => collections.id,
			{ onDelete: "set null" },
		),
		sourceVersion: bigint("source_version", { mode: "number" }),
		schemaVersion: integer("schema_version").notNull().default(2),
		ownerClerkId: text("owner_clerk_id").notNull(),
		username: text("username"),
		slug: text("slug").notNull(),
		name: text("name").notNull(),
		description: text("description"),
		color: text("color"),
		layout: text("layout").notNull().default("minimal"),
		allowCloning: boolean("allow_cloning").notNull().default(true),
		publishedAt: timestamp("published_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		unique("published_collections_owner_slug_unique").on(
			table.ownerClerkId,
			table.slug,
		),
		uniqueIndex("published_collections_source_jazz_uidx")
			.on(table.sourceJazzId)
			.where(sql`${table.sourceJazzId} IS NOT NULL`),
		uniqueIndex("published_collections_source_collection_uidx")
			.on(table.sourceCollectionId)
			.where(sql`${table.sourceCollectionId} IS NOT NULL`),
		index("published_collections_owner_idx").on(table.ownerClerkId),
		index("published_collections_username_idx").on(table.username),
		index("published_collections_slug_idx").on(table.slug),
	],
);

export const publishedBlocks = pgTable(
	"published_blocks",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		collectionId: uuid("collection_id")
			.notNull()
			.references(() => publishedCollections.id, { onDelete: "cascade" }),
		sourceNodeId: uuid("source_node_id").references(() => collectionNodes.id, {
			onDelete: "set null",
		}),
		parentBlockId: uuid("parent_block_id").references(
			(): AnyPgColumn => publishedBlocks.id,
			{ onDelete: "cascade" },
		),
		type: text("type").notNull(),
		sortOrder: integer("sort_order").notNull().default(0),
		slotName: text("slot_name"),
		slotDescription: text("slot_description"),
		url: text("url"),
		title: text("title"),
		description: text("description"),
		price: text("price"),
		imageUrl: text("image_url"),
		brand: text("brand"),
		merchant: text("merchant"),
		properties: jsonb("properties").$type<Record<string, unknown>>(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("published_blocks_collection_idx").on(table.collectionId),
		index("published_blocks_parent_idx").on(table.parentBlockId),
		uniqueIndex("published_blocks_collection_source_node_uidx")
			.on(table.collectionId, table.sourceNodeId)
			.where(sql`${table.sourceNodeId} IS NOT NULL`),
		check(
			"published_blocks_type_check",
			sql`${table.type} IN ('section', 'product', 'link', 'photo', 'note', 'text', 'slot')`,
		),
	],
);

export type PublishedCollectionRow = typeof publishedCollections.$inferSelect;
export type PublishedBlockRow = typeof publishedBlocks.$inferSelect;
