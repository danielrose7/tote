-- Record how each item was added. Never blocks a save: writers that don't say
-- fall back to 'unknown'. Values are validated in application code, not by a
-- DB constraint, so new surfaces can be added without a migration.
ALTER TABLE collection_nodes
  ADD COLUMN IF NOT EXISTS added_via text NOT NULL DEFAULT 'unknown';


-- Best-effort backfill from signals that already exist. Anything we can't infer stays 'unknown'.
-- Items saved through the capture API (extension or mobile share) use the z:<timestamp>:<id> position key.
-- We can't tell the extension from mobile after the fact, so they get the generic 'capture'.
UPDATE collection_nodes
SET added_via = 'capture'
WHERE added_via = 'unknown'
  AND type = 'product'
  AND position_key LIKE 'z:%';

-- Remaining items in collections created by import / curator / copy came from that flow.
UPDATE collection_nodes n
SET added_via = c.origin_type::text
FROM collections c
WHERE n.collection_id = c.id
  AND n.added_via = 'unknown'
  AND c.origin_type IN ('import', 'curator', 'copy')
  AND n.created_at <= c.created_at + interval '1 minute';
