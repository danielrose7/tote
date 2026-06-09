import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import {
	importClassicCollectionsInputSchema,
	neonCollectionsApiEnabled,
	parseJsonRequest,
} from "../../../../../../lib/collections/api";
import { importClassicCollections } from "../../../../../../lib/collections/migrationRepository";

export async function POST(request: Request) {
	if (!neonCollectionsApiEnabled()) {
		return NextResponse.json({ error: "Not found" }, { status: 404 });
	}
	const { userId } = await auth();
	if (!userId) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}
	const body = await parseJsonRequest(request);
	if (!body.success) {
		return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
	}
	const parsed = importClassicCollectionsInputSchema.safeParse(body.data);
	if (!parsed.success) {
		return NextResponse.json(
			{ error: "Invalid migration payload", issues: parsed.error.issues },
			{ status: 400 },
		);
	}

	const result = await importClassicCollections(userId, parsed.data);
	if (result.status === "fingerprint_mismatch") {
		return NextResponse.json(
			{ error: "Source fingerprint does not match the migration payload" },
			{ status: 400 },
		);
	}
	if (result.status === "invalid_source") {
		return NextResponse.json(
			{ error: "Invalid source graph", reason: result.reason },
			{ status: 400 },
		);
	}
	if (result.status === "migration_conflict") {
		return NextResponse.json(
			{ error: "Migration version was already completed with other data" },
			{ status: 409 },
		);
	}

	return NextResponse.json(result.value, {
		status: result.value.replayed ? 200 : 201,
	});
}
