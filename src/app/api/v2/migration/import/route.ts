import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import {
	canStartCollectionMigration,
	importClassicCollectionsInputSchema,
	neonCollectionsApiEnabled,
	parseJsonRequest,
} from "@/lib/collections/api";
import {
	CollectionMigrationVerificationError,
	importClassicCollections,
	recordCollectionMigrationFailure,
} from "@/lib/collections/migrationRepository";
import { getAccountCollectionDataSource } from "@/lib/collections/repository";

export async function POST(request: Request) {
	if (!neonCollectionsApiEnabled()) {
		return NextResponse.json({ error: "Not found" }, { status: 404 });
	}
	const { userId } = await auth();
	if (!userId) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}
	const [user, dataSource] = await Promise.all([
		currentUser(),
		getAccountCollectionDataSource(userId),
	]);
	if (
		!canStartCollectionMigration(
			dataSource,
			user?.publicMetadata?.neonCollectionsEnabled === true,
		)
	) {
		return NextResponse.json(
			{ error: "Collection migration is not enabled for this account" },
			{ status: 403 },
		);
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

	let result: Awaited<ReturnType<typeof importClassicCollections>>;
	try {
		result = await importClassicCollections(userId, parsed.data);
	} catch (error) {
		const code =
			error instanceof CollectionMigrationVerificationError
				? "verification_failed"
				: "import_failed";
		try {
			await recordCollectionMigrationFailure(userId, {
				migrationVersion: parsed.data.migrationVersion,
				sourceFingerprint: parsed.data.sourceFingerprint,
				sourceCollectionCount: parsed.data.collections.length,
				sourceItemCount: parsed.data.collections.reduce(
					(total, collection) =>
						total +
						collection.nodes.filter((node) =>
							["product", "link", "photo"].includes(node.type),
						).length,
					0,
				),
				code,
			});
		} catch (recordingError) {
			console.error(
				"Failed to record collection migration failure",
				recordingError,
			);
		}
		console.error("Classic Jazz collection migration failed", error);
		return NextResponse.json(
			{
				error:
					code === "verification_failed"
						? "Imported collections could not be verified"
						: "Collection migration could not be completed",
			},
			{ status: 500 },
		);
	}
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
