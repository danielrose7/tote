import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { inngest } from "../../../../inngest/client";
import { isCurator } from "../../../../inngest/curator-auth";
import { getCreditBalance } from "../../../../lib/credits";

export async function POST(request: Request) {
	if (!(await isCurator())) {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	const { topic } = await request.json();
	if (!topic?.trim()) {
		return NextResponse.json({ error: "topic is required" }, { status: 400 });
	}

	const { userId } = await auth();

	const balance = await getCreditBalance(userId!);
	if (balance <= 0) {
		return NextResponse.json(
			{ error: "Insufficient credits" },
			{ status: 402 },
		);
	}
	const sessionId = crypto.randomUUID();

	await inngest.send({
		name: "curation/start",
		data: { sessionId, topic: topic.trim(), requestedBy: userId ?? "unknown" },
	});

	return NextResponse.json({ sessionId });
}
