import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { collectionIdSchema, parseJsonRequest } from "@/lib/collections/api";
import { clearNodeImageUrl } from "@/lib/collections/repository";

const bodySchema = z.object({ imageUrl: z.string().url() });

type RouteContext = { params: Promise<{ id: string; nodeId: string }> };

async function headCheck(
	url: string,
): Promise<{ reachable: boolean; status?: number }> {
	try {
		const res = await fetch(url, {
			method: "HEAD",
			signal: AbortSignal.timeout(5000),
		});
		return { reachable: res.ok, status: res.status };
	} catch {
		return { reachable: false };
	}
}

export async function POST(request: Request, { params }: RouteContext) {
	const { userId } = await auth();
	if (!userId) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { id, nodeId } = await params;
	const parsedCollectionId = collectionIdSchema.safeParse(id);
	const parsedNodeId = collectionIdSchema.safeParse(nodeId);
	const body = await parseJsonRequest(request);
	if (!parsedCollectionId.success || !parsedNodeId.success || !body.success) {
		return NextResponse.json({ error: "Invalid request" }, { status: 400 });
	}

	const parsed = bodySchema.safeParse(body.data);
	if (!parsed.success) {
		return NextResponse.json(
			{ error: "Invalid body", issues: parsed.error.issues },
			{ status: 400 },
		);
	}

	const { imageUrl } = parsed.data;

	// Verify the image is actually broken with two attempts before clearing
	const first = await headCheck(imageUrl);
	if (first.reachable) {
		return NextResponse.json({ cleared: false, reason: "image_reachable" });
	}

	// Only treat definitive 404/410 as broken; 403/5xx could be transient or server-IP blocks
	const isDefinitelyBroken = first.status === 404 || first.status === 410;
	if (!isDefinitelyBroken) {
		await new Promise((r) => setTimeout(r, 1000));
		const second = await headCheck(imageUrl);
		if (second.reachable) {
			return NextResponse.json({ cleared: false, reason: "image_reachable" });
		}
		if (second.status !== 404 && second.status !== 410) {
			return NextResponse.json({ cleared: false, reason: "uncertain" });
		}
	}

	const result = await clearNodeImageUrl(
		userId,
		parsedCollectionId.data,
		parsedNodeId.data,
		imageUrl,
	);

	if (result.status === "not_found") {
		return NextResponse.json({ error: "Not found" }, { status: 404 });
	}
	if (result.status === "forbidden") {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	return NextResponse.json({ cleared: true });
}
