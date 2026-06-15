import { clerkClient, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { listCollectionMigrationHealth } from "../../../lib/collections/migrationRepository";
import { db, sql } from "../../../lib/db";
import {
	AdminClient,
	type Balance,
	type Grant,
	type MigrationHealth,
} from "./AdminClient";

export default async function AdminPage() {
	const user = await currentUser();
	if (!user) redirect("/sign-in");
	if (user.publicMetadata?.admin !== true) redirect("/");

	const balances = await sql`
    SELECT
      u.clerk_user_id,
      u.balance_cents,
      u.updated_at,
      COUNT(t.id) FILTER (WHERE t.type = 'deduction')       AS run_count,
      SUM(t.amount_cents) FILTER (WHERE t.type IN ('free_grant', 'purchase')) AS total_granted_cents
    FROM user_credits u
    LEFT JOIN credit_transactions t ON t.clerk_user_id = u.clerk_user_id
    GROUP BY u.clerk_user_id, u.balance_cents, u.updated_at
    ORDER BY u.updated_at DESC
  `;

	// Enrich with Clerk user data and feature access.
	const clerk = await clerkClient();
	const clerkUsers = balances.length
		? (
				await clerk.users.getUserList({
					userId: balances.map((b) => b.clerk_user_id as string),
				})
			).data
		: [];

	const clerkById = Object.fromEntries(clerkUsers.map((u) => [u.id, u]));

	const enrichedBalances = balances.map((b) => {
		const cu = clerkById[b.clerk_user_id as string];
		return {
			...b,
			email: cu?.emailAddresses[0]?.emailAddress ?? "—",
			curator: cu?.publicMetadata?.curator === true,
			chatEnabled: cu?.publicMetadata?.chatEnabled === true,
			neonCollectionsEnabled:
				cu?.publicMetadata?.neonCollectionsEnabled === true,
		};
	});

	const recentGrants = await sql`
    SELECT clerk_user_id, amount_cents, type, created_at
    FROM credit_transactions
    WHERE type IN ('free_grant', 'purchase')
    ORDER BY created_at DESC
    LIMIT 20
  `;
	const recentGrantUsers = recentGrants.length
		? (
				await clerk.users.getUserList({
					userId: recentGrants.map((g) => g.clerk_user_id as string),
				})
			).data
		: [];
	const recentGrantUserById = Object.fromEntries(
		recentGrantUsers.map((u) => [u.id, u]),
	);
	const enrichedRecentGrants = recentGrants.map((g) => {
		const cu = recentGrantUserById[g.clerk_user_id as string];
		return {
			...g,
			email: cu?.emailAddresses[0]?.emailAddress ?? "—",
		};
	});
	const migrationHealth = await listCollectionMigrationHealth(db);
	const migrationUsers = migrationHealth.length
		? (
				await clerk.users.getUserList({
					userId: migrationHealth.map((migration) => migration.userId),
				})
			).data
		: [];
	const migrationUserById = Object.fromEntries(
		migrationUsers.map((migrationUser) => [migrationUser.id, migrationUser]),
	);
	const enrichedMigrationHealth = migrationHealth.map((migration) => {
		const migrationUser = migrationUserById[migration.userId];
		return {
			...migration,
			email:
				migrationUser?.emailAddresses[0]?.emailAddress ?? "Unknown Clerk user",
			cutoverAt: migration.cutoverAt?.toISOString() ?? null,
			rollbackExpiresAt: migration.rollbackExpiresAt?.toISOString() ?? null,
			updatedAt: migration.updatedAt.toISOString(),
			errorCode:
				typeof migration.error?.code === "string" ? migration.error.code : null,
		};
	});

	return (
		<AdminClient
			balances={enrichedBalances as Balance[]}
			recentGrants={enrichedRecentGrants as Grant[]}
			migrationHealth={enrichedMigrationHealth as MigrationHealth[]}
		/>
	);
}
