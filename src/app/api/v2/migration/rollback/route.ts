import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { rollbackCollectionMigration } from "@/lib/collections/migrationRepository";
import { db } from "@/lib/db";

export async function POST() {
	const { userId } = await auth();
	if (!userId) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}
	const result = await rollbackCollectionMigration(userId, db);
	if (result.status === "not_available") {
		return NextResponse.json(
			{ error: "The Classic Jazz rollback window is not available" },
			{ status: 409 },
		);
	}
	return NextResponse.json({ rolledBack: true });
}
