\set ON_ERROR_STOP on

DO $$
DECLARE
	actual_count integer;
BEGIN
	SELECT item_count
	INTO actual_count
	FROM collections
	WHERE id = '10000000-0000-4000-8000-000000000001';

	IF actual_count <> 3 THEN
		RAISE EXCEPTION 'expected seeded item_count 3, got %', actual_count;
	END IF;
END;
$$;

INSERT INTO collection_nodes (
	id,
	collection_id,
	type,
	title,
	properties,
	position_key,
	created_by_user_id
) VALUES (
	'20000000-0000-4000-8000-000000000006',
	'10000000-0000-4000-8000-000000000001',
	'text',
	'Uncounted text',
	'{}',
	'a4',
	'user_editor'
);

DO $$
DECLARE
	actual_count integer;
BEGIN
	SELECT item_count
	INTO actual_count
	FROM collections
	WHERE id = '10000000-0000-4000-8000-000000000001';

	IF actual_count <> 3 THEN
		RAISE EXCEPTION 'text node changed item_count to %', actual_count;
	END IF;
END;
$$;

UPDATE collection_nodes
SET deleted_at = now()
WHERE id = '20000000-0000-4000-8000-000000000003';

DO $$
DECLARE
	actual_count integer;
BEGIN
	SELECT item_count
	INTO actual_count
	FROM collections
	WHERE id = '10000000-0000-4000-8000-000000000001';

	IF actual_count <> 2 THEN
		RAISE EXCEPTION 'soft delete expected item_count 2, got %', actual_count;
	END IF;
END;
$$;

UPDATE collection_nodes
SET deleted_at = NULL
WHERE id = '20000000-0000-4000-8000-000000000003';

UPDATE collection_nodes
SET type = 'note'
WHERE id = '20000000-0000-4000-8000-000000000004';

DO $$
DECLARE
	actual_count integer;
BEGIN
	SELECT item_count
	INTO actual_count
	FROM collections
	WHERE id = '10000000-0000-4000-8000-000000000001';

	IF actual_count <> 2 THEN
		RAISE EXCEPTION 'type conversion expected item_count 2, got %', actual_count;
	END IF;
END;
$$;

DO $$
BEGIN
	BEGIN
		INSERT INTO collection_nodes (
			id,
			collection_id,
			parent_id,
			type,
			title,
			properties,
			position_key,
			created_by_user_id
		) VALUES (
			'20000000-0000-4000-8000-000000000099',
			'10000000-0000-4000-8000-000000000001',
			'20000000-0000-4000-8000-000000000002',
			'product',
			'Invalid child',
			'{}',
			'z0',
			'user_owner'
		);
		RAISE EXCEPTION 'expected non-section parent validation to fail';
	EXCEPTION
		WHEN raise_exception THEN
			IF SQLERRM = 'expected non-section parent validation to fail' THEN
				RAISE;
			END IF;
	END;
END;
$$;

DO $$
BEGIN
	BEGIN
		UPDATE account_data_sources
		SET rollback_expires_at = cutover_at
		WHERE user_id = 'user_owner';
		RAISE EXCEPTION 'expected rollback window constraint to fail';
	EXCEPTION
		WHEN check_violation THEN
			NULL;
	END;
END;
$$;

DO $$
BEGIN
	BEGIN
		INSERT INTO collection_invites (
			collection_id,
			created_by_user_id,
			role,
			token_hash
		) VALUES (
			'10000000-0000-4000-8000-000000000001',
			'user_owner',
			'owner',
			'sha256:invalid-owner-invite'
		);
		RAISE EXCEPTION 'expected owner invite constraint to fail';
	EXCEPTION
		WHEN check_violation THEN
			NULL;
	END;

	BEGIN
		INSERT INTO collection_invites (
			collection_id,
			created_by_user_id,
			role,
			token_hash
		) VALUES (
			'10000000-0000-4000-8000-000000000001',
			'user_owner',
			'viewer',
			'sha256:integration-invite'
		);
		RAISE EXCEPTION 'expected duplicate invite token hash to fail';
	EXCEPTION
		WHEN unique_violation THEN
			NULL;
	END;
END;
$$;

WITH RECURSIVE subtree AS (
	SELECT id
	FROM collection_nodes
	WHERE id = '20000000-0000-4000-8000-000000000001'
		AND collection_id = '10000000-0000-4000-8000-000000000001'
		AND deleted_at IS NULL

	UNION ALL

	SELECT child.id
	FROM collection_nodes child
	INNER JOIN subtree parent ON child.parent_id = parent.id
	WHERE child.collection_id = '10000000-0000-4000-8000-000000000001'
		AND child.deleted_at IS NULL
)
UPDATE collection_nodes
SET deleted_at = now(),
	version = version + 1,
	updated_at = now()
WHERE id IN (SELECT id FROM subtree);

DO $$
DECLARE
	active_subtree_count integer;
	actual_count integer;
BEGIN
	SELECT COUNT(*)
	INTO active_subtree_count
	FROM collection_nodes
	WHERE id IN (
		'20000000-0000-4000-8000-000000000001',
		'20000000-0000-4000-8000-000000000002'
	)
		AND deleted_at IS NULL;

	SELECT item_count
	INTO actual_count
	FROM collections
	WHERE id = '10000000-0000-4000-8000-000000000001';

	IF active_subtree_count <> 0 THEN
		RAISE EXCEPTION 'recursive soft delete left % active nodes', active_subtree_count;
	END IF;

	IF actual_count <> 1 THEN
		RAISE EXCEPTION 'recursive soft delete expected item_count 1, got %', actual_count;
	END IF;
END;
$$;

DO $$
DECLARE
	member_count integer;
	invite_count integer;
	event_count integer;
	migration_status data_migration_status;
BEGIN
	SELECT COUNT(*)
	INTO member_count
	FROM collection_members
	WHERE collection_id = '10000000-0000-4000-8000-000000000001'
		AND revoked_at IS NULL;

	SELECT COUNT(*)
	INTO invite_count
	FROM collection_invites
	WHERE collection_id = '10000000-0000-4000-8000-000000000001'
		AND revoked_at IS NULL;

	SELECT COUNT(*)
	INTO event_count
	FROM collection_membership_events
	WHERE collection_id = '10000000-0000-4000-8000-000000000001';

	SELECT status
	INTO migration_status
	FROM publication_snapshot_migrations
	WHERE legacy_publication_id = '30000000-0000-4000-8000-000000000001';

	IF member_count <> 4 THEN
		RAISE EXCEPTION 'expected four active seeded members, got %', member_count;
	END IF;

	IF invite_count <> 1 THEN
		RAISE EXCEPTION 'expected one active seeded invite, got %', invite_count;
	END IF;

	IF event_count <> 1 THEN
		RAISE EXCEPTION 'expected one seeded membership event, got %', event_count;
	END IF;

	IF migration_status <> 'completed' THEN
		RAISE EXCEPTION 'expected completed publication migration, got %', migration_status;
	END IF;
END;
$$;
