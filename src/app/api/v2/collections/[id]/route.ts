import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import {
	canUseNeonCollections,
	collectionIdSchema,
	deleteCollectionInputSchema,
	neonCollectionsApiEnabled,
	parseJsonRequest,
	updateCollectionInputSchema,
} from "@/lib/collections/api";
import {
	deleteCollection,
	getAccountCollectionDataSource,
	getCollectionDetail,
	updateCollection,
} from "@/lib/collections/repository";

export async function GET(
	_request: Request,
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
	if (!parsedId.success) {
		return NextResponse.json(
			{ error: "Invalid collection id" },
			{ status: 400 },
		);
	}

	const collection = await getCollectionDetail(userId, parsedId.data);

	if (!collection) {
		return NextResponse.json({ error: "Not found" }, { status: 404 });
	}

	return NextResponse.json(collection);
}

export async function PATCH(
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

	const parsed = updateCollectionInputSchema.safeParse(body.data);
	if (!parsed.success) {
		return NextResponse.json(
			{ error: "Invalid collection update", issues: parsed.error.issues },
			{ status: 400 },
		);
	}

	const result = await updateCollection(userId, parsedId.data, parsed.data);
	if (result.status === "not_found") {
		return NextResponse.json({ error: "Not found" }, { status: 404 });
	}
	if (result.status === "forbidden") {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}
	if (result.status === "version_conflict") {
		return NextResponse.json({ error: "Version conflict" }, { status: 409 });
	}
	if (result.status === "idempotency_conflict") {
		return NextResponse.json(
			{ error: "Mutation id was already used for another request" },
			{ status: 409 },
		);
	}

	return NextResponse.json({
		...result.value,
		replayed: result.replayed ?? false,
	});
}

export async function DELETE(
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

	const parsed = deleteCollectionInputSchema.safeParse(body.data);
	if (!parsed.success) {
		return NextResponse.json(
			{ error: "Invalid collection deletion", issues: parsed.error.issues },
			{ status: 400 },
		);
	}

	const result = await deleteCollection(userId, parsedId.data, parsed.data);
	if (result.status === "not_found") {
		return NextResponse.json({ error: "Not found" }, { status: 404 });
	}
	if (result.status === "forbidden") {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}
	if (result.status === "version_conflict") {
		return NextResponse.json({ error: "Version conflict" }, { status: 409 });
	}
	if (result.status === "idempotency_conflict") {
		return NextResponse.json(
			{ error: "Mutation id was already used for another request" },
			{ status: 409 },
		);
	}

	return NextResponse.json({
		...result.value,
		replayed: result.replayed ?? false,
	});
}
