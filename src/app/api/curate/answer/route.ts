import { NextResponse } from "next/server";
import { inngest } from "../../../../inngest/client";
import { isCurator } from "../../../../inngest/curator-auth";

export async function POST(request: Request) {
	if (!(await isCurator())) {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	const { sessionId, answers } = await request.json();

	if (
		!sessionId ||
		!answers?.audience ||
		!answers?.lens ||
		!answers?.constraints ||
		!answers?.mode ||
		!["normal", "debug"].includes(answers.mode)
	) {
		return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
	}

	await inngest.send({
		name: "curation/answers",
		data: { sessionId, answers },
	});

	return NextResponse.json({ ok: true });
}
