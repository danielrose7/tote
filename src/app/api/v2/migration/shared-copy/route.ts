import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import {
	canUseNeonCollections,
	copyClassicSharedCollectionInputSchema,
	neonCollectionsApiEnabled,
	parseJsonRequest,
} from "../../../../../../lib/collections/api";
import { copyClassicSharedCollection } from "../../../../../../lib/collections/copyRepository";
import { getAccountCollectionDataSource } from "../../../../../../lib/collections/repository";

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
		return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
	}
	const parsed = copyClassicSharedCollectionInputSchema.safeParse(body.data);
	if (!parsed.success) {
		return NextResponse.json(
			{ error: "Invalid shared collection copy", issues: parsed.error.issues },
			{ status: 400 },
		);
	}

	const result = await copyClassicSharedCollection(userId, parsed.data);
	if (result.status === "invalid_source") {
		return NextResponse.json(
			{ error: "Invalid source graph", reason: result.reason },
			{ status: 400 },
		);
	}
	if (result.status === "idempotency_conflict") {
		return NextResponse.json(
			{ error: "Mutation id was already used for another request" },
			{ status: 409 },
		);
	}
	if (result.status !== "ok") {
		return NextResponse.json(
			{ error: "Could not copy collection" },
			{ status: 500 },
		);
	}

	return NextResponse.json(result.value, {
		status: result.value.replayed ? 200 : 201,
	});
}
