import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import {
	canUseNeonCollections,
	collectionIdSchema,
	neonCollectionsApiEnabled,
	parseJsonRequest,
	publishCollectionInputSchema,
} from "../../../../../../../lib/collections/api";
import {
	getCollectionPublicationStatus,
	publishCollectionSnapshot,
	unpublishCollectionSnapshot,
} from "../../../../../../../lib/collections/publicationRepository";
import { getAccountCollectionDataSource } from "../../../../../../../lib/collections/repository";

async function getContext(id: string) {
	if (!neonCollectionsApiEnabled()) {
		return {
			response: NextResponse.json({ error: "Not found" }, { status: 404 }),
		};
	}
	const { userId } = await auth();
	if (!userId) {
		return {
			response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
		};
	}
	const dataSource = await getAccountCollectionDataSource(userId);
	if (!canUseNeonCollections(dataSource)) {
		return {
			response: NextResponse.json(
				{ error: "Neon collections are not enabled", dataSource },
				{ status: 409 },
			),
		};
	}
	const parsedId = collectionIdSchema.safeParse(id);
	if (!parsedId.success) {
		return {
			response: NextResponse.json(
				{ error: "Invalid collection id" },
				{ status: 400 },
			),
		};
	}
	return { userId, collectionId: parsedId.data };
}

function resultResponse<T>(
	result:
		| { status: "ok"; value: T }
		| { status: "not_found" }
		| { status: "forbidden" }
		| { status: "slug_conflict" },
) {
	if (result.status === "not_found") {
		return NextResponse.json({ error: "Not found" }, { status: 404 });
	}
	if (result.status === "forbidden") {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}
	if (result.status === "slug_conflict") {
		return NextResponse.json(
			{ error: "That public URL is already in use" },
			{ status: 409 },
		);
	}
	return NextResponse.json(result.value);
}

export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const { id } = await params;
	const context = await getContext(id);
	if ("response" in context) return context.response;
	return resultResponse(
		await getCollectionPublicationStatus(context.userId, context.collectionId),
	);
}

export async function POST(
	request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const { id } = await params;
	const context = await getContext(id);
	if ("response" in context) return context.response;
	const body = await parseJsonRequest(request);
	const parsed = body.success
		? publishCollectionInputSchema.safeParse(body.data)
		: null;
	if (!parsed?.success) {
		return NextResponse.json(
			{ error: "Invalid publication settings" },
			{ status: 400 },
		);
	}
	const user = await currentUser();
	return resultResponse(
		await publishCollectionSnapshot(context.userId, context.collectionId, {
			...parsed.data,
			username: user?.username ?? undefined,
		}),
	);
}

export async function DELETE(
	_request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const { id } = await params;
	const context = await getContext(id);
	if ("response" in context) return context.response;
	return resultResponse(
		await unpublishCollectionSnapshot(context.userId, context.collectionId),
	);
}
