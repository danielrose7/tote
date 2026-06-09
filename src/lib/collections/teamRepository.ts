import { randomUUID } from "node:crypto";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import {
	collectionInvites,
	collectionMembers,
	collectionMembershipEvents,
	collections,
} from "../../db/schema";
import { db as productionDb } from "../db";
import { createInviteToken, hashInviteToken } from "./inviteToken";
import { type CollectionRole, roleCan } from "./permissions";
import type { CollectionDatabase, MutationResult } from "./repository";

async function getTeamManagerRole(
	actorUserId: string,
	collectionId: string,
	database: CollectionDatabase,
): Promise<CollectionRole | null> {
	const [access] = await database
		.select({ role: collectionMembers.role })
		.from(collectionMembers)
		.innerJoin(collections, eq(collections.id, collectionMembers.collectionId))
		.where(
			and(
				eq(collectionMembers.userId, actorUserId),
				eq(collectionMembers.collectionId, collectionId),
				isNull(collectionMembers.revokedAt),
				isNull(collections.deletedAt),
			),
		)
		.limit(1);

	return access?.role ?? null;
}

export type CollectionTeam = {
	members: Array<{
		userId: string;
		role: CollectionRole;
		invitedByUserId: string | null;
		joinedAt: Date;
	}>;
	invites: Array<{
		id: string;
		role: CollectionRole;
		recipientHint: string | null;
		createdByUserId: string;
		expiresAt: Date | null;
		maxUses: number | null;
		useCount: number;
		revokedAt: Date | null;
		createdAt: Date;
	}>;
	events: Array<{
		id: string;
		actorUserId: string;
		subjectUserId: string | null;
		inviteId: string | null;
		action: (typeof collectionMembershipEvents.$inferSelect)["action"];
		previousRole: CollectionRole | null;
		nextRole: CollectionRole | null;
		metadata: Record<string, unknown>;
		createdAt: Date;
	}>;
};

export async function getCollectionTeam(
	actorUserId: string,
	collectionId: string,
	database: CollectionDatabase = productionDb,
): Promise<MutationResult<CollectionTeam>> {
	const role = await getTeamManagerRole(actorUserId, collectionId, database);
	if (!role) {
		return { status: "not_found" };
	}
	if (!roleCan(role, "manage_members")) {
		return { status: "forbidden" };
	}

	const members = await database
		.select({
			userId: collectionMembers.userId,
			role: collectionMembers.role,
			invitedByUserId: collectionMembers.invitedByUserId,
			joinedAt: collectionMembers.createdAt,
		})
		.from(collectionMembers)
		.where(
			and(
				eq(collectionMembers.collectionId, collectionId),
				isNull(collectionMembers.revokedAt),
			),
		)
		.orderBy(asc(collectionMembers.createdAt));
	const invites = await database
		.select({
			id: collectionInvites.id,
			role: collectionInvites.role,
			recipientHint: collectionInvites.recipientHint,
			createdByUserId: collectionInvites.createdByUserId,
			expiresAt: collectionInvites.expiresAt,
			maxUses: collectionInvites.maxUses,
			useCount: collectionInvites.useCount,
			revokedAt: collectionInvites.revokedAt,
			createdAt: collectionInvites.createdAt,
		})
		.from(collectionInvites)
		.where(eq(collectionInvites.collectionId, collectionId))
		.orderBy(asc(collectionInvites.createdAt));
	const events = await database
		.select({
			id: collectionMembershipEvents.id,
			actorUserId: collectionMembershipEvents.actorUserId,
			subjectUserId: collectionMembershipEvents.subjectUserId,
			inviteId: collectionMembershipEvents.inviteId,
			action: collectionMembershipEvents.action,
			previousRole: collectionMembershipEvents.previousRole,
			nextRole: collectionMembershipEvents.nextRole,
			metadata: collectionMembershipEvents.metadata,
			createdAt: collectionMembershipEvents.createdAt,
		})
		.from(collectionMembershipEvents)
		.where(eq(collectionMembershipEvents.collectionId, collectionId))
		.orderBy(asc(collectionMembershipEvents.createdAt));

	return { status: "ok", value: { members, invites, events } };
}

