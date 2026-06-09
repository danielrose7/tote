CREATE TABLE "collection_mutation_receipts" (
	"user_id" text NOT NULL,
	"mutation_id" uuid NOT NULL,
	"operation" text NOT NULL,
	"request_fingerprint" text NOT NULL,
	"response" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "collection_mutation_receipts_user_id_mutation_id_pk" PRIMARY KEY("user_id","mutation_id"),
	CONSTRAINT "collection_mutation_receipts_expiry_after_creation" CHECK ("collection_mutation_receipts"."expires_at" > "collection_mutation_receipts"."created_at")
);
--> statement-breakpoint
CREATE INDEX "collection_mutation_receipts_expires_idx" ON "collection_mutation_receipts" USING btree ("expires_at");