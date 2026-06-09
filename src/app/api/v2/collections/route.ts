import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import {
	canUseNeonCollections,
	createCollectionInputSchema,
	neonCollectionsApiEnabled,
	parseJsonRequest,
} from "../../../../lib/collections/api";
import {
	createCollection,
	getAccountCollectionDataSource,
	listCollectionSummaries,
} from "../../../../lib/collections/repository";

export async function GET() {
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

	const collections = await listCollectionSummaries(userId);
	return NextResponse.json({ collections });
}

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

	const parsed = createCollectionInputSchema.safeParse(body.data);
	if (!parsed.success) {
		return NextResponse.json(
			{ error: "Invalid collection", issues: parsed.error.issues },
			{ status: 400 },
		);
	}

	const result = await createCollection(userId, parsed.data);
	if (result.status === "idempotency_conflict") {
		return NextResponse.json(
			{ error: "Mutation id was already used with different input" },
			{ status: 409 },
		);
	}

	return NextResponse.json(
		{ id: result.id, replayed: result.status === "replayed" },
		{ status: result.status === "created" ? 201 : 200 },
	);
}