export type CreateCollectionInviteInput = {
	role: "editor" | "viewer";
	recipientHint?: string;
	expiresAt?: Date;
	maxUses?: number;
};

export async function createCollectionInvite(
	actorUserId: string,
	collectionId: string,
	input: CreateCollectionInviteInput,
	database: CollectionDatabase = productionDb,
): Promise<
	MutationResult<{
		id: string;
		token: string;
		role: "editor" | "viewer";
		expiresAt: Date | null;
		maxUses: number | null;
	}>
> {
	const role = await getTeamManagerRole(actorUserId, collectionId, database);
	if (!role) {
		return { status: "not_found" };
	}
	if (!roleCan(role, "manage_members")) {
		return { status: "forbidden" };
	}

	const inviteId = randomUUID();
	const token = createInviteToken();
	const tokenHash = hashInviteToken(token);
	const result = (await database.execute<{
		id: string;
		role: "editor" | "viewer";
		expiresAt: Date | null;
		maxUses: number | null;
	}>(sql`
		WITH inserted_invite AS (
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
				${inviteId},
				${collectionId},
				${actorUserId},
				${input.role},
				${input.recipientHint ?? null},
				${tokenHash},
				${input.expiresAt ?? null},
				${input.maxUses ?? null}
			)
			RETURNING id, role, expires_at, max_uses
		),
		inserted_event AS (
			INSERT INTO collection_membership_events (
				collection_id,
				actor_user_id,
				invite_id,
				action,
				next_role,
				metadata
			)
			SELECT
				${collectionId},
				${actorUserId},
				id,
				'invite_created',
				role,
				jsonb_build_object(
					'recipientHint',
					${input.recipientHint ?? null}::text
				)
			FROM inserted_invite
			RETURNING invite_id
		)
		SELECT
			invited.id,
			invited.role,
			invited.expires_at AS "expiresAt",
			invited.max_uses AS "maxUses"
		FROM inserted_invite invited
		INNER JOIN inserted_event event ON event.invite_id = invited.id
	`)) as {
		rows: Array<{
			id: string;
			role: "editor" | "viewer";
			expiresAt: Date | null;
			maxUses: number | null;
		}>;
	};

	const invite = result.rows[0];
	if (!invite) {
		throw new Error("Invite creation did not return a row");
	}

	return {
		status: "ok",
		value: {
			...invite,
			expiresAt: invite.expiresAt ? new Date(invite.expiresAt) : null,
			token,
		},
	};
}

export async function revokeCollectionInvite(
	actorUserId: string,
	collectionId: string,
	inviteId: string,
	database: CollectionDatabase = productionDb,
): Promise<MutationResult<{ revokedAt: Date }>> {
	const role = await getTeamManagerRole(actorUserId, collectionId, database);
	if (!role) {
		return { status: "not_found" };
	}
	if (!roleCan(role, "manage_members")) {
		return { status: "forbidden" };
	}

	const result = (await database.execute<{ revokedAt: Date }>(sql`
		WITH revoked_invite AS (
			UPDATE collection_invites
			SET revoked_at = now(),
				updated_at = now()
			WHERE id = ${inviteId}
				AND collection_id = ${collectionId}
				AND revoked_at IS NULL
			RETURNING id, role, revoked_at
		),
		inserted_event AS (
			INSERT INTO collection_membership_events (
				collection_id,
				actor_user_id,
				invite_id,
				action,
				previous_role
			)
			SELECT
				${collectionId},
				${actorUserId},
				id,
				'invite_revoked',
				role
			FROM revoked_invite
			RETURNING invite_id
		)
		SELECT revoked.revoked_at AS "revokedAt"
		FROM revoked_invite revoked
		INNER JOIN inserted_event event ON event.invite_id = revoked.id
	`)) as { rows: Array<{ revokedAt: Date }> };

	const revoked = result.rows[0];
	return revoked
		? {
				status: "ok",
				value: { revokedAt: new Date(revoked.revokedAt) },
			}
		: { status: "not_found" };
}

