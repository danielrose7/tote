import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import {
	canUseNeonCollections,
	collectionIdSchema,
	neonCollectionsApiEnabled,
} from "../../../../../lib/collections/api";
import {
	getAccountCollectionDataSource,
	getCollectionDetail,
} from "../../../../../lib/collections/repository";

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
