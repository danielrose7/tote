import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { sql } from "../../../../lib/db";

export async function DELETE() {
	const { userId } = await auth();
	if (!userId) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	// Delete Neon data in dependency order before removing the Clerk account.
	// curator_step_log has no FK cascade so must be deleted explicitly first.
	await sql`
    DELETE FROM curator_step_log
    WHERE session_id IN (
      SELECT session_id FROM curator_sessions WHERE clerk_user_id = ${userId}
    )
  `;
	await sql`DELETE FROM curator_sessions WHERE clerk_user_id = ${userId}`;
	await sql`DELETE FROM credit_transactions WHERE clerk_user_id = ${userId}`;
	await sql`DELETE FROM user_credits WHERE clerk_user_id = ${userId}`;
	// published_blocks cascade-deletes via FK on published_collections
	await sql`DELETE FROM published_collections WHERE owner_clerk_id = ${userId}`;

	// Jazz data on the sync server is E2E-encrypted and keyed to this Clerk
	// account's private keys (stored on-device). Deleting the Clerk account
	// makes those blobs permanently inaccessible without a Jazz deletion API.

	const response = await fetch(`https://api.clerk.com/v1/users/${userId}`, {
		method: "DELETE",
		headers: {
			Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
		},
	});

	if (!response.ok) {
		const error = await response.text();
		console.error("[Delete Account] Clerk API error:", response.status, error);
		return NextResponse.json(
			{ error: "Failed to delete account" },
			{ status: response.status },
		);
	}

	return NextResponse.json({ success: true });
}
