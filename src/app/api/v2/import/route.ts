import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { parseJsonRequest } from "@/lib/collections/api";
import { createCollectionFromPayload } from "@/lib/collections/importRepository";
import { validatePayload } from "@/lib/importPayload";

export async function POST(request: Request) {
	const { userId } = await auth();
	if (!userId) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const body = await parseJsonRequest(request);
	if (!body.success) {
		return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
	}

	const { payload: rawPayload, originType } = (body.data ?? {}) as {
		payload?: unknown;
		originType?: unknown;
	};

	let payload: ReturnType<typeof validatePayload>;
	try {
		payload = validatePayload(rawPayload);
	} catch (error) {
		return NextResponse.json(
			{
				error:
					error instanceof Error ? error.message : "Invalid import payload",
			},
			{ status: 400 },
		);
	}

	const { id } = await createCollectionFromPayload(userId, payload, {
		originType: originType === "curator" ? "curator" : "import",
	});
	return NextResponse.json({ id }, { status: 201 });
}
