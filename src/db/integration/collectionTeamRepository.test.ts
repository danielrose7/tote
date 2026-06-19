import { and, eq, isNull } from "drizzle-orm";
import { hashInviteToken } from "@/lib/collections/inviteToken";
import {
	acceptCollectionInvite,
	changeCollectionMemberRole,
	createCollectionInvite,
	getCollectionTeam,
	removeCollectionMember,
	revokeCollectionInvite,
	transferCollectionOwnership,
} from "@/lib/collections/teamRepository";
import {
	collectionInvites,
	collectionMembers,
	collectionMembershipEvents,
	collections,
} from "../schema";
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

dbTest(
	"enforces owner and admin role-management boundaries",
	async ({ db }) => {
		const collection = await createTeamCollection("roles_owner");
		await collectionMemberFactory.create({
			collectionId: collection.id,
			userId: "roles_admin",
			role: "admin",
		});
		await collectionMemberFactory.create({
			collectionId: collection.id,
			userId: "roles_editor",
			role: "editor",
		});
		await collectionMemberFactory.create({
			collectionId: collection.id,
			userId: "roles_viewer",
			role: "viewer",
		});

		expect(
			await changeCollectionMemberRole(
				"roles_admin",
				collection.id,
				"roles_viewer",
				"editor",
				db,
			),
		).toEqual({ status: "ok", value: { role: "editor" } });
		expect(
			await changeCollectionMemberRole(
				"roles_admin",
				collection.id,
				"roles_editor",
				"admin",
				db,
			),
		).toEqual({ status: "forbidden" });
		expect(
			await changeCollectionMemberRole(
				"roles_admin",
				collection.id,
				"roles_admin",
				"viewer",
				db,
			),
		).toEqual({ status: "forbidden" });
		expect(
			await changeCollectionMemberRole(
				"roles_owner",
				collection.id,
				"roles_editor",
				"admin",
				db,
			),
		).toEqual({ status: "ok", value: { role: "admin" } });
		expect(
			await changeCollectionMemberRole(
				"roles_owner",
				collection.id,
				"roles_owner",
				"viewer",
				db,
			),
		).toEqual({ status: "forbidden" });

		const events = await db
			.select()
			.from(collectionMembershipEvents)
			.where(eq(collectionMembershipEvents.collectionId, collection.id));
		expect(events.map((event) => event.action)).toEqual([
			"role_changed",
			"role_changed",
		]);
	},
);

dbTest(
	"accepts valid invites atomically and enforces use limits",
	async ({ db }) => {
		const collection = await createTeamCollection("accept_owner");
		const created = await createCollectionInvite(
			"accept_owner",
			collection.id,
			{ role: "editor", maxUses: 1 },
			db,
		);
		if (created.status !== "ok") {
			throw new Error("Expected invite creation to succeed");
		}

		expect(
			await acceptCollectionInvite("accept_member", created.value.token, db),
		).toEqual({
			status: "ok",
			value: {
				collectionId: collection.id,
				inviteId: created.value.id,
				role: "editor",
			},
		});
		expect(
			await acceptCollectionInvite("second_member", created.value.token, db),
		).toEqual({ status: "not_found" });

		const [member] = await db
			.select()
			.from(collectionMembers)
			.where(
				and(
					eq(collectionMembers.collectionId, collection.id),
					eq(collectionMembers.userId, "accept_member"),
				),
			);
		const [invite] = await db
			.select()
			.from(collectionInvites)
			.where(eq(collectionInvites.id, created.value.id));

		expect(member).toMatchObject({
			role: "editor",
			invitedByUserId: "accept_owner",
			revokedAt: null,
		});
		expect(invite.useCount).toBe(1);
	},
);

