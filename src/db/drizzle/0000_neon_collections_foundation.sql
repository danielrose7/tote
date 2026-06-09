CREATE TYPE "public"."collection_copy_policy" AS ENUM('disabled', 'members', 'public');--> statement-breakpoint
CREATE TYPE "public"."collection_lineage_relationship" AS ENUM('copied', 'imported', 'curated', 'templated');--> statement-breakpoint
CREATE TYPE "public"."collection_node_type" AS ENUM('section', 'product', 'link', 'photo', 'note', 'text');--> statement-breakpoint
CREATE TYPE "public"."collection_origin_type" AS ENUM('manual', 'import', 'curator', 'copy');--> statement-breakpoint
CREATE TYPE "public"."collection_public_layout" AS ENUM('minimal', 'feature');--> statement-breakpoint
CREATE TYPE "public"."collection_role" AS ENUM('owner', 'admin', 'editor', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."collection_view_mode" AS ENUM('grid', 'table');--> statement-breakpoint
CREATE TABLE "collection_lineage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"child_collection_id" uuid NOT NULL,
	"relationship" "collection_lineage_relationship" NOT NULL,
	"source_collection_id" uuid,
	"source_publication_id" uuid,
	"source_owner_user_id" text,
	"source_version" bigint,
	"source_name_snapshot" text NOT NULL,
	"source_ref" text,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collection_lineage_not_self" CHECK ("collection_lineage"."source_collection_id" IS NULL OR "collection_lineage"."source_collection_id" <> "collection_lineage"."child_collection_id")
);
--> statement-breakpoint
CREATE TABLE "collection_members" (
	"collection_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" "collection_role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "collection_members_collection_id_user_id_pk" PRIMARY KEY("collection_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "collection_nodes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"collection_id" uuid NOT NULL,
	"parent_id" uuid,
	"type" "collection_node_type" NOT NULL,
	"title" text,
	"properties" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"position_key" text NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "collection_nodes_parent_shape" CHECK ("collection_nodes"."type" <> 'section' OR "collection_nodes"."parent_id" IS NULL)
);
--> statement-breakpoint
CREATE TABLE "collections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"color" text,
	"budget_cents" integer,
	"default_view_mode" "collection_view_mode",
	"public_layout" "collection_public_layout" DEFAULT 'minimal' NOT NULL,
	"copy_policy" "collection_copy_policy" DEFAULT 'disabled' NOT NULL,
	"item_count" integer DEFAULT 0 NOT NULL,
	"position_key" text NOT NULL,
	"origin_type" "collection_origin_type" DEFAULT 'manual' NOT NULL,
	"legacy_jazz_id" text,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "collections_item_count_nonnegative" CHECK ("collections"."item_count" >= 0),
	CONSTRAINT "collections_budget_cents_nonnegative" CHECK ("collections"."budget_cents" IS NULL OR "collections"."budget_cents" >= 0)
);
--> statement-breakpoint
ALTER TABLE "collection_lineage" ADD CONSTRAINT "collection_lineage_child_collection_id_collections_id_fk" FOREIGN KEY ("child_collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_lineage" ADD CONSTRAINT "collection_lineage_source_collection_id_collections_id_fk" FOREIGN KEY ("source_collection_id") REFERENCES "public"."collections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_members" ADD CONSTRAINT "collection_members_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_nodes" ADD CONSTRAINT "collection_nodes_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_nodes" ADD CONSTRAINT "collection_nodes_parent_id_collection_nodes_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."collection_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "collection_lineage_child_idx" ON "collection_lineage" USING btree ("child_collection_id");--> statement-breakpoint
CREATE INDEX "collection_lineage_source_idx" ON "collection_lineage" USING btree ("source_collection_id");--> statement-breakpoint
CREATE INDEX "collection_members_user_active_idx" ON "collection_members" USING btree ("user_id","collection_id") WHERE "collection_members"."revoked_at" IS NULL;--> statement-breakpoint
CREATE INDEX "collection_nodes_collection_parent_position_idx" ON "collection_nodes" USING btree ("collection_id","parent_id","position_key");--> statement-breakpoint
CREATE INDEX "collection_nodes_collection_type_idx" ON "collection_nodes" USING btree ("collection_id","type");--> statement-breakpoint
CREATE INDEX "collection_nodes_parent_idx" ON "collection_nodes" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "collections_owner_position_idx" ON "collections" USING btree ("owner_user_id","position_key");--> statement-breakpoint
CREATE INDEX "collections_owner_updated_idx" ON "collections" USING btree ("owner_user_id","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "collections_legacy_jazz_id_uidx" ON "collections" USING btree ("legacy_jazz_id") WHERE "collections"."legacy_jazz_id" IS NOT NULL;
--> statement-breakpoint
CREATE FUNCTION "validate_collection_node_parent"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
	parent_collection_id uuid;
	parent_type collection_node_type;
	parent_deleted_at timestamptz;
BEGIN
	IF NEW.parent_id IS NULL THEN
		RETURN NEW;
	END IF;

	SELECT collection_id, type, deleted_at
	INTO parent_collection_id, parent_type, parent_deleted_at
	FROM collection_nodes
	WHERE id = NEW.parent_id;

	IF parent_collection_id IS NULL THEN
		RAISE EXCEPTION 'Collection node parent % does not exist', NEW.parent_id;
	END IF;

	IF parent_collection_id <> NEW.collection_id THEN
		RAISE EXCEPTION 'Collection node parent must belong to the same collection';
	END IF;

	IF parent_type <> 'section' THEN
		RAISE EXCEPTION 'Collection nodes can only be nested inside sections';
	END IF;

	IF parent_deleted_at IS NOT NULL THEN
		RAISE EXCEPTION 'Collection node parent is deleted';
	END IF;

	RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "collection_nodes_validate_parent"
BEFORE INSERT OR UPDATE OF collection_id, parent_id, type
ON "collection_nodes"
FOR EACH ROW
EXECUTE FUNCTION "validate_collection_node_parent"();
--> statement-breakpoint
CREATE FUNCTION "collection_node_item_contribution"(
	node_type collection_node_type,
	node_deleted_at timestamptz
)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
	SELECT CASE
		WHEN node_deleted_at IS NULL
			AND node_type IN ('product', 'link', 'photo')
		THEN 1
		ELSE 0
	END;
$$;
--> statement-breakpoint
CREATE FUNCTION "sync_collection_node_summary"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
	old_contribution integer := 0;
	new_contribution integer := 0;
BEGIN
	IF TG_OP <> 'INSERT' THEN
		old_contribution := collection_node_item_contribution(OLD.type, OLD.deleted_at);
	END IF;

	IF TG_OP <> 'DELETE' THEN
		new_contribution := collection_node_item_contribution(NEW.type, NEW.deleted_at);
	END IF;

	IF TG_OP = 'UPDATE' AND OLD.collection_id <> NEW.collection_id THEN
		UPDATE collections
		SET item_count = GREATEST(0, item_count - old_contribution),
			version = version + 1,
			updated_at = now()
		WHERE id = OLD.collection_id;

		UPDATE collections
		SET item_count = GREATEST(0, item_count + new_contribution),
			version = version + 1,
			updated_at = now()
		WHERE id = NEW.collection_id;
	ELSIF TG_OP = 'DELETE' THEN
		UPDATE collections
		SET item_count = GREATEST(0, item_count - old_contribution),
			version = version + 1,
			updated_at = now()
		WHERE id = OLD.collection_id;
	ELSE
		UPDATE collections
		SET item_count = GREATEST(
				0,
				item_count + new_contribution - old_contribution
			),
			version = version + 1,
			updated_at = now()
		WHERE id = NEW.collection_id;
	END IF;

	RETURN NULL;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "collection_nodes_sync_summary"
AFTER INSERT OR UPDATE OR DELETE
ON "collection_nodes"
FOR EACH ROW
EXECUTE FUNCTION "sync_collection_node_summary"();
--> statement-breakpoint
CREATE FUNCTION "recount_collection_items"(target_collection_id uuid)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
	next_count integer;
BEGIN
	SELECT COUNT(*)::integer
	INTO next_count
	FROM collection_nodes
	WHERE collection_id = target_collection_id
		AND collection_node_item_contribution(type, deleted_at) = 1;

	UPDATE collections
	SET item_count = next_count,
		version = version + 1,
		updated_at = now()
	WHERE id = target_collection_id;

	RETURN next_count;
END;
$$;
