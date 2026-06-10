CREATE TABLE IF NOT EXISTS "published_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"collection_id" uuid NOT NULL,
	"source_node_id" uuid,
	"parent_block_id" uuid,
	"type" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"slot_name" text,
	"slot_description" text,
	"url" text,
	"title" text,
	"description" text,
	"price" text,
	"image_url" text,
	"brand" text,
	"merchant" text,
	"properties" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "published_blocks_type_check" CHECK ("published_blocks"."type" IN ('section', 'product', 'link', 'photo', 'note', 'text', 'slot'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "published_collections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_jazz_id" text,
	"jazz_published_id" text,
	"source_collection_id" uuid,
	"source_version" bigint,
	"schema_version" integer DEFAULT 2 NOT NULL,
	"owner_clerk_id" text NOT NULL,
	"username" text,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"color" text,
	"layout" text DEFAULT 'minimal' NOT NULL,
	"allow_cloning" boolean DEFAULT true NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "published_collections_owner_slug_unique" UNIQUE("owner_clerk_id","slug")
);
--> statement-breakpoint
ALTER TABLE "published_collections" ALTER COLUMN "source_jazz_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "published_collections" ADD COLUMN IF NOT EXISTS "source_collection_id" uuid;
--> statement-breakpoint
ALTER TABLE "published_collections" ADD COLUMN IF NOT EXISTS "source_version" bigint;
--> statement-breakpoint
ALTER TABLE "published_collections" ADD COLUMN IF NOT EXISTS "schema_version" integer DEFAULT 2 NOT NULL;
--> statement-breakpoint
ALTER TABLE "published_blocks" ADD COLUMN IF NOT EXISTS "source_node_id" uuid;
--> statement-breakpoint
ALTER TABLE "published_blocks" DROP CONSTRAINT IF EXISTS "published_blocks_type_check";
--> statement-breakpoint
ALTER TABLE "published_blocks" ADD CONSTRAINT "published_blocks_type_check" CHECK ("published_blocks"."type" IN ('section', 'product', 'link', 'photo', 'note', 'text', 'slot'));
--> statement-breakpoint
ALTER TABLE "published_blocks" ADD CONSTRAINT "published_blocks_collection_id_published_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."published_collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "published_blocks" ADD CONSTRAINT "published_blocks_source_node_id_collection_nodes_id_fk" FOREIGN KEY ("source_node_id") REFERENCES "public"."collection_nodes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "published_blocks" ADD CONSTRAINT "published_blocks_parent_block_id_published_blocks_id_fk" FOREIGN KEY ("parent_block_id") REFERENCES "public"."published_blocks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "published_collections" ADD CONSTRAINT "published_collections_source_collection_id_collections_id_fk" FOREIGN KEY ("source_collection_id") REFERENCES "public"."collections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "published_blocks_collection_idx" ON "published_blocks" USING btree ("collection_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "published_blocks_parent_idx" ON "published_blocks" USING btree ("parent_block_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "published_blocks_collection_source_node_uidx" ON "published_blocks" USING btree ("collection_id","source_node_id") WHERE "published_blocks"."source_node_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "published_collections_source_jazz_uidx" ON "published_collections" USING btree ("source_jazz_id") WHERE "published_collections"."source_jazz_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "published_collections_source_collection_uidx" ON "published_collections" USING btree ("source_collection_id") WHERE "published_collections"."source_collection_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "published_collections_owner_idx" ON "published_collections" USING btree ("owner_clerk_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "published_collections_username_idx" ON "published_collections" USING btree ("username");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "published_collections_slug_idx" ON "published_collections" USING btree ("slug");
