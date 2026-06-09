import { eq } from "drizzle-orm";
import {
	createCollectionInvite,
	getCollectionTeam,
	revokeCollectionInvite,
} from "../../lib/collections/teamRepository";
import { collectionInvites, collectionMembershipEvents } from "../schema";
import {
	collectionFactory,
	collectionMemberFactory,
} from "../testing/factories";
import { dbTest, expect } from "../testing/vitest";

async function createTeamCollection(ownerUserId: string) {
	const collection = await collectionFactory.create({ ownerUserId });
	await collectionMemberFactory.create({
		collectionId: collection.id,
		userId: ownerUserId,
		role: "owner",
	});
	return collection;
}

dbTest("limits collection team reads to owners and admins", async ({ db }) => {
	const collection = await createTeamCollection("team_owner");
	await collectionMemberFactory.create({
		collectionId: collection.id,
		userId: "team_viewer",
		role: "viewer",
		invitedByUserId: "team_owner",
	});

	expect(await getCollectionTeam("team_viewer", collection.id, db)).toEqual({
		status: "forbidden",
	});

	const team = await getCollectionTeam("team_owner", collection.id, db);
	expect(team.status).toBe("ok");
	if (team.status !== "ok") {
		throw new Error("Expected owner to read collection team");
	}
	expect(team.value.members).toHaveLength(2);
	expect(team.value.invites).toEqual([]);
	expect(team.value.events).toEqual([]);
});

dbTest("creates hashed invites with an audit event", async ({ db }) => {
	const collection = await createTeamCollection("invite_owner");
	const result = await createCollectionInvite(
		"invite_owner",
		collection.id,
		{
			role: "editor",
			recipientHint: "editor@example.com",
			maxUses: 2,
		},
		db,
	);

	expect(result.status).toBe("ok");
	if (result.status !== "ok") {
		throw new Error("Expected invite creation to succeed");
	}

	const [storedInvite] = await db
		.select()
		.from(collectionInvites)
		.where(eq(collectionInvites.id, result.value.id));
	const [event] = await db
		.select()
		.from(collectionMembershipEvents)
		.where(eq(collectionMembershipEvents.inviteId, result.value.id));

	expect(storedInvite.tokenHash).not.toBe(result.value.token);
	expect(storedInvite.tokenHash).toHaveLength(64);
	expect(storedInvite).toMatchObject({
		createdByUserId: "invite_owner",
		role: "editor",
		recipientHint: "editor@example.com",
		maxUses: 2,
	});
	expect(event).toMatchObject({
		actorUserId: "invite_owner",
		action: "invite_created",
		nextRole: "editor",
	});

	const team = await getCollectionTeam("invite_owner", collection.id, db);
	if (team.status !== "ok") {
		throw new Error("Expected owner to read collection team");
	}
	expect(team.value.invites[0]).not.toHaveProperty("tokenHash");
});

dbTest("allows admins to revoke active invites once", async ({ db }) => {
	const collection = await createTeamCollection("revoke_owner");
	await collectionMemberFactory.create({
		collectionId: collection.id,
		userId: "revoke_admin",
		role: "admin",
		invitedByUserId: "revoke_owner",
	});
	const created = await createCollectionInvite(
		"revoke_admin",
		collection.id,
		{ role: "viewer" },
		db,
	);
	if (created.status !== "ok") {
		throw new Error("Expected invite creation to succeed");
	}

	const revoked = await revokeCollectionInvite(
		"revoke_admin",
		collection.id,
		created.value.id,
		db,
	);
	expect(revoked).toEqual({
		status: "ok",
		value: { revokedAt: expect.any(Date) },
	});
	expect(
		await revokeCollectionInvite(
			"revoke_admin",
			collection.id,
			created.value.id,
			db,
		),
	).toEqual({ status: "not_found" });

	const events = await db
		.select()
		.from(collectionMembershipEvents)
		.where(eq(collectionMembershipEvents.inviteId, created.value.id));
	expect(events.map((event) => event.action)).toEqual([
		"invite_created",
		"invite_revoked",
	]);
});

dbTest("prevents editors from creating invites", async ({ db }) => {
	const collection = await createTeamCollection("permission_owner");
	await collectionMemberFactory.create({
		collectionId: collection.id,
		userId: "permission_editor",
		role: "editor",
	});

	expect(
		await createCollectionInvite(
			"permission_editor",
			collection.id,
			{ role: "viewer" },
			db,
		),
	).toEqual({ status: "forbidden" });

	const invites = await db
		.select()
		.from(collectionInvites)
		.where(eq(collectionInvites.collectionId, collection.id));
	expect(invites).toEqual([]);
});
