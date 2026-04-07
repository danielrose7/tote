import { serve } from "inngest/next";
import { inngest } from "../../../inngest/client";
import { acknowledgeCuration } from "../../../inngest/functions/acknowledge-curation";
import { curateCollection } from "../../../inngest/functions/curate-collection";

const handlers = serve({
	client: inngest,
	functions: [acknowledgeCuration, curateCollection],
});

function logRequestStart(method: string, request: Request) {
	const url = new URL(request.url);
	console.log("[api/inngest] request:start", {
		at: new Date().toISOString(),
		method,
		pathname: url.pathname,
		search: url.search,
		fnId: url.searchParams.get("fnId"),
		stepId: url.searchParams.get("stepId"),
	});
}

function logRequestEnd(
	method: string,
	request: Request,
	response: Response,
	startedAt: number,
) {
	const url = new URL(request.url);
	console.log("[api/inngest] request:end", {
		at: new Date().toISOString(),
		method,
		pathname: url.pathname,
		search: url.search,
		fnId: url.searchParams.get("fnId"),
		stepId: url.searchParams.get("stepId"),
		status: response.status,
		durationMs: Date.now() - startedAt,
	});
}

function withLogging(
	method: "GET" | "POST" | "PUT",
	handler: (request: Request) => Promise<Response>,
) {
	return async function loggedHandler(request: Request) {
		const startedAt = Date.now();
		logRequestStart(method, request);
		try {
			const response = await handler(request);
			logRequestEnd(method, request, response, startedAt);
			return response;
		} catch (error) {
			const url = new URL(request.url);
			console.error("[api/inngest] request:error", {
				at: new Date().toISOString(),
				method,
				pathname: url.pathname,
				search: url.search,
				fnId: url.searchParams.get("fnId"),
				stepId: url.searchParams.get("stepId"),
				durationMs: Date.now() - startedAt,
				error: error instanceof Error ? error.message : String(error),
			});
			throw error;
		}
	};
}

export const GET = withLogging("GET", handlers.GET);
export const POST = withLogging("POST", handlers.POST);
export const PUT = withLogging("PUT", handlers.PUT);
