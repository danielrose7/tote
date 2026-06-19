import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import {
	acceptCollectionInviteInputSchema,
	canUseNeonCollections,
	neonCollectionsApiEnabled,
	parseJsonRequest,
} from "@/lib/collections/api";
import { getAccountCollectionDataSource } from "@/lib/collections/repository";
import { acceptCollectionInvite } from "@/lib/collections/teamRepository";

export async function POST(request: Request) {
	if (!neonCollectionsApiEnabled()) {
		return NextResponse.json({ error: "Not found" }, { status: 404 });
	}

	const { userId } = await auth();
	if (!userId) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const dataSource = await getAccountCollectionDataSource(userId);
	if (!canUseNeonCollections(dataSource)) {
		return NextResponse.json(
			{ error: "Neon collections are not enabled", dataSource },
			{ status: 409 },
		);
	}

	const body = await parseJsonRequest(request);
	if (!body.success) {
		return NextResponse.json({ error: "Invalid request" }, { status: 400 });
	}

	const parsed = acceptCollectionInviteInputSchema.safeParse(body.data);
	if (!parsed.success) {
		return NextResponse.json(
			{ error: "Invalid invite token", issues: parsed.error.issues },
			{ status: 400 },
		);
	}

	const result = await acceptCollectionInvite(userId, parsed.data.token);
	if (result.status === "not_found") {
		return NextResponse.json(
			{ error: "Invite is invalid or no longer available" },
			{ status: 404 },
		);
	}
	if (result.status === "forbidden") {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}
	if (
		result.status === "version_conflict" ||
		result.status === "idempotency_conflict"
	) {
		return NextResponse.json({ error: "Conflict" }, { status: 409 });
	}

	return NextResponse.json(result.value);
}
