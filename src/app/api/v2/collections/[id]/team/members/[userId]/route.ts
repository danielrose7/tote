import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import {
	canUseNeonCollections,
	collectionIdSchema,
	collectionMemberUserIdSchema,
	neonCollectionsApiEnabled,
	parseJsonRequest,
	updateCollectionMemberInputSchema,
} from "@/lib/collections/api";
import { getAccountCollectionDataSource } from "@/lib/collections/repository";
import {
	changeCollectionMemberRole,
	removeCollectionMember,
} from "@/lib/collections/teamRepository";

type RouteContext = {
	params: Promise<{ id: string; userId: string }>;
};

async function parseContext(params: RouteContext["params"]) {
	const { id, userId } = await params;
	return {
		collectionId: collectionIdSchema.safeParse(id),
		memberUserId: collectionMemberUserIdSchema.safeParse(userId),
	};
}

export async function PATCH(request: Request, { params }: RouteContext) {
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

	const parsedContext = await parseContext(params);
	const body = await parseJsonRequest(request);
	if (
		!parsedContext.collectionId.success ||
		!parsedContext.memberUserId.success ||
		!body.success
	) {
		return NextResponse.json({ error: "Invalid request" }, { status: 400 });
	}

	const parsed = updateCollectionMemberInputSchema.safeParse(body.data);
	if (!parsed.success) {
		return NextResponse.json(
			{ error: "Invalid member update", issues: parsed.error.issues },
			{ status: 400 },
		);
	}

	const result = await changeCollectionMemberRole(
		userId,
		parsedContext.collectionId.data,
		parsedContext.memberUserId.data,
		parsed.data.role,
	);
	if (result.status === "not_found") {
		return NextResponse.json({ error: "Not found" }, { status: 404 });
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

export async function DELETE(_request: Request, { params }: RouteContext) {
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

	const parsedContext = await parseContext(params);
	if (
		!parsedContext.collectionId.success ||
		!parsedContext.memberUserId.success
	) {
		return NextResponse.json({ error: "Invalid request" }, { status: 400 });
	}

	const result = await removeCollectionMember(
		userId,
		parsedContext.collectionId.data,
		parsedContext.memberUserId.data,
	);
	if (result.status === "not_found") {
		return NextResponse.json({ error: "Not found" }, { status: 404 });
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
