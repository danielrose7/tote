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

UPDATE collection_members
SET invited_by_user_id = 'user_owner'
WHERE collection_id = '10000000-0000-4000-8000-000000000001'
	AND user_id IN ('user_admin', 'user_editor', 'user_viewer');

INSERT INTO collection_invites (
	id,
	collection_id,
	created_by_user_id,
	role,
	recipient_hint,
	token_hash,
	expires_at,
	max_uses
) VALUES (
	'60000000-0000-4000-8000-000000000001',
	'10000000-0000-4000-8000-000000000001',
	'user_admin',
	'viewer',
	'teammate@example.com',
	'sha256:integration-invite',
	'2026-06-15T12:00:00Z',
	1
);

INSERT INTO collection_membership_events (
	collection_id,
	actor_user_id,
	invite_id,
	action,
	next_role,
	metadata
) VALUES (
	'10000000-0000-4000-8000-000000000001',
	'user_admin',
	'60000000-0000-4000-8000-000000000001',
	'invite_created',
	'viewer',
	'{"source":"integration_seed"}'
);

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
