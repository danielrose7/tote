import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getCreditTransactions } from "../../../../lib/credits";

export async function GET(request: Request) {
	const { userId } = await auth();
	if (!userId) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { searchParams } = new URL(request.url);
	const parsedLimit = Number(searchParams.get("limit") ?? "20");
	const limit = Number.isFinite(parsedLimit)
		? Math.min(Math.max(Math.trunc(parsedLimit), 1), 100)
		: 20;

	const transactions = await getCreditTransactions(userId, limit);
	return NextResponse.json({ transactions });
}
