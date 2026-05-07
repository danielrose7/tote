ALTER TABLE published_collections ADD COLUMN username TEXT;
CREATE INDEX IF NOT EXISTS published_collections_username_idx ON published_collections (username);
