import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { inngest } from "../../../../inngest/client";
import { isCurator } from "../../../../inngest/curator-auth";

export async function POST(request: Request) {
	if (!(await isCurator())) {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	const { topic } = await request.json();
	if (!topic?.trim()) {
		return NextResponse.json({ error: "topic is required" }, { status: 400 });
	}

	const { userId } = await auth();
	const sessionId = crypto.randomUUID();

	await inngest.send({
		name: "curation/start",
		data: { sessionId, topic: topic.trim(), requestedBy: userId ?? "unknown" },
	});

	return NextResponse.json({ sessionId });
}
