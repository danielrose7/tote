import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import {
	canUseNeonCollections,
	collectionIdSchema,
	copyCollectionInputSchema,
	neonCollectionsApiEnabled,
	parseJsonRequest,
} from "@/lib/collections/api";
import { copyCollection } from "@/lib/collections/copyRepository";
import { getAccountCollectionDataSource } from "@/lib/collections/repository";

export async function POST(
	request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
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

	const { id } = await params;
	const parsedId = collectionIdSchema.safeParse(id);
	const body = await parseJsonRequest(request);
	if (!parsedId.success || !body.success) {
		return NextResponse.json({ error: "Invalid request" }, { status: 400 });
	}
	const parsedInput = copyCollectionInputSchema.safeParse(body.data);
	if (!parsedInput.success) {
		return NextResponse.json(
			{ error: "Invalid copy request", issues: parsedInput.error.issues },
			{ status: 400 },
		);
	}

	const result = await copyCollection(userId, parsedId.data, parsedInput.data);
	if (result.status === "not_found") {
		return NextResponse.json({ error: "Not found" }, { status: 404 });
	}
	if (result.status === "forbidden") {
		return NextResponse.json(
			{ error: "Copying is disabled for this collection" },
			{ status: 403 },
		);
	}
	if (result.status === "idempotency_conflict") {
		return NextResponse.json(
			{ error: "Mutation id was already used for another request" },
			{ status: 409 },
		);
	}

	return NextResponse.json(result.value, {
		status: result.value.replayed ? 200 : 201,
	});
}
