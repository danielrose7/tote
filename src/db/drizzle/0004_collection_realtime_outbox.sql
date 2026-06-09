CREATE TABLE "ably_nodes" (
	"id" text PRIMARY KEY NOT NULL,
	"expiry" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ably_outbox" (
	"sequence_id" serial PRIMARY KEY NOT NULL,
	"mutation_id" text NOT NULL,
	"channel" text NOT NULL,
	"name" text NOT NULL,
	"rejected" boolean DEFAULT false NOT NULL,
	"data" jsonb,
	"headers" jsonb,
	"locked_by" text,
	"lock_expiry" timestamp,
	"processed" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.ably_outbox_notify()
RETURNS trigger AS $$
BEGIN
	PERFORM pg_notify('ably_adbc'::text, ''::text);
	RETURN NULL;
EXCEPTION
	WHEN others THEN
		RAISE WARNING 'unexpected Ably outbox notification error: %', SQLERRM;
		RETURN NULL;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER ably_outbox_notify_trigger
AFTER INSERT ON public.ably_outbox
FOR EACH STATEMENT
EXECUTE PROCEDURE public.ably_outbox_notify();