async function getActiveMemberRole(
	collectionId: string,
	userId: string,
	database: CollectionDatabase,
): Promise<CollectionRole | null> {
	const [member] = await database
		.select({ role: collectionMembers.role })
		.from(collectionMembers)
		.where(
			and(
				eq(collectionMembers.collectionId, collectionId),
				eq(collectionMembers.userId, userId),
				isNull(collectionMembers.revokedAt),
			),
		)
		.limit(1);

	return member?.role ?? null;
}

function canManageMember(
	actorUserId: string,
	actorRole: CollectionRole,
	targetUserId: string,
	targetRole: CollectionRole,
	nextRole?: Exclude<CollectionRole, "owner">,
): boolean {
	if (targetRole === "owner" || actorUserId === targetUserId) {
		return false;
	}
	if (actorRole === "owner") {
		return true;
	}
	if (actorRole !== "admin" || targetRole === "admin") {
		return false;
	}
	return nextRole !== "admin";
}

export async function changeCollectionMemberRole(
	actorUserId: string,
	collectionId: string,
	targetUserId: string,
	nextRole: Exclude<CollectionRole, "owner">,
	database: CollectionDatabase = productionDb,
): Promise<MutationResult<{ role: Exclude<CollectionRole, "owner"> }>> {
	const actorRole = await getTeamManagerRole(
		actorUserId,
		collectionId,
		database,
	);
	if (!actorRole) {
		return { status: "not_found" };
	}
	if (!roleCan(actorRole, "manage_members")) {
		return { status: "forbidden" };
	}

	const targetRole = await getActiveMemberRole(
		collectionId,
		targetUserId,
		database,
	);
	if (!targetRole) {
		return { status: "not_found" };
	}
	if (
		!canManageMember(actorUserId, actorRole, targetUserId, targetRole, nextRole)
	) {
		return { status: "forbidden" };
	}
	if (targetRole === nextRole) {
		return { status: "ok", value: { role: nextRole } };
	}

	const result = (await database.execute<{ role: typeof nextRole }>(sql`
		WITH updated_member AS (
			UPDATE collection_members
			SET role = ${nextRole},
				updated_at = now()
			WHERE collection_id = ${collectionId}
				AND user_id = ${targetUserId}
				AND role = ${targetRole}
				AND revoked_at IS NULL
				AND EXISTS (
					SELECT 1
					FROM collection_members actor
					WHERE actor.collection_id = ${collectionId}
						AND actor.user_id = ${actorUserId}
						AND actor.role = ${actorRole}
						AND actor.revoked_at IS NULL
				)
			RETURNING role
		),
		inserted_event AS (
			INSERT INTO collection_membership_events (
				collection_id,
				actor_user_id,
				subject_user_id,
				action,
				previous_role,
				next_role
			)
			SELECT
				${collectionId},
				${actorUserId},
				${targetUserId},
				'role_changed',
				${targetRole},
				role
			FROM updated_member
			RETURNING next_role
		)
		SELECT member.role
		FROM updated_member member
		INNER JOIN inserted_event event ON event.next_role = member.role
	`)) as { rows: Array<{ role: typeof nextRole }> };

	const updated = result.rows[0];
	return updated
		? { status: "ok", value: updated }
		: { status: "version_conflict" };
}

