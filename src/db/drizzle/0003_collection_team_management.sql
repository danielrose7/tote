CREATE TYPE "public"."collection_membership_action" AS ENUM('invite_created', 'invite_revoked', 'invite_accepted', 'role_changed', 'member_removed', 'ownership_transferred');--> statement-breakpoint
CREATE TABLE "collection_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"collection_id" uuid NOT NULL,
	"created_by_user_id" text NOT NULL,
	"role" "collection_role" NOT NULL,
	"recipient_hint" text,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone,
	"max_uses" integer,
	"use_count" integer DEFAULT 0 NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collection_invites_role_not_owner" CHECK ("collection_invites"."role" <> 'owner'),
	CONSTRAINT "collection_invites_positive_max_uses" CHECK ("collection_invites"."max_uses" IS NULL OR "collection_invites"."max_uses" > 0),
	CONSTRAINT "collection_invites_valid_use_count" CHECK ("collection_invites"."use_count" >= 0 AND ("collection_invites"."max_uses" IS NULL OR "collection_invites"."use_count" <= "collection_invites"."max_uses"))
);
--> statement-breakpoint
CREATE TABLE "collection_membership_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"collection_id" uuid NOT NULL,
	"actor_user_id" text NOT NULL,
	"subject_user_id" text,
	"invite_id" uuid,
	"action" "collection_membership_action" NOT NULL,
	"previous_role" "collection_role",
	"next_role" "collection_role",
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "collection_members" ADD COLUMN "invited_by_user_id" text;--> statement-breakpoint
ALTER TABLE "collection_invites" ADD CONSTRAINT "collection_invites_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_membership_events" ADD CONSTRAINT "collection_membership_events_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_membership_events" ADD CONSTRAINT "collection_membership_events_invite_id_collection_invites_id_fk" FOREIGN KEY ("invite_id") REFERENCES "public"."collection_invites"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "collection_invites_token_hash_uidx" ON "collection_invites" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "collection_invites_collection_status_idx" ON "collection_invites" USING btree ("collection_id","revoked_at","expires_at");--> statement-breakpoint
CREATE INDEX "collection_membership_events_collection_created_idx" ON "collection_membership_events" USING btree ("collection_id","created_at");--> statement-breakpoint
CREATE INDEX "collection_membership_events_subject_idx" ON "collection_membership_events" USING btree ("subject_user_id");