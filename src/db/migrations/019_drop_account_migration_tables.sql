-- Retire the Jazz → Neon cutover tracking tables (created by drizzle/0001).
-- The Classic/Neon routing they drove was removed with Jazz; no application
-- code reads or writes them, and every row was in a terminal state
-- (4 accounts 'neon', 4 migrations 'completed', last touched 2026-07-14).
--
-- The account_data_source enum was only used by account_data_sources.
-- data_migration_status stays: publication_snapshot_migrations still uses it.
DROP TABLE IF EXISTS account_collection_migrations;
DROP TABLE IF EXISTS account_data_sources;
DROP TYPE IF EXISTS account_data_source;