export async function removeCollectionMember(
	actorUserId: string,
	collectionId: string,
	targetUserId: string,
	database: CollectionDatabase = productionDb,
): Promise<MutationResult<{ revokedAt: Date }>> {
	const actorRole = await getTeamManagerRole(
		actorUserId,
		collectionId,
		database,
	);
	if (!actorRole) {
		return { status: "not_found" };
	}
	if (!roleCan(actorRole, "manage_members")) {
		return { status: "forbidden" };
	}

	const targetRole = await getActiveMemberRole(
		collectionId,
		targetUserId,
		database,
	);
	if (!targetRole) {
		return { status: "not_found" };
	}
	if (!canManageMember(actorUserId, actorRole, targetUserId, targetRole)) {
		return { status: "forbidden" };
	}

	const result = (await database.execute<{ revokedAt: Date }>(sql`
		WITH revoked_member AS (
			UPDATE collection_members
			SET revoked_at = now(),
				updated_at = now()
			WHERE collection_id = ${collectionId}
				AND user_id = ${targetUserId}
				AND role = ${targetRole}
				AND revoked_at IS NULL
				AND EXISTS (
					SELECT 1
					FROM collection_members actor
					WHERE actor.collection_id = ${collectionId}
						AND actor.user_id = ${actorUserId}
						AND actor.role = ${actorRole}
						AND actor.revoked_at IS NULL
				)
			RETURNING revoked_at
		),
		inserted_event AS (
			INSERT INTO collection_membership_events (
				collection_id,
				actor_user_id,
				subject_user_id,
				action,
				previous_role
			)
			SELECT
				${collectionId},
				${actorUserId},
				${targetUserId},
				'member_removed',
				${targetRole}
			FROM revoked_member
			RETURNING subject_user_id
		)
		SELECT member.revoked_at AS "revokedAt"
		FROM revoked_member member
		INNER JOIN inserted_event event
			ON event.subject_user_id = ${targetUserId}
	`)) as { rows: Array<{ revokedAt: Date }> };

	const removed = result.rows[0];
	return removed
		? {
				status: "ok",
				value: { revokedAt: new Date(removed.revokedAt) },
			}
		: { status: "version_conflict" };
}

export async function acceptCollectionInvite(
	actorUserId: string,
	token: string,
	database: CollectionDatabase = productionDb,
): Promise<
	MutationResult<{
		collectionId: string;
		inviteId: string;
		role: CollectionRole;
	}>
> {
	const tokenHash = hashInviteToken(token);
	const result = (await database.execute<{
		collectionId: string;
		inviteId: string;
		role: CollectionRole;
	}>(sql`
		WITH valid_invite AS (
			SELECT
				invite.id,
				invite.collection_id,
				invite.created_by_user_id,
				invite.role,
				member.role AS previous_role,
				member.revoked_at AS previous_revoked_at
			FROM collection_invites invite
			INNER JOIN collections collection
				ON collection.id = invite.collection_id
				AND collection.deleted_at IS NULL
			LEFT JOIN collection_members member
				ON member.collection_id = invite.collection_id
				AND member.user_id = ${actorUserId}
			WHERE invite.token_hash = ${tokenHash}
				AND invite.revoked_at IS NULL
				AND (invite.expires_at IS NULL OR invite.expires_at > now())
				AND (invite.max_uses IS NULL OR invite.use_count < invite.max_uses)
			FOR UPDATE OF invite
		),
		upserted_member AS (
			INSERT INTO collection_members (
				collection_id,
				user_id,
				role,
				invited_by_user_id
			)
			SELECT
				collection_id,
				${actorUserId},
				role,
				created_by_user_id
			FROM valid_invite
			ON CONFLICT (collection_id, user_id)
			DO UPDATE SET
				role = CASE
					WHEN collection_members.revoked_at IS NOT NULL
						THEN EXCLUDED.role
					WHEN (
						CASE collection_members.role
							WHEN 'owner' THEN 4
							WHEN 'admin' THEN 3
							WHEN 'editor' THEN 2
							WHEN 'viewer' THEN 1
						END
					) >= (
						CASE EXCLUDED.role
							WHEN 'owner' THEN 4
							WHEN 'admin' THEN 3
							WHEN 'editor' THEN 2
							WHEN 'viewer' THEN 1
						END
					)
						THEN collection_members.role
					ELSE EXCLUDED.role
				END,
				invited_by_user_id = CASE
					WHEN collection_members.revoked_at IS NULL
						THEN collection_members.invited_by_user_id
					ELSE EXCLUDED.invited_by_user_id
				END,
				revoked_at = NULL,
				updated_at = now()
			RETURNING collection_id, role
		),
		used_invite AS (
			UPDATE collection_invites invite
			SET use_count = invite.use_count + 1,
				updated_at = now()
			FROM valid_invite valid, upserted_member member
			WHERE invite.id = valid.id
				AND member.collection_id = valid.collection_id
			RETURNING invite.id, invite.collection_id
		),
		inserted_event AS (
			INSERT INTO collection_membership_events (
				collection_id,
				actor_user_id,
				subject_user_id,
				invite_id,
				action,
				previous_role,
				next_role,
				metadata
			)
			SELECT
				used.collection_id,
				${actorUserId},
				${actorUserId},
				used.id,
				'invite_accepted',
				valid.previous_role,
				member.role,
				jsonb_build_object(
					'reactivated',
					valid.previous_revoked_at IS NOT NULL
				)
			FROM used_invite used
			INNER JOIN valid_invite valid ON valid.id = used.id
			INNER JOIN upserted_member member
				ON member.collection_id = used.collection_id
			RETURNING collection_id, invite_id, next_role
		)
		SELECT
			collection_id AS "collectionId",
			invite_id AS "inviteId",
			next_role AS role
		FROM inserted_event
	`)) as {
		rows: Array<{
			collectionId: string;
			inviteId: string;
			role: CollectionRole;
		}>;
	};

	const accepted = result.rows[0];
	return accepted ? { status: "ok", value: accepted } : { status: "not_found" };
}

