-- Fix position keys for nodes saved via capture that used the old z:{uuid} format.
-- The old format sorted by UUID (random), not insertion order.
-- Update to z:{created_at}:{id} so items sort chronologically within the z: namespace.
UPDATE collection_nodes
SET position_key = 'z:' || to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') || ':' || id
WHERE position_key = 'z:' || id::text
  AND deleted_at IS NULL;
