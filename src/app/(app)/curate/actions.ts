"use server";

import { getClientSubscriptionToken } from "inngest/react";
import { inngest } from "../../../inngest/client";
import { curationChannel } from "../../../inngest/channels";

export async function fetchRealtimeToken(sessionId: string) {
	return getClientSubscriptionToken(inngest, {
		channel: curationChannel({ sessionId }),
		topics: ["interview", "progress", "result", "urls"],
	});
}
