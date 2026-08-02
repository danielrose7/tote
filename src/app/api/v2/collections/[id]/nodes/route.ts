import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import {
	collectionIdSchema,
	createCollectionNodeInputSchema,
	parseJsonRequest,
} from "@/lib/collections/api";
import { createCollectionNode } from "@/lib/collections/repository";

export async function POST(
	request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const { userId } = await auth();
	if (!userId) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { id } = await params;
	const parsedId = collectionIdSchema.safeParse(id);
	const body = await parseJsonRequest(request);
	if (!parsedId.success || !body.success) {
		return NextResponse.json({ error: "Invalid request" }, { status: 400 });
	}

	const parsed = createCollectionNodeInputSchema.safeParse(body.data);
	if (!parsed.success) {
		return NextResponse.json(
			{ error: "Invalid collection node", issues: parsed.error.issues },
			{ status: 400 },
		);
	}

	const result = await createCollectionNode(userId, parsedId.data, parsed.data);
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

	return NextResponse.json(
		{ ...result.value, replayed: result.replayed ?? false },
		{ status: result.replayed ? 200 : 201 },
	);
}