dbTest("rejects expired and revoked invite tokens", async ({ db }) => {
	const collection = await createTeamCollection("invalid_invite_owner");
	await db.insert(collectionInvites).values([
		{
			collectionId: collection.id,
			createdByUserId: "invalid_invite_owner",
			role: "viewer",
			tokenHash: hashInviteToken("expired-token-value-that-is-long-enough"),
			expiresAt: new Date("2020-01-01T00:00:00Z"),
		},
		{
			collectionId: collection.id,
			createdByUserId: "invalid_invite_owner",
			role: "viewer",
			tokenHash: hashInviteToken("revoked-token-value-that-is-long-enough"),
			revokedAt: new Date(),
		},
	]);

	expect(
		await acceptCollectionInvite(
			"invalid_member",
			"expired-token-value-that-is-long-enough",
			db,
		),
	).toEqual({ status: "not_found" });
	expect(
		await acceptCollectionInvite(
			"invalid_member",
			"revoked-token-value-that-is-long-enough",
			db,
		),
	).toEqual({ status: "not_found" });
});

dbTest(
	"transfers ownership and preserves exactly one owner",
	async ({ db }) => {
		const collection = await createTeamCollection("transfer_owner");
		await collectionMemberFactory.create({
			collectionId: collection.id,
			userId: "transfer_editor",
			role: "editor",
			invitedByUserId: "transfer_owner",
		});

		expect(
			await transferCollectionOwnership(
				"transfer_owner",
				collection.id,
				"transfer_editor",
				db,
			),
		).toEqual({
			status: "ok",
			value: { version: collection.version + 1 },
		});

		const [updatedCollection] = await db
			.select()
			.from(collections)
			.where(eq(collections.id, collection.id));
		const members = await db
			.select()
			.from(collectionMembers)
			.where(eq(collectionMembers.collectionId, collection.id));
		const [event] = await db
			.select()
			.from(collectionMembershipEvents)
			.where(eq(collectionMembershipEvents.collectionId, collection.id));

		expect(updatedCollection.ownerUserId).toBe("transfer_editor");
		expect(
			members
				.map(({ userId, role }) => ({ userId, role }))
				.sort((a, b) => a.userId.localeCompare(b.userId)),
		).toEqual([
			{ userId: "transfer_editor", role: "owner" },
			{ userId: "transfer_owner", role: "admin" },
		]);
		expect(event).toMatchObject({
			action: "ownership_transferred",
			actorUserId: "transfer_owner",
			subjectUserId: "transfer_editor",
			previousRole: "editor",
			nextRole: "owner",
		});

		expect(
			await transferCollectionOwnership(
				"transfer_owner",
				collection.id,
				"transfer_editor",
				db,
			),
		).toEqual({ status: "forbidden" });
	},
);

dbTest("removes collaborators according to the role matrix", async ({ db }) => {
	const collection = await createTeamCollection("remove_owner");
	await collectionMemberFactory.create({
		collectionId: collection.id,
		userId: "remove_admin",
		role: "admin",
	});
	await collectionMemberFactory.create({
		collectionId: collection.id,
		userId: "remove_editor",
		role: "editor",
	});
	await collectionMemberFactory.create({
		collectionId: collection.id,
		userId: "remove_viewer",
		role: "viewer",
	});

	expect(
		await removeCollectionMember(
			"remove_admin",
			collection.id,
			"remove_editor",
			db,
		),
	).toEqual({
		status: "ok",
		value: { revokedAt: expect.any(Date) },
	});
	expect(
		await removeCollectionMember(
			"remove_admin",
			collection.id,
			"remove_admin",
			db,
		),
	).toEqual({ status: "forbidden" });
	expect(
		await removeCollectionMember(
			"remove_admin",
			collection.id,
			"remove_owner",
			db,
		),
	).toEqual({ status: "forbidden" });
	expect(
		await removeCollectionMember(
			"remove_owner",
			collection.id,
			"remove_admin",
			db,
		),
	).toEqual({
		status: "ok",
		value: { revokedAt: expect.any(Date) },
	});

	const activeMembers = await db
		.select()
		.from(collectionMembers)
		.where(
			and(
				eq(collectionMembers.collectionId, collection.id),
				isNull(collectionMembers.revokedAt),
			),
		);
	expect(activeMembers.map((member) => member.userId).sort()).toEqual([
		"remove_owner",
		"remove_viewer",
	]);
});