export async function transferCollectionOwnership(
	actorUserId: string,
	collectionId: string,
	targetUserId: string,
	database: CollectionDatabase = productionDb,
): Promise<MutationResult<{ version: number }>> {
	const actorRole = await getTeamManagerRole(
		actorUserId,
		collectionId,
		database,
	);
	if (!actorRole) {
		return { status: "not_found" };
	}
	if (actorRole !== "owner" || actorUserId === targetUserId) {
		return { status: "forbidden" };
	}

	const targetRole = await getActiveMemberRole(
		collectionId,
		targetUserId,
		database,
	);
	if (!targetRole) {
		return { status: "not_found" };
	}
	if (targetRole === "owner") {
		return { status: "forbidden" };
	}

	const result = (await database.execute<{ version: number }>(sql`
		WITH updated_collection AS (
			UPDATE collections
			SET owner_user_id = ${targetUserId},
				version = version + 1,
				updated_at = now()
			WHERE id = ${collectionId}
				AND owner_user_id = ${actorUserId}
				AND deleted_at IS NULL
				AND EXISTS (
					SELECT 1
					FROM collection_members target
					WHERE target.collection_id = ${collectionId}
						AND target.user_id = ${targetUserId}
						AND target.role <> 'owner'
						AND target.revoked_at IS NULL
				)
			RETURNING id, version
		),
		updated_members AS (
			UPDATE collection_members member
			SET role = CASE
					WHEN member.user_id = ${targetUserId}
						THEN 'owner'::collection_role
					ELSE 'admin'::collection_role
				END,
				updated_at = now()
			FROM updated_collection collection
			WHERE member.collection_id = collection.id
				AND member.user_id IN (${actorUserId}, ${targetUserId})
				AND member.revoked_at IS NULL
			RETURNING member.user_id, member.role
		),
		inserted_event AS (
			INSERT INTO collection_membership_events (
				collection_id,
				actor_user_id,
				subject_user_id,
				action,
				previous_role,
				next_role,
				metadata
			)
			SELECT
				collection.id,
				${actorUserId},
				${targetUserId},
				'ownership_transferred',
				${targetRole},
				'owner',
				jsonb_build_object('previousOwnerRole', 'admin')
			FROM updated_collection collection
			WHERE (
				SELECT count(*)
				FROM updated_members
			) = 2
			RETURNING collection_id
		)
		SELECT collection.version
		FROM updated_collection collection
		INNER JOIN inserted_event event ON event.collection_id = collection.id
	`)) as { rows: Array<{ version: number }> };

	const transferred = result.rows[0];
	return transferred
		? { status: "ok", value: { version: Number(transferred.version) } }
		: { status: "version_conflict" };
}
