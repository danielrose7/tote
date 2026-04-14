"use server";

import { getClientSubscriptionToken } from "inngest/react";
import { curationChannel } from "../../../inngest/channels";
import { inngest } from "../../../inngest/client";

export async function fetchRealtimeToken(sessionId: string) {
	return getClientSubscriptionToken(inngest, {
		channel: curationChannel({ sessionId }),
		topics: ["interview", "progress", "result", "urls"],
	});
}
