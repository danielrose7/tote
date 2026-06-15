import { NextResponse } from "next/server";
import { inngest } from "../../../../inngest/client";
import { isCurator } from "../../../../inngest/curator-auth";

export async function POST(request: Request) {
	if (!(await isCurator())) {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	const { sessionId, correction } = await request.json();

	if (!sessionId || typeof sessionId !== "string") {
		return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
	}

	await inngest.send({
		name: "curation/brief-approved",
		data: {
			sessionId,
			correction: typeof correction === "string" ? correction : undefined,
		},
	});

	return NextResponse.json({ ok: true });
}
