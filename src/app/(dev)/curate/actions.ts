"use server";

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getClientSubscriptionToken } from "inngest/react";
import { inngest } from "../../../inngest/client";
import { curationChannel } from "../../../inngest/channels";

export async function readCollectionJson(filePath: string): Promise<string> {
	const abs = join(process.cwd(), filePath);
	return readFile(abs, "utf-8");
}

export async function fetchRealtimeToken(sessionId: string) {
	return getClientSubscriptionToken(inngest, {
		channel: curationChannel({ sessionId }),
		topics: ["interview", "progress", "result", "urls"],
	});
}
