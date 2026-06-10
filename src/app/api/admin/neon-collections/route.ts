import { clerkClient, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
	const admin = await currentUser();
	if (admin?.publicMetadata?.admin !== true) {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	const { userId, neonCollectionsEnabled } = await request.json();
	if (!userId || typeof neonCollectionsEnabled !== "boolean") {
		return NextResponse.json(
			{ error: "userId and neonCollectionsEnabled (boolean) required" },
			{ status: 400 },
		);
	}
	const clerk = await clerkClient();
	await clerk.users.updateUserMetadata(userId, {
		publicMetadata: { neonCollectionsEnabled },
	});
	return NextResponse.json({ userId, neonCollectionsEnabled });
}
