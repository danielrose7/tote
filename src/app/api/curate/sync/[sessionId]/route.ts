import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { isCurator } from "../../../../../inngest/curator-auth";

const INNGEST_GQL =
	process.env.INNGEST_DEV_SERVER_URL ?? "http://localhost:8288";

// Inngest dev server doesn't support GraphQL variables — inline values directly
async function gql(query: string) {
	const res = await fetch(`${INNGEST_GQL}/v0/gql`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ query }),
	});
	if (!res.ok) throw new Error(`Inngest GQL ${res.status}`);
	const json = await res.json();
	if (json.errors?.length) throw new Error(json.errors[0].message);
	return json.data;
}

function slugToTitle(slug: string): string {
	return slug
		.split("-")
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
		.join(" ");
}

export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ sessionId: string }> },
) {
	if (!(await isCurator())) {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	const { sessionId } = await params;

	// 1. Find the most recent run for this session
	// Note: inner quotes around sessionId must be escaped as \" in the GraphQL string
	const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
	const runsData = await gql(`{
		runs(
			filter: { from: "${from}", query: "event.data.sessionId == \\"${sessionId}\\"" }
			orderBy: [{ field: QUEUED_AT, direction: DESC }]
		) {
			edges { node { id status } }
		}
	}`);

	const runNode = runsData?.runs?.edges?.[0]?.node;
	if (!runNode) {
		return NextResponse.json({ error: "Run not found" }, { status: 404 });
	}

	const runID: string = runNode.id;

	// 2. Get the full step trace
	const traceData = await gql(`{
		runTrace(runID: "${runID}") {
			childrenSpans { name status stepType outputID }
		}
	}`);

	const spans: { name: string; status: string; stepType: string; outputID: string | null }[] =
		traceData?.runTrace?.childrenSpans ?? [];

	const spanByName = new Map(spans.map((s) => [s.name, s]));

	// 3. Fetch key step outputs
	async function fetchOutput(name: string): Promise<unknown> {
		const span = spanByName.get(name);
		if (!span?.outputID || span.status !== "COMPLETED") return null;
		try {
			const out = await gql(`{
				runTraceSpanOutputByID(outputID: "${span.outputID}") {
					data
					error { name message }
				}
			}`);
			const raw = out?.runTraceSpanOutputByID?.data;
			return raw ? JSON.parse(raw) : null;
		} catch {
			return null;
		}
	}

	const [planOutput, resultOutput] = await Promise.all([
		fetchOutput("plan-collection"),
		fetchOutput("curate-and-write"),
	]);

	const plan = planOutput as { sections?: { title: string }[] } | null;
	const resultData = resultOutput as {
		filePath: string;
		title: string;
		sectionCount: number;
		itemCount: number;
	} | null;

	// 4. Determine phase
	type Phase = "idle" | "started" | "interview" | "running" | "extracting" | "complete" | "error";
	let phase: Phase = "started";

	if (spanByName.has("complete") && spanByName.get("complete")?.status === "COMPLETED") {
		phase = "complete";
	} else if (spanByName.has("extractions-received")) {
		phase = "running";
	} else if (spanByName.has("extraction-queued")) {
		phase = "extracting";
	} else if (spanByName.has("planned") || spanByName.has("answers-received")) {
		phase = "running";
	} else if (spanByName.has("interview-sent")) {
		phase = "started";
	}

	// 5. Reconstruct progress entries in workflow order
	const progress: { step: string; message: string; detail?: string; ts: number }[] = [];
	let ts = Date.now() - spans.length * 1000;

	function addProgress(step: string, message: string, detail?: string) {
		progress.push({ step, message, detail, ts: ts++ });
	}

	if (spanByName.has("interview-sent")) {
		addProgress("acknowledged", "Starting curation...");
		addProgress("interview-sent", "Interview questions sent — waiting for your answers.");
	}
	if (spanByName.has("answers-received")) {
		addProgress("answers-received", "Answers received. Planning collection...");
	}
	if (spanByName.has("planned")) {
		const sectionCount = plan?.sections?.length ?? 0;
		const sectionNames = plan?.sections?.map((s) => s.title).join(", ");
		addProgress("planned", `Plan ready: ${sectionCount} sections`, sectionNames);
	}

	// Search/URL discovery steps (ordered as they appear in trace)
	for (const span of spans) {
		if (span.name.startsWith("searching-")) {
			const slug = span.name.replace(/^searching-/, "");
			addProgress("searching", `Searching for "${slugToTitle(slug)}"...`);
		} else if (span.name.startsWith("found-urls-")) {
			const slug = span.name.replace(/^found-urls-/, "");
			addProgress("found-urls", `Found URLs for "${slugToTitle(slug)}"`);
		}
	}

	if (spanByName.has("extraction-queued")) {
		addProgress("extracting", "URLs ready — extracting with extension...");
	}
	if (spanByName.has("extractions-received")) {
		addProgress("curating", "Curating final shortlist...");
	}
	if (spanByName.has("complete") && resultData) {
		addProgress("complete", `Done. Written to ${resultData.filePath}`);
	}

	// 6. Load urlSections from session file (written by persist-session-urls step)
	let urlSections: unknown = null;
	try {
		const raw = await readFile(
			join(process.cwd(), "collections", ".sessions", `${sessionId}.json`),
			"utf-8",
		);
		const sessionFile = JSON.parse(raw);
		urlSections = sessionFile.urlSections ?? null;
	} catch {
		// session file not present — urlSections stays null
	}

	// 7. Return reconstructed state
	const result = resultData
		? {
				filePath: resultData.filePath,
				title: resultData.title,
				sectionCount: resultData.sectionCount,
				itemCount: resultData.itemCount,
			}
		: null;

	return NextResponse.json({ phase, progress, result, urlSections });
}
