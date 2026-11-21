-- Retire the Ably Postgres connector tables (created by drizzle/0004).
-- Mutations now publish to Ably's REST API after commit
-- (src/lib/collections/realtimePublish.ts), and the connector's LISTEN
-- connection on ably_adbc kept Neon compute from ever scaling to zero.
-- Nothing reads or writes these tables any more; the connector integration
-- in the Ably dashboard has been disabled.
--
-- DROP TABLE also removes ably_outbox_notify_trigger; the trigger function
-- has to be dropped on its own.
DROP TABLE IF EXISTS ably_outbox;
DROP TABLE IF EXISTS ably_nodes;
DROP FUNCTION IF EXISTS public.ably_outbox_notify();
