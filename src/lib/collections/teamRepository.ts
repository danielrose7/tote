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
