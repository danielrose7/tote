import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getCollectionMigrationStatus } from "@/lib/collections/migrationRepository";
import { db } from "@/lib/db";

export async function GET() {
	const { userId } = await auth();
	if (!userId) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}
	return NextResponse.json(await getCollectionMigrationStatus(userId, db));
}
