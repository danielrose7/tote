import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isCurator } from "../../../../inngest/curator-auth";
import { getCreditBalance } from "../../../../lib/credits";

export async function GET() {
	if (!(await isCurator())) {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}
	const { userId } = await auth();
	const balanceCents = await getCreditBalance(userId!);
	return NextResponse.json({ balanceCents });
}
