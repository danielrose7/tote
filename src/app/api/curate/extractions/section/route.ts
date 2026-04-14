import { NextResponse } from "next/server";
import { inngest } from "../../../../../inngest/client";
import { isCurator } from "../../../../../inngest/curator-auth";
import type { CurationSectionExtractedEvent } from "../../../../../inngest/types";

export async function POST(request: Request) {
	if (!(await isCurator())) {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	const { sessionId, slug, title, items } = await request.json();

	if (!sessionId || !slug || !title || !Array.isArray(items)) {
		return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
	}

	await inngest.send({
		name: "curation/section-extracted" as CurationSectionExtractedEvent["name"],
		data: { sessionId, slug, title, items },
	});

	return NextResponse.json({ ok: true });
}
