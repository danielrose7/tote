CREATE TYPE "public"."account_data_source" AS ENUM('classic_jazz', 'migrating', 'neon_verifying', 'neon', 'migration_failed');--> statement-breakpoint
CREATE TYPE "public"."data_migration_status" AS ENUM('pending', 'exporting', 'importing', 'verifying', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "account_collection_migrations" (
	"user_id" text NOT NULL,
	"migration_version" integer NOT NULL,
	"status" "data_migration_status" DEFAULT 'pending' NOT NULL,
	"source_collection_count" integer,
	"source_item_count" integer,
	"imported_collection_count" integer,
	"imported_item_count" integer,
	"source_fingerprint" text,
	"import_fingerprint" text,
	"error" jsonb,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "account_collection_migrations_user_id_migration_version_pk" PRIMARY KEY("user_id","migration_version"),
	CONSTRAINT "account_collection_migrations_nonnegative_counts" CHECK (("account_collection_migrations"."source_collection_count" IS NULL OR "account_collection_migrations"."source_collection_count" >= 0)
				AND ("account_collection_migrations"."source_item_count" IS NULL OR "account_collection_migrations"."source_item_count" >= 0)
				AND ("account_collection_migrations"."imported_collection_count" IS NULL OR "account_collection_migrations"."imported_collection_count" >= 0)
				AND ("account_collection_migrations"."imported_item_count" IS NULL OR "account_collection_migrations"."imported_item_count" >= 0)),
	CONSTRAINT "account_collection_migrations_completed_receipt" CHECK ("account_collection_migrations"."status" <> 'completed' OR (
				"account_collection_migrations"."source_collection_count" IS NOT NULL
				AND "account_collection_migrations"."source_item_count" IS NOT NULL
				AND "account_collection_migrations"."imported_collection_count" IS NOT NULL
				AND "account_collection_migrations"."imported_item_count" IS NOT NULL
				AND "account_collection_migrations"."source_fingerprint" IS NOT NULL
				AND "account_collection_migrations"."import_fingerprint" IS NOT NULL
				AND "account_collection_migrations"."completed_at" IS NOT NULL
			))
);
--> statement-breakpoint
CREATE TABLE "account_data_sources" (
	"user_id" text PRIMARY KEY NOT NULL,
	"data_source" "account_data_source" DEFAULT 'classic_jazz' NOT NULL,
	"migration_version" integer,
	"cutover_at" timestamp with time zone,
	"rollback_expires_at" timestamp with time zone,
	"last_verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "account_data_sources_neon_cutover" CHECK ("account_data_sources"."data_source" <> 'neon' OR ("account_data_sources"."cutover_at" IS NOT NULL AND "account_data_sources"."rollback_expires_at" IS NOT NULL AND "account_data_sources"."last_verified_at" IS NOT NULL)),
	CONSTRAINT "account_data_sources_rollback_after_cutover" CHECK ("account_data_sources"."rollback_expires_at" IS NULL OR "account_data_sources"."cutover_at" IS NULL OR "account_data_sources"."rollback_expires_at" > "account_data_sources"."cutover_at")
);
--> statement-breakpoint
CREATE TABLE "publication_snapshot_migrations" (
	"legacy_publication_id" uuid PRIMARY KEY NOT NULL,
	"source_jazz_id" text NOT NULL,
	"source_collection_id" uuid,
	"migration_version" integer NOT NULL,
	"target_schema_version" integer NOT NULL,
	"status" "data_migration_status" DEFAULT 'pending' NOT NULL,
	"source_node_count" integer,
	"imported_node_count" integer,
	"source_fingerprint" text,
	"import_fingerprint" text,
	"error" jsonb,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "publication_snapshot_migrations_positive_versions" CHECK ("publication_snapshot_migrations"."migration_version" > 0 AND "publication_snapshot_migrations"."target_schema_version" > 0),
	CONSTRAINT "publication_snapshot_migrations_nonnegative_counts" CHECK (("publication_snapshot_migrations"."source_node_count" IS NULL OR "publication_snapshot_migrations"."source_node_count" >= 0)
				AND ("publication_snapshot_migrations"."imported_node_count" IS NULL OR "publication_snapshot_migrations"."imported_node_count" >= 0)),
	CONSTRAINT "publication_snapshot_migrations_completed_receipt" CHECK ("publication_snapshot_migrations"."status" <> 'completed' OR (
				"publication_snapshot_migrations"."source_node_count" IS NOT NULL
				AND "publication_snapshot_migrations"."imported_node_count" IS NOT NULL
				AND "publication_snapshot_migrations"."source_fingerprint" IS NOT NULL
				AND "publication_snapshot_migrations"."import_fingerprint" IS NOT NULL
				AND "publication_snapshot_migrations"."completed_at" IS NOT NULL
			))
);
--> statement-breakpoint
ALTER TABLE "publication_snapshot_migrations" ADD CONSTRAINT "publication_snapshot_migrations_source_collection_id_collections_id_fk" FOREIGN KEY ("source_collection_id") REFERENCES "public"."collections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_collection_migrations_status_idx" ON "account_collection_migrations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "account_data_sources_state_idx" ON "account_data_sources" USING btree ("data_source");--> statement-breakpoint
CREATE UNIQUE INDEX "publication_snapshot_migrations_source_jazz_uidx" ON "publication_snapshot_migrations" USING btree ("source_jazz_id");--> statement-breakpoint
CREATE INDEX "publication_snapshot_migrations_source_collection_idx" ON "publication_snapshot_migrations" USING btree ("source_collection_id");--> statement-breakpoint
CREATE INDEX "publication_snapshot_migrations_status_idx" ON "publication_snapshot_migrations" USING btree ("status");