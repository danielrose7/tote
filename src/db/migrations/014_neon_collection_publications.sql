ALTER TABLE published_collections
	ALTER COLUMN source_jazz_id DROP NOT NULL;

ALTER TABLE published_collections
	ADD COLUMN IF NOT EXISTS source_collection_id UUID REFERENCES collections(id) ON DELETE SET NULL,
	ADD COLUMN IF NOT EXISTS source_version BIGINT,
	ADD COLUMN IF NOT EXISTS schema_version INTEGER NOT NULL DEFAULT 2;

CREATE UNIQUE INDEX IF NOT EXISTS published_collections_source_collection_uidx
	ON published_collections (source_collection_id)
	WHERE source_collection_id IS NOT NULL;

ALTER TABLE published_blocks
	ADD COLUMN IF NOT EXISTS source_node_id UUID REFERENCES collection_nodes(id) ON DELETE SET NULL;

ALTER TABLE published_blocks
	DROP CONSTRAINT IF EXISTS published_blocks_type_check;

ALTER TABLE published_blocks
	ADD CONSTRAINT published_blocks_type_check
	CHECK (type IN ('section', 'product', 'link', 'photo', 'note', 'text', 'slot'));

CREATE UNIQUE INDEX IF NOT EXISTS published_blocks_collection_source_node_uidx
	ON published_blocks (collection_id, source_node_id)
	WHERE source_node_id IS NOT NULL;
