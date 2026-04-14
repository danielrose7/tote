import { NextResponse } from "next/server";
import { isCurator } from "../../../../../inngest/curator-auth";
import { getStepLog } from "../../../../../lib/curatorStepLog";

export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ sessionId: string }> },
) {
	if (!(await isCurator())) {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	const { sessionId } = await params;
	const steps = await getStepLog(sessionId);

	return NextResponse.json({ sessionId, steps });
}
