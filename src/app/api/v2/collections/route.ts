import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import {
	canUseNeonCollections,
	createCollectionInputSchema,
	neonCollectionsApiEnabled,
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

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
	}

	const parsed = createCollectionInputSchema.safeParse(body);
	if (!parsed.success) {
		return NextResponse.json(
			{ error: "Invalid collection", issues: parsed.error.issues },
			{ status: 400 },
		);
	}

	const id = await createCollection(userId, parsed.data);
	return NextResponse.json({ id }, { status: 201 });
}
