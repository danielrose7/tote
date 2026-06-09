import { sql } from "drizzle-orm";
import {
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
import { collections } from "./collections";

export const accountDataSource = pgEnum("account_data_source", [
	"classic_jazz",
	"migrating",
	"neon_verifying",
	"neon",
	"migration_failed",
]);

export const dataMigrationStatus = pgEnum("data_migration_status", [
	"pending",
	"exporting",
	"importing",
	"verifying",
	"completed",
	"failed",
]);

export const accountDataSources = pgTable(
	"account_data_sources",
	{
		userId: text("user_id").primaryKey(),
		dataSource: accountDataSource("data_source")
			.notNull()
			.default("classic_jazz"),
		migrationVersion: integer("migration_version"),
		cutoverAt: timestamp("cutover_at", { withTimezone: true }),
		rollbackExpiresAt: timestamp("rollback_expires_at", {
			withTimezone: true,
		}),
		lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("account_data_sources_state_idx").on(table.dataSource),
		check(
			"account_data_sources_neon_cutover",
			sql`${table.dataSource} <> 'neon' OR (${table.cutoverAt} IS NOT NULL AND ${table.rollbackExpiresAt} IS NOT NULL AND ${table.lastVerifiedAt} IS NOT NULL)`,
		),
		check(
			"account_data_sources_rollback_after_cutover",
			sql`${table.rollbackExpiresAt} IS NULL OR ${table.cutoverAt} IS NULL OR ${table.rollbackExpiresAt} > ${table.cutoverAt}`,
		),
	],
);

export const accountCollectionMigrations = pgTable(
	"account_collection_migrations",
	{
		userId: text("user_id").notNull(),
		migrationVersion: integer("migration_version").notNull(),
		status: dataMigrationStatus("status").notNull().default("pending"),
		sourceCollectionCount: integer("source_collection_count"),
		sourceItemCount: integer("source_item_count"),
		importedCollectionCount: integer("imported_collection_count"),
		importedItemCount: integer("imported_item_count"),
		sourceFingerprint: text("source_fingerprint"),
		importFingerprint: text("import_fingerprint"),
		error: jsonb("error").$type<Record<string, unknown>>(),
		startedAt: timestamp("started_at", { withTimezone: true }),
		completedAt: timestamp("completed_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		primaryKey({ columns: [table.userId, table.migrationVersion] }),
		index("account_collection_migrations_status_idx").on(table.status),
		check(
			"account_collection_migrations_nonnegative_counts",
			sql`(${table.sourceCollectionCount} IS NULL OR ${table.sourceCollectionCount} >= 0)
				AND (${table.sourceItemCount} IS NULL OR ${table.sourceItemCount} >= 0)
				AND (${table.importedCollectionCount} IS NULL OR ${table.importedCollectionCount} >= 0)
				AND (${table.importedItemCount} IS NULL OR ${table.importedItemCount} >= 0)`,
		),
		check(
			"account_collection_migrations_completed_receipt",
			sql`${table.status} <> 'completed' OR (
				${table.sourceCollectionCount} IS NOT NULL
				AND ${table.sourceItemCount} IS NOT NULL
				AND ${table.importedCollectionCount} IS NOT NULL
				AND ${table.importedItemCount} IS NOT NULL
				AND ${table.sourceFingerprint} IS NOT NULL
				AND ${table.importFingerprint} IS NOT NULL
				AND ${table.completedAt} IS NOT NULL
			)`,
		),
	],
);

export const publicationSnapshotMigrations = pgTable(
	"publication_snapshot_migrations",
	{
		legacyPublicationId: uuid("legacy_publication_id").primaryKey(),
		sourceJazzId: text("source_jazz_id").notNull(),
		sourceCollectionId: uuid("source_collection_id").references(
			() => collections.id,
			{ onDelete: "set null" },
		),
		migrationVersion: integer("migration_version").notNull(),
		targetSchemaVersion: integer("target_schema_version").notNull(),
		status: dataMigrationStatus("status").notNull().default("pending"),
		sourceNodeCount: integer("source_node_count"),
		importedNodeCount: integer("imported_node_count"),
		sourceFingerprint: text("source_fingerprint"),
		importFingerprint: text("import_fingerprint"),
		error: jsonb("error").$type<Record<string, unknown>>(),
		startedAt: timestamp("started_at", { withTimezone: true }),
		completedAt: timestamp("completed_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		uniqueIndex("publication_snapshot_migrations_source_jazz_uidx").on(
			table.sourceJazzId,
		),
		index("publication_snapshot_migrations_source_collection_idx").on(
			table.sourceCollectionId,
		),
		index("publication_snapshot_migrations_status_idx").on(table.status),
		check(
			"publication_snapshot_migrations_positive_versions",
			sql`${table.migrationVersion} > 0 AND ${table.targetSchemaVersion} > 0`,
		),
		check(
			"publication_snapshot_migrations_nonnegative_counts",
			sql`(${table.sourceNodeCount} IS NULL OR ${table.sourceNodeCount} >= 0)
				AND (${table.importedNodeCount} IS NULL OR ${table.importedNodeCount} >= 0)`,
		),
		check(
			"publication_snapshot_migrations_completed_receipt",
			sql`${table.status} <> 'completed' OR (
				${table.sourceNodeCount} IS NOT NULL
				AND ${table.importedNodeCount} IS NOT NULL
				AND ${table.sourceFingerprint} IS NOT NULL
				AND ${table.importFingerprint} IS NOT NULL
				AND ${table.completedAt} IS NOT NULL
			)`,
		),
	],
);

export type AccountDataSource = typeof accountDataSources.$inferSelect;
export type AccountCollectionMigration =
	typeof accountCollectionMigrations.$inferSelect;
export type PublicationSnapshotMigration =
	typeof publicationSnapshotMigrations.$inferSelect;
