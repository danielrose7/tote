import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import {
	canUseNeonCollections,
	collectionIdSchema,
	neonCollectionsApiEnabled,
} from "../../../../../../../../lib/collections/api";
import { getAccountCollectionDataSource } from "../../../../../../../../lib/collections/repository";
import { revokeCollectionInvite } from "../../../../../../../../lib/collections/teamRepository";

type RouteContext = {
	params: Promise<{ id: string; inviteId: string }>;
};

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

	const { id, inviteId } = await params;
	const parsedCollectionId = collectionIdSchema.safeParse(id);
	const parsedInviteId = collectionIdSchema.safeParse(inviteId);
	if (!parsedCollectionId.success || !parsedInviteId.success) {
		return NextResponse.json({ error: "Invalid request" }, { status: 400 });
	}

	const result = await revokeCollectionInvite(
		userId,
		parsedCollectionId.data,
		parsedInviteId.data,
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
