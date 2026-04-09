import { NextResponse } from "next/server";
import { isCurator } from "../../../../../inngest/curator-auth";
import { readSession } from "../../../../../lib/curatorSession";

export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ sessionId: string }> },
) {
	if (!(await isCurator())) {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	const { sessionId } = await params;
	const session = await readSession(sessionId);

	return NextResponse.json({
		phase: session?.phase ?? null,
		result: session?.phase === "complete"
			? {
					title: session.title,
					sectionCount: session.sectionCount,
					itemCount: session.itemCount,
					json: session.json,
				}
			: null,
		urlSections: session?.urlSections ?? null,
	});
}
