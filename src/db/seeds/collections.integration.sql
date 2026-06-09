INSERT INTO account_data_sources (
	user_id,
	data_source,
	migration_version,
	cutover_at,
	rollback_expires_at,
	last_verified_at
) VALUES
	(
		'user_owner',
		'neon',
		1,
		'2026-06-01T12:00:00Z',
		'2026-06-15T12:00:00Z',
		'2026-06-01T11:55:00Z'
	),
	('user_admin', 'neon_verifying', 1, NULL, NULL, '2026-06-01T11:55:00Z'),
	('user_editor', 'neon', 1, '2026-06-01T12:00:00Z', '2026-06-15T12:00:00Z', '2026-06-01T11:55:00Z'),
	('user_viewer', 'neon', 1, '2026-06-01T12:00:00Z', '2026-06-15T12:00:00Z', '2026-06-01T11:55:00Z');

INSERT INTO account_collection_migrations (
	user_id,
	migration_version,
	status,
	source_collection_count,
	source_item_count,
	imported_collection_count,
	imported_item_count,
	source_fingerprint,
	import_fingerprint,
	started_at,
	completed_at
) VALUES (
	'user_owner',
	1,
	'completed',
	1,
	3,
	1,
	3,
	'sha256:integration-fixture',
	'sha256:integration-fixture',
	'2026-06-01T11:00:00Z',
	'2026-06-01T11:55:00Z'
);

INSERT INTO collections (
	id,
	owner_user_id,
	name,
	description,
	color,
	item_count,
	position_key,
	origin_type,
	legacy_jazz_id
) VALUES (
	'10000000-0000-4000-8000-000000000001',
	'user_owner',
	'Integration Test Collection',
	'Deterministic fixture for PostgreSQL integration tests',
	'#6366f1',
	0,
	'a0',
	'import',
	'co_zIntegrationCollection'
);

INSERT INTO collection_members (collection_id, user_id, role) VALUES
	('10000000-0000-4000-8000-000000000001', 'user_owner', 'owner'),
	('10000000-0000-4000-8000-000000000001', 'user_admin', 'admin'),
	('10000000-0000-4000-8000-000000000001', 'user_editor', 'editor'),
	('10000000-0000-4000-8000-000000000001', 'user_viewer', 'viewer');

INSERT INTO collection_nodes (
	id,
	collection_id,
	parent_id,
	type,
	title,
	properties,
	position_key,
	created_by_user_id
) VALUES
	(
		'20000000-0000-4000-8000-000000000001',
		'10000000-0000-4000-8000-000000000001',
		NULL,
		'section',
		'Desk setup',
		'{}',
		'a0',
		'user_owner'
	),
	(
		'20000000-0000-4000-8000-000000000002',
		'10000000-0000-4000-8000-000000000001',
		'20000000-0000-4000-8000-000000000001',
		'product',
		'Desk lamp',
		'{"url":"https://example.com/lamp","price":"49.00"}',
		'a0',
		'user_owner'
	),
	(
		'20000000-0000-4000-8000-000000000003',
		'10000000-0000-4000-8000-000000000001',
		NULL,
		'link',
		'Lighting guide',
		'{"url":"https://example.com/guide"}',
		'a1',
		'user_editor'
	),
	(
		'20000000-0000-4000-8000-000000000004',
		'10000000-0000-4000-8000-000000000001',
		NULL,
		'photo',
		'Inspiration',
		'{"imageUrl":"https://example.com/inspiration.jpg"}',
		'a2',
		'user_editor'
	),
	(
		'20000000-0000-4000-8000-000000000005',
		'10000000-0000-4000-8000-000000000001',
		NULL,
		'note',
		'Measure the desk first',
		'{}',
		'a3',
		'user_owner'
	);

INSERT INTO publication_snapshot_migrations (
	legacy_publication_id,
	source_jazz_id,
	source_collection_id,
	migration_version,
	target_schema_version,
	status,
	source_node_count,
	imported_node_count,
	source_fingerprint,
	import_fingerprint,
	started_at,
	completed_at
) VALUES (
	'30000000-0000-4000-8000-000000000001',
	'co_zIntegrationCollection',
	'10000000-0000-4000-8000-000000000001',
	1,
	2,
	'completed',
	5,
	5,
	'sha256:publication-fixture',
	'sha256:publication-fixture',
	'2026-06-01T12:05:00Z',
	'2026-06-01T12:06:00Z'
);
